import pg from "pg";

type Pool = InstanceType<typeof pg.Pool>;
type Row = Record<string, unknown>;
type RegistryArtist = {
  id: string;
  slug: string;
  displayName: string;
  metadata: Row;
};
type SourceRelationship = {
  stagingId: string;
  runId: string;
  sourceKind: string;
  sourceRecordId: string;
  sourceEntity: string;
  title: string;
  raw: Row;
  mapped: Row;
  sourceArtistLegacyId: string;
  targetArtistLegacyId: string;
  relationshipType: string;
  score: number | null;
  sharedTracksAll: number | null;
  sharedChartTracks: number | null;
  featuresThem: number | null;
  theyFeature: number | null;
  sharedTitles: string[];
};
type PromotionSummary = {
  scanned: number;
  promoted: number;
  unresolved: number;
  skippedSelf: number;
};

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

function numberValue(...values: unknown[]): number | null {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
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

function parseSharedTitles(...values: unknown[]): string[] {
  for (const value of values) {
    if (!value) continue;
    if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 50);
    const raw = text(value);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 50);
    } catch {
      // fall through to delimiter parsing
    }
    return raw.split(/\s*[|,;]\s*/).map((item) => item.trim()).filter(Boolean).slice(0, 50);
  }
  return [];
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const next = text(value);
    if (next && !["null", "undefined", "false", "[object object]"].includes(next.toLowerCase())) return next;
  }
  return "";
}

async function ensureRelationshipTable(pool: Pool): Promise<void> {
  await pool.query(`
    create table if not exists registry_artist_relationships (
      id uuid primary key default gen_random_uuid(),
      source_artist_id uuid not null references registry_artists(id) on delete cascade,
      target_artist_id uuid not null references registry_artists(id) on delete cascade,
      relationship_type text not null default 'related',
      score numeric,
      shared_track_count integer,
      shared_chart_track_count integer,
      features_them_count integer,
      they_feature_count integer,
      shared_titles jsonb not null default '[]'::jsonb,
      metadata jsonb not null default '{}'::jsonb,
      source_ingestion_run_id uuid,
      source_staging_record_id uuid,
      source_record_id text,
      status text not null default 'active',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint registry_artist_relationships_no_self check (source_artist_id <> target_artist_id)
    )
  `);

  const alters = [
    "alter table registry_artist_relationships add column if not exists source_artist_id uuid",
    "alter table registry_artist_relationships add column if not exists target_artist_id uuid",
    "alter table registry_artist_relationships add column if not exists relationship_type text",
    "alter table registry_artist_relationships add column if not exists score numeric",
    "alter table registry_artist_relationships add column if not exists shared_track_count integer",
    "alter table registry_artist_relationships add column if not exists shared_chart_track_count integer",
    "alter table registry_artist_relationships add column if not exists features_them_count integer",
    "alter table registry_artist_relationships add column if not exists they_feature_count integer",
    "alter table registry_artist_relationships add column if not exists shared_titles jsonb",
    "alter table registry_artist_relationships add column if not exists metadata jsonb",
    "alter table registry_artist_relationships add column if not exists source_ingestion_run_id uuid",
    "alter table registry_artist_relationships add column if not exists source_staging_record_id uuid",
    "alter table registry_artist_relationships add column if not exists source_record_id text",
    "alter table registry_artist_relationships add column if not exists status text",
    "alter table registry_artist_relationships add column if not exists created_at timestamptz",
    "alter table registry_artist_relationships add column if not exists updated_at timestamptz",
  ];
  for (const alter of alters) await pool.query(alter);

  await pool.query(`create unique index if not exists registry_artist_relationships_source_staging_uidx on registry_artist_relationships(source_staging_record_id) where source_staging_record_id is not null`);
  await pool.query(`create unique index if not exists registry_artist_relationships_pair_uidx on registry_artist_relationships(source_artist_id, target_artist_id, relationship_type) where source_staging_record_id is null`);
  await pool.query(`create index if not exists registry_artist_relationships_source_idx on registry_artist_relationships(source_artist_id, status, score desc nulls last)`);
  await pool.query(`create index if not exists registry_artist_relationships_target_idx on registry_artist_relationships(target_artist_id, status, score desc nulls last)`);
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
  await pool.query(`create unique index if not exists entity_resolution_artist_relationship_source_uidx on entity_resolution_decisions(entity_type, source_staging_record_id) where entity_type = 'artist_relationship' and source_staging_record_id is not null`);
  await pool.query(`create index if not exists entity_resolution_artist_relationship_review_idx on entity_resolution_decisions(entity_type, review_required, status, confidence_score desc)`);
}

