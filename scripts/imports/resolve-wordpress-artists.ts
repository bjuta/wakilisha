import pg from "pg";

type Pool = InstanceType<typeof pg.Pool>;
type Row = Record<string, unknown>;
type SourceArtist = {
  stagingId: string;
  runId: string;
  sourceKind: string;
  sourceRecordId: string;
  slug: string;
  title: string;
  normalizedTitle: string;
  body: string;
  sourceUrl: string;
  sourceEntity: string;
  raw: Row;
  mapped: Row;
  imageUrl: string;
  origin: string;
  artistType: string;
};
type RegistryArtist = {
  id: string;
  slug: string;
  displayName: string;
  normalizedName: string;
  bio: string;
  artistType: string;
  originIso2: string;
  publicImageUrl: string;
  metadata: Row;
  status: string;
};
type MatchResult = {
  target: RegistryArtist | null;
  score: number;
  reasons: string[];
};
type ResolveSummary = {
  scanned: number;
  autoMerged: number;
  queuedReview: number;
  queuedCreate: number;
  skipped: number;
};

const AUTO_MERGE_THRESHOLD = Number(process.env.WAKILISHA_ARTIST_AUTO_MERGE_THRESHOLD ?? 90);
const REVIEW_THRESHOLD = Number(process.env.WAKILISHA_ARTIST_REVIEW_THRESHOLD ?? 55);