async function getRunIds(pool: Pool): Promise<string[]> {
  const jobId = arg("--job");
  if (jobId) return [jobId];
  const limit = Number(arg("--limit") || 5);
  const result = await pool.query(
    "select distinct ingestion_run_id::text as id from wk_import_staging_records where target_entity = 'artist_relationships' order by ingestion_run_id::text desc limit $1",
    [limit],
  );
  return result.rows.map((row) => String(row.id));
}

async function loadSourceRelationships(pool: Pool, runId: string): Promise<SourceRelationship[]> {
  const result = await pool.query(`
    select id::text, ingestion_run_id::text, source_kind, source_record_id, source_entity, title, raw_record, mapped_record
    from wk_import_staging_records
    where ingestion_run_id = $1
      and target_entity = 'artist_relationships'
      and target_status in ('ready', 'needs_review')
    order by source_record_id asc nulls last
  `, [runId]);

  return result.rows.map((row) => {
    const raw = parsePayload(row.raw_record);
    const mapped = parsePayload(row.mapped_record);
    const relationshipType = firstText(mapped.relationship_type, raw.relationship_type, raw.type, raw.relation_type, "related").toLowerCase().replace(/[^a-z0-9_:-]+/g, "_");
    return {
      stagingId: String(row.id),
      runId: String(row.ingestion_run_id),
      sourceKind: firstText(row.source_kind),
      sourceRecordId: firstText(row.source_record_id, raw.id, raw.ID),
      sourceEntity: firstText(row.source_entity),
      title: firstText(row.title),
      raw,
      mapped,
      sourceArtistLegacyId: firstText(raw.artist_id, raw.source_artist_id, raw.source_id, raw.artist, mapped.artist_id, mapped.source_artist_id),
      targetArtistLegacyId: firstText(raw.related_artist_id, raw.target_artist_id, raw.target_id, raw.related_id, raw.related_artist, mapped.related_artist_id, mapped.target_artist_id),
      relationshipType: relationshipType || "related",
      score: numberValue(raw.score, raw.relationship_score, raw.affinity_score, mapped.score),
      sharedTracksAll: numberValue(raw.shared_tracks_all, raw.shared_track_count, raw.shared_tracks, mapped.shared_tracks_all, mapped.shared_track_count),
      sharedChartTracks: numberValue(raw.shared_chart_tracks, raw.shared_chart_track_count, mapped.shared_chart_tracks, mapped.shared_chart_track_count),
      featuresThem: numberValue(raw.features_them, raw.features_them_count, mapped.features_them, mapped.features_them_count),
      theyFeature: numberValue(raw.they_feature, raw.they_feature_count, raw.they_featured, mapped.they_feature, mapped.they_feature_count),
      sharedTitles: parseSharedTitles(raw.shared_titles, raw.shared_track_titles, raw.shared_tracks_json, mapped.shared_titles),
    };
  });
}

async function loadArtists(pool: Pool): Promise<RegistryArtist[]> {
  const result = await pool.query(`
    select id::text, slug, display_name, metadata
    from registry_artists
    where coalesce(status, '') <> 'archived'
  `);
  return result.rows.map((row) => ({
    id: String(row.id),
    slug: firstText(row.slug),
    displayName: firstText(row.display_name),
    metadata: parsePayload(row.metadata),
  }));
}