function normalizeDatabaseUrl(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("uselibpqcompat");
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

function createPool(): Pool {
  const explicitHost = process.env.PGHOST;
  const explicitUser = process.env.PGUSER;
  const explicitPassword = process.env.PGPASSWORD;
  const explicitDatabase = process.env.PGDATABASE;
  const explicitPort = Number(process.env.PGPORT || 5432);
  if (explicitHost && explicitUser && explicitPassword && explicitDatabase) {
    return new pg.Pool({ host: explicitHost, port: explicitPort, user: explicitUser, password: explicitPassword, database: explicitDatabase, ssl: { rejectUnauthorized: false }, max: 4, connectionTimeoutMillis: 15000, query_timeout: 120000, statement_timeout: 120000 });
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL or explicit PG* env vars are required.");
  return new pg.Pool({ connectionString: normalizeDatabaseUrl(databaseUrl), ssl: { rejectUnauthorized: false }, max: 4, connectionTimeoutMillis: 15000, query_timeout: 120000, statement_timeout: 120000 });
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalize(value: unknown): string {
  return text(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(value: unknown): string {
  return normalize(value).replace(/\s+/g, "-") || "artist";
}

function parsePayload(value: unknown): Row {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Row;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Row : {};
    } catch {
      return {};
    }
  }
  return {};
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const next = text(value);
    if (next && !["null", "undefined", "false", "[object object]"].includes(next.toLowerCase())) return next;
  }
  return "";
}

function firstUrl(...values: unknown[]): string {
  for (const value of values) {
    const next = text(value);
    if (/^https?:\/\//i.test(next)) return next;
  }
  return "";
}

function tokenOverlap(a: string, b: string): number {
  const aTokens = new Set(a.split(/\s+/).filter(Boolean));
  const bTokens = new Set(b.split(/\s+/).filter(Boolean));
  if (!aTokens.size || !bTokens.size) return 0;
  let shared = 0;
  for (const token of aTokens) if (bTokens.has(token)) shared++;
  return shared / Math.max(aTokens.size, bTokens.size);
}

async function ensureDecisionTable(pool: Pool): Promise<void> {
  await pool.query(`
    create table if not exists entity_resolution_decisions (
      id uuid primary key default gen_random_uuid(),
      entity_type text not null,
      source_table text,
      source_kind text,
      source_record_id text,
      source_staging_record_id uuid,
      source_slug text,
      source_title text,
      target_table text,
      target_id text,
      target_slug text,
      target_title text,
      confidence_score numeric,
      decision text not null default 'needs_review',
      status text not null default 'open',
      review_required boolean not null default true,
      reason text,
      candidate_payload jsonb not null default '{}'::jsonb,
      source_payload jsonb not null default '{}'::jsonb,
      resolved_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  const alters = [
    "alter table entity_resolution_decisions add column if not exists entity_type text",
    "alter table entity_resolution_decisions add column if not exists source_table text",
    "alter table entity_resolution_decisions add column if not exists source_kind text",
    "alter table entity_resolution_decisions add column if not exists source_record_id text",
    "alter table entity_resolution_decisions add column if not exists source_staging_record_id uuid",
    "alter table entity_resolution_decisions add column if not exists source_slug text",
    "alter table entity_resolution_decisions add column if not exists source_title text",
    "alter table entity_resolution_decisions add column if not exists target_table text",
    "alter table entity_resolution_decisions add column if not exists target_id text",
    "alter table entity_resolution_decisions add column if not exists target_slug text",
    "alter table entity_resolution_decisions add column if not exists target_title text",
    "alter table entity_resolution_decisions add column if not exists confidence_score numeric",
    "alter table entity_resolution_decisions add column if not exists decision text",
    "alter table entity_resolution_decisions add column if not exists status text",
    "alter table entity_resolution_decisions add column if not exists review_required boolean",
    "alter table entity_resolution_decisions add column if not exists reason text",
    "alter table entity_resolution_decisions add column if not exists candidate_payload jsonb",
    "alter table entity_resolution_decisions add column if not exists source_payload jsonb",
    "alter table entity_resolution_decisions add column if not exists resolved_at timestamptz",
    "alter table entity_resolution_decisions add column if not exists created_at timestamptz",
    "alter table entity_resolution_decisions add column if not exists updated_at timestamptz",
  ];
  for (const alter of alters) await pool.query(alter);

  await pool.query(`create unique index if not exists entity_resolution_artist_source_uidx on entity_resolution_decisions(entity_type, source_staging_record_id) where entity_type = 'artist' and source_staging_record_id is not null`);
  await pool.query(`create index if not exists entity_resolution_artist_review_idx on entity_resolution_decisions(entity_type, review_required, status, confidence_score desc)`);
}

async function getRunIds(pool: Pool): Promise<string[]> {
  const jobId = arg("--job");
  if (jobId) return [jobId];
  const limit = Number(arg("--limit") || 5);
  const result = await pool.query(
    "select distinct ingestion_run_id::text as id from wk_import_staging_records where target_entity = 'artists' order by ingestion_run_id::text desc limit $1",
    [limit],
  );
  return result.rows.map((row) => String(row.id));
}

async function loadSourceArtists(pool: Pool, runId: string): Promise<SourceArtist[]> {
  const result = await pool.query(`
    select id::text, ingestion_run_id::text, source_kind, source_record_id, source_entity, target_slug, title, body, source_url, raw_record, mapped_record
    from wk_import_staging_records
    where ingestion_run_id = $1
      and target_entity = 'artists'
      and target_status in ('ready', 'needs_review')
      and nullif(title, '') is not null
    order by target_status asc, title asc
  `, [runId]);

  return result.rows.map((row) => {
    const raw = parsePayload(row.raw_record);
    const mapped = parsePayload(row.mapped_record);
    const title = firstText(row.title, mapped.display_name, mapped.name, raw.display_name, raw.name, raw.post_title);
    const sourceUrl = firstText(row.source_url, mapped.url, mapped.website, raw.url, raw.website);
    return {
      stagingId: String(row.id),
      runId: String(row.ingestion_run_id),
      sourceKind: firstText(row.source_kind),
      sourceRecordId: firstText(row.source_record_id, raw.id, raw.ID),
      sourceEntity: firstText(row.source_entity),
      slug: firstText(row.target_slug, mapped.slug, raw.slug, raw.post_name, slugify(title)),
      title,
      normalizedTitle: normalize(title),
      body: firstText(row.body, mapped.bio, mapped.description, raw.bio, raw.description, raw.post_content),
      sourceUrl,
      raw,
      mapped,
      imageUrl: firstUrl(mapped.public_image_url, mapped.image_url, mapped.profile_image_url, raw.public_image_url, raw.image_url, raw.profile_image_url, sourceUrl),
      origin: normalize(firstText(mapped.origin_iso2, mapped.origin, mapped.country, raw.origin_iso2, raw.origin, raw.country)),
      artistType: normalize(firstText(mapped.artist_type, mapped.type, raw.artist_type, raw.type)),
    };
  });
}

async function loadRegistryArtists(pool: Pool): Promise<RegistryArtist[]> {
  const result = await pool.query(`
    select id::text, slug, display_name, normalized_name, bio, artist_type, origin_iso2, public_image_url, metadata, status
    from registry_artists
    where coalesce(status, '') <> 'archived'
  `);
  return result.rows.map((row) => ({
    id: String(row.id),
    slug: firstText(row.slug),
    displayName: firstText(row.display_name),
    normalizedName: normalize(firstText(row.normalized_name, row.display_name)),
    bio: firstText(row.bio),
    artistType: normalize(row.artist_type),
    originIso2: normalize(row.origin_iso2),
    publicImageUrl: firstText(row.public_image_url),
    metadata: parsePayload(row.metadata),
    status: firstText(row.status),
  }));
}

function scoreMatch(source: SourceArtist, target: RegistryArtist): MatchResult {
  let score = 0;
  const reasons: string[] = [];
  const sourceSlug = slugify(source.slug || source.title);
  const targetSlug = slugify(target.slug || target.displayName);

  if (source.sourceRecordId && JSON.stringify(target.metadata).includes(source.sourceRecordId)) {
    score += 100;
    reasons.push("source_record_id already appears in target metadata");
  }
  if (sourceSlug && sourceSlug === targetSlug) {
    score += 55;
    reasons.push("exact slug match");
  }
  if (source.normalizedTitle && source.normalizedTitle === target.normalizedName) {
    score += 45;
    reasons.push("exact normalized name match");
  }
  const overlap = tokenOverlap(source.normalizedTitle, target.normalizedName);
  if (overlap >= 0.75 && source.normalizedTitle !== target.normalizedName) {
    score += 20;
    reasons.push(`strong token overlap (${Math.round(overlap * 100)}%)`);
  } else if (overlap >= 0.5) {
    score += 10;
    reasons.push(`partial token overlap (${Math.round(overlap * 100)}%)`);
  }
  if (source.origin && target.originIso2 && source.origin === target.originIso2) {
    score += 8;
    reasons.push("origin matches");
  }
  if (source.artistType && target.artistType && source.artistType === target.artistType) {
    score += 5;
    reasons.push("artist type matches");
  }

  return { target, score: Math.min(score, 100), reasons };
}

function bestMatch(source: SourceArtist, targets: RegistryArtist[]): MatchResult {
  let best: MatchResult = { target: null, score: 0, reasons: [] };
  for (const target of targets) {
    const scored = scoreMatch(source, target);
    if (scored.score > best.score) best = scored;
  }
  return best;
}

async function upsertDecision(pool: Pool, source: SourceArtist, match: MatchResult, decision: string, reviewRequired: boolean): Promise<void> {
  const target = match.target;
  await pool.query(`
    insert into entity_resolution_decisions (
      entity_type, source_table, source_kind, source_record_id, source_staging_record_id, source_slug, source_title,
      target_table, target_id, target_slug, target_title, confidence_score, decision, status, review_required,
      reason, candidate_payload, source_payload, resolved_at, updated_at
    ) values (
      'artist', 'wk_import_staging_records', $1, $2, $3::uuid, $4, $5,
      'registry_artists', $6, $7, $8, $9, $10, $11, $12,
      $13, $14::jsonb, $15::jsonb, $16, now()
    )
    on conflict (entity_type, source_staging_record_id) where entity_type = 'artist' and source_staging_record_id is not null
    do update set
      source_kind = excluded.source_kind,
      source_record_id = excluded.source_record_id,
      source_slug = excluded.source_slug,
      source_title = excluded.source_title,
      target_id = excluded.target_id,
      target_slug = excluded.target_slug,
      target_title = excluded.target_title,
      confidence_score = excluded.confidence_score,
      decision = excluded.decision,
      status = excluded.status,
      review_required = excluded.review_required,
      reason = excluded.reason,
      candidate_payload = excluded.candidate_payload,
      source_payload = excluded.source_payload,
      resolved_at = excluded.resolved_at,
      updated_at = now()
  `, [
    source.sourceKind,
    source.sourceRecordId,
    source.stagingId,
    source.slug,
    source.title,
    target?.id ?? null,
    target?.slug ?? null,
    target?.displayName ?? null,
    match.score,
    decision,
    reviewRequired ? "open" : "resolved",
    reviewRequired,
    match.reasons.join("; ") || (decision === "create_candidate" ? "no confident registry match found" : "artist resolution decision"),
    JSON.stringify(target ? { id: target.id, slug: target.slug, displayName: target.displayName, status: target.status, metadata: target.metadata } : {}),
    JSON.stringify({ stagingId: source.stagingId, runId: source.runId, slug: source.slug, title: source.title, body: source.body, imageUrl: source.imageUrl, origin: source.origin, artistType: source.artistType, mapped: source.mapped, raw: source.raw }),
    reviewRequired ? null : new Date().toISOString(),
  ]);
}

async function autoEnrichArtist(pool: Pool, source: SourceArtist, target: RegistryArtist, score: number, reasons: string[]): Promise<void> {
  await pool.query(`
    update registry_artists
    set
      bio = coalesce(nullif(bio, ''), nullif($2, '')),
      artist_type = coalesce(nullif(artist_type, ''), nullif($3, '')),
      origin_iso2 = coalesce(nullif(origin_iso2, ''), nullif($4, '')),
      public_image_url = coalesce(nullif(public_image_url, ''), nullif($5, '')),
      image_source_provider = case when nullif(public_image_url, '') is null and nullif($5, '') is not null then 'wordpress' else image_source_provider end,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'wordpress_artist_resolution', jsonb_strip_nulls(jsonb_build_object(
          'source', 'resolve-wordpress-artists',
          'source_staging_record_id', $6,
          'source_record_id', $7,
          'source_slug', $8,
          'confidence_score', $9,
          'reasons', $10::jsonb,
          'resolved_at', now()
        ))
      ),
      updated_at = now()
    where id = $1::uuid
  `, [
    target.id,
    source.body,
    source.artistType || null,
    source.origin || null,
    source.imageUrl || null,
    source.stagingId,
    source.sourceRecordId,
    source.slug,
    score,
    JSON.stringify(reasons),
  ]);

  await pool.query(`
    insert into wk_import_promotion_events (ingestion_run_id, staging_record_id, target_table, target_record_id, event_type, message)
    values ($1::uuid, $2::uuid, 'registry_artists', $3, 'resolved', $4)
  `, [source.runId, source.stagingId, target.id, `Phase 2 auto-merged artist ${source.title} into ${target.displayName} (${score}).`]);
}

async function createUnmatchedArtist(pool: Pool, source: SourceArtist): Promise<string | null> {
  if (!hasFlag("--create-unmatched")) return null;
  if (hasFlag("--dry-run")) return null;
  const result = await pool.query(`
    insert into registry_artists (slug, display_name, normalized_name, bio, artist_type, origin_iso2, public_image_url, image_source_provider, status, metadata, created_at, updated_at)
    values ($1, $2, $3, nullif($4, ''), nullif($5, ''), nullif($6, ''), nullif($7, ''), case when nullif($7, '') is not null then 'wordpress' else null end, 'needs_review', $8::jsonb, now(), now())
    on conflict (slug) do nothing
    returning id::text
  `, [
    slugify(source.slug || source.title),
    source.title,
    source.normalizedTitle,
    source.body,
    source.artistType,
    source.origin,
    source.imageUrl,
    JSON.stringify({ wordpress_artist_resolution: { source: "resolve-wordpress-artists", source_staging_record_id: source.stagingId, source_record_id: source.sourceRecordId, source_slug: source.slug, created_as_needs_review: true } }),
  ]);
  return result.rows[0]?.id ? String(result.rows[0].id) : null;
}

async function resolveRun(pool: Pool, runId: string): Promise<ResolveSummary> {
  const sources = await loadSourceArtists(pool, runId);
  const targets = await loadRegistryArtists(pool);
  const summary: ResolveSummary = { scanned: sources.length, autoMerged: 0, queuedReview: 0, queuedCreate: 0, skipped: 0 };

  for (const source of sources) {
    const match = bestMatch(source, targets);
    if (hasFlag("--dry-run")) {
      const action = match.score >= AUTO_MERGE_THRESHOLD ? "auto_merge" : match.score >= REVIEW_THRESHOLD ? "review_match" : "create_candidate";
      console.log(`[artist-resolve] dry-run ${source.title} (${source.slug}) → ${match.target?.displayName ?? 'no match'} score=${match.score} action=${action}`);
      continue;
    }

    if (match.target && match.score >= AUTO_MERGE_THRESHOLD) {
      await autoEnrichArtist(pool, source, match.target, match.score, match.reasons);
      await upsertDecision(pool, source, match, "auto_merged", false);
      summary.autoMerged++;
    } else if (match.target && match.score >= REVIEW_THRESHOLD) {
      await upsertDecision(pool, source, match, "review_match", true);
      summary.queuedReview++;
    } else {
      const createdId = await createUnmatchedArtist(pool, source);
      if (createdId) {
        await upsertDecision(pool, source, { target: { id: createdId, slug: source.slug, displayName: source.title, normalizedName: source.normalizedTitle, bio: source.body, artistType: source.artistType, originIso2: source.origin, publicImageUrl: source.imageUrl, metadata: {}, status: "needs_review" }, score: 100, reasons: ["created unmatched artist as needs_review"] }, "created_needs_review", true);
      } else {
        await upsertDecision(pool, source, match, "create_candidate", true);
      }
      summary.queuedCreate++;
    }
  }

  if (!hasFlag("--dry-run")) {
    await pool.query(`
      update wk_ingestion_runs
      set source_manifest = jsonb_set(coalesce(source_manifest, '{}'::jsonb), '{artist_resolution}', $2::jsonb, true),
          warnings = array_remove(array_append(coalesce(warnings, '{}'::text[]), $3), null)
      where id = $1
    `, [runId, JSON.stringify({ resolved_at: new Date().toISOString(), processor: "resolve-wordpress-artists", version: "0.1.0", thresholds: { auto_merge: AUTO_MERGE_THRESHOLD, review: REVIEW_THRESHOLD }, summary }), `Phase 2 artist resolution completed: ${summary.autoMerged} auto-merged, ${summary.queuedReview + summary.queuedCreate} queued for review.`]);
  }

  return summary;
}

async function main(): Promise<void> {
  const pool = createPool();
  try {
    await ensureDecisionTable(pool);
    const runIds = await getRunIds(pool);
    if (!runIds.length) {
      console.log("[artist-resolve] no artist staging records found");
      return;
    }
    for (const runId of runIds) {
      const summary = await resolveRun(pool, runId);
      console.log(`[artist-resolve] ${runId}: scanned=${summary.scanned} autoMerged=${summary.autoMerged} queuedReview=${summary.queuedReview} queuedCreate=${summary.queuedCreate} skipped=${summary.skipped}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[artist-resolve] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