function buildLegacyArtistIndex(artists: RegistryArtist[]): Map<string, RegistryArtist> {
  const index = new Map<string, RegistryArtist>();
  for (const artist of artists) {
    const metadataString = JSON.stringify(artist.metadata ?? {});
    const directCandidates = [
      artist.metadata?.wordpress_id,
      artist.metadata?.source_record_id,
      (artist.metadata?.wordpress_artist_resolution as Row | undefined)?.source_record_id,
      (artist.metadata?.wordpress_artist_resolution as Row | undefined)?.source_staging_record_id,
    ];
    for (const candidate of directCandidates) {
      const key = firstText(candidate);
      if (key && !index.has(key)) index.set(key, artist);
    }

    const matches = metadataString.match(/"(?:wordpress_id|source_record_id|artist_id)"\s*:\s*"?([0-9A-Za-z_-]+)"?/g) ?? [];
    for (const match of matches) {
      const id = match.replace(/^.*:\s*"?/, "").replace(/"?$/, "");
      if (id && !index.has(id)) index.set(id, artist);
    }
  }
  return index;
}

function resolveArtist(legacyId: string, index: Map<string, RegistryArtist>): RegistryArtist | null {
  if (!legacyId) return null;
  return index.get(legacyId) ?? null;
}

async function upsertUnresolvedDecision(pool: Pool, rel: SourceRelationship, reason: string, sourceArtist: RegistryArtist | null, targetArtist: RegistryArtist | null): Promise<void> {
  await pool.query(`
    insert into entity_resolution_decisions (
      entity_type, source_table, source_kind, source_record_id, source_staging_record_id, source_title,
      target_table, target_id, target_slug, target_title, confidence_score, decision, status, review_required,
      reason, candidate_payload, source_payload, updated_at
    ) values (
      'artist_relationship', 'wk_import_staging_records', $1, $2, $3::uuid, $4,
      'registry_artist_relationships', $5, $6, $7, 0, 'unresolved_relationship', 'open', true,
      $8, $9::jsonb, $10::jsonb, now()
    )
    on conflict (entity_type, source_staging_record_id) where entity_type = 'artist_relationship' and source_staging_record_id is not null
    do update set
      source_kind = excluded.source_kind,
      source_record_id = excluded.source_record_id,
      source_title = excluded.source_title,
      target_id = excluded.target_id,
      target_slug = excluded.target_slug,
      target_title = excluded.target_title,
      decision = excluded.decision,
      status = excluded.status,
      review_required = excluded.review_required,
      reason = excluded.reason,
      candidate_payload = excluded.candidate_payload,
      source_payload = excluded.source_payload,
      updated_at = now()
  `, [
    rel.sourceKind,
    rel.sourceRecordId,
    rel.stagingId,
    rel.title,
    targetArtist?.id ?? sourceArtist?.id ?? null,
    targetArtist?.slug ?? sourceArtist?.slug ?? null,
    targetArtist?.displayName ?? sourceArtist?.displayName ?? null,
    reason,
    JSON.stringify({ sourceArtist, targetArtist }),
    JSON.stringify(rel),
  ]);
}

async function promoteRelationship(pool: Pool, rel: SourceRelationship, sourceArtist: RegistryArtist, targetArtist: RegistryArtist): Promise<void> {
  await pool.query(`
    insert into registry_artist_relationships (
      source_artist_id,
      target_artist_id,
      relationship_type,
      score,
      shared_track_count,
      shared_chart_track_count,
      features_them_count,
      they_feature_count,
      shared_titles,
      metadata,
      source_ingestion_run_id,
      source_staging_record_id,
      source_record_id,
      status,
      updated_at
    ) values (
      $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::uuid, $12::uuid, $13, 'active', now()
    )
    on conflict (source_staging_record_id) where source_staging_record_id is not null
    do update set
      source_artist_id = excluded.source_artist_id,
      target_artist_id = excluded.target_artist_id,
      relationship_type = excluded.relationship_type,
      score = excluded.score,
      shared_track_count = excluded.shared_track_count,
      shared_chart_track_count = excluded.shared_chart_track_count,
      features_them_count = excluded.features_them_count,
      they_feature_count = excluded.they_feature_count,
      shared_titles = excluded.shared_titles,
      metadata = excluded.metadata,
      status = excluded.status,
      updated_at = now()
  `, [
    sourceArtist.id,
    targetArtist.id,
    rel.relationshipType,
    rel.score,
    rel.sharedTracksAll,
    rel.sharedChartTracks,
    rel.featuresThem,
    rel.theyFeature,
    JSON.stringify(rel.sharedTitles),
    JSON.stringify({ source: "promote-wordpress-artist-relationships", source_entity: rel.sourceEntity, source_artist_legacy_id: rel.sourceArtistLegacyId, target_artist_legacy_id: rel.targetArtistLegacyId, raw_record: rel.raw, mapped_record: rel.mapped }),
    rel.runId,
    rel.stagingId,
    rel.sourceRecordId,
  ]);

  await pool.query(`
    insert into wk_import_promotion_events (ingestion_run_id, staging_record_id, target_table, target_record_id, event_type, message)
    values ($1::uuid, $2::uuid, 'registry_artist_relationships', $3, 'promoted', $4)
  `, [rel.runId, rel.stagingId, `${sourceArtist.slug}->${targetArtist.slug}`, `Phase 3 promoted artist relationship ${sourceArtist.displayName} → ${targetArtist.displayName}.`]);
}

async function promoteRun(pool: Pool, runId: string): Promise<PromotionSummary> {
  const relationships = await loadSourceRelationships(pool, runId);
  const artists = await loadArtists(pool);
  const index = buildLegacyArtistIndex(artists);
  const summary: PromotionSummary = { scanned: relationships.length, promoted: 0, unresolved: 0, skippedSelf: 0 };

  for (const rel of relationships) {
    const sourceArtist = resolveArtist(rel.sourceArtistLegacyId, index);
    const targetArtist = resolveArtist(rel.targetArtistLegacyId, index);

    if (hasFlag("--dry-run")) {
      const status = sourceArtist && targetArtist
        ? sourceArtist.id === targetArtist.id ? "self-skip" : "promote"
        : "unresolved";
      console.log(`[artist-rel-promote] dry-run ${rel.sourceArtistLegacyId}->${rel.targetArtistLegacyId} ${rel.relationshipType}: ${status} ${sourceArtist?.displayName ?? '?'} -> ${targetArtist?.displayName ?? '?'}`);
      continue;
    }

    if (!sourceArtist || !targetArtist) {
      await upsertUnresolvedDecision(pool, rel, `Could not resolve ${!sourceArtist ? "source" : ""}${!sourceArtist && !targetArtist ? " and " : ""}${!targetArtist ? "target" : ""} artist legacy ID.`, sourceArtist, targetArtist);
      summary.unresolved++;
      continue;
    }

    if (sourceArtist.id === targetArtist.id) {
      await upsertUnresolvedDecision(pool, rel, "Resolved relationship points to the same artist on both sides; skipped self relationship.", sourceArtist, targetArtist);
      summary.skippedSelf++;
      continue;
    }

    await promoteRelationship(pool, rel, sourceArtist, targetArtist);
    summary.promoted++;
  }

  if (!hasFlag("--dry-run")) {
    await pool.query(`
      update wk_ingestion_runs
      set source_manifest = jsonb_set(coalesce(source_manifest, '{}'::jsonb), '{artist_relationship_promotion}', $2::jsonb, true),
          warnings = array_remove(array_append(coalesce(warnings, '{}'::text[]), $3), null)
      where id = $1
    `, [runId, JSON.stringify({ promoted_at: new Date().toISOString(), processor: "promote-wordpress-artist-relationships", version: "0.1.0", summary }), `Phase 3 artist relationship promotion completed: ${summary.promoted} promoted, ${summary.unresolved} unresolved, ${summary.skippedSelf} self-links skipped.`]);
  }

  return summary;
}

async function main(): Promise<void> {
  const pool = createPool();
  try {
    await ensureRelationshipTable(pool);
    await ensureDecisionTable(pool);
    const runIds = await getRunIds(pool);
    if (!runIds.length) {
      console.log("[artist-rel-promote] no artist relationship staging records found");
      return;
    }
    for (const runId of runIds) {
      const summary = await promoteRun(pool, runId);
      console.log(`[artist-rel-promote] ${runId}: scanned=${summary.scanned} promoted=${summary.promoted} unresolved=${summary.unresolved} skippedSelf=${summary.skippedSelf}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[artist-rel-promote] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
