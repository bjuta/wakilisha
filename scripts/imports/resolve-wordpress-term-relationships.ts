import pg from "pg";

type Pool = InstanceType<typeof pg.Pool>;
type Row = Record<string, unknown>;
type TermLink = {
  stagingId: string;
  runId: string;
  sourceRecordId: string;
  objectId: string;
  termTaxonomyId: string;
  termOrder: number | null;
  raw: Row;
};
type TermRecord = {
  stagingId: string;
  termId: string;
  termTaxonomyId: string;
  taxonomy: string;
  slug: string;
  name: string;
  description: string;
  targetEntity: string;
  raw: Row;
  mapped: Row;
};
type ObjectRecord = {
  objectId: string;
  targetEntity: string;
  slug: string;
  title: string;
  stagingId: string;
};
type ResolvedObject =
  | { kind: "artist"; table: "registry_artists"; id: string; slug: string; title: string }
  | { kind: "track"; table: "registry_tracks"; id: string; slug: string; title: string }
  | { kind: "release"; table: "registry_releases"; id: string; slug: string; title: string }
  | { kind: "label"; table: "registry_labels"; id: string; slug: string; title: string }
  | { kind: "content"; table: "wk_content_items"; id: string; slug: string; title: string }
  | { kind: "wakilisha_entity"; table: "wk_wakilisha_entities"; id: string; slug: string; title: string; entityType: string };
type ResolvedTerm = {
  id: string | null;
  taxonomy: string;
  slug: string;
  name: string;
};
type Summary = {
  scanned: number;
  artistGenres: number;
  artistTerms: number;
  contentTerms: number;
  registryTerms: number;
  unresolved: number;
  unknownTaxonomy: number;
};

const ARTIST_GENRE_TAXONOMIES = new Set(["wk_artist_genre", "artist_genre", "genre", "music_genre"]);
const ARTIST_ORIGIN_TAXONOMIES = new Set(["wk_artist_origin", "artist_origin", "origin"]);
const CONTENT_TAXONOMIES = new Set(["category", "post_tag", "series", "section"]);
const REGISTRY_ENTITY_TARGETS = new Set(["artists", "tracks", "releases", "labels", "genres"]);

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

function intValue(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function slugify(value: unknown): string {
  return text(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "term";
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

async function hasTable(pool: Pool, tableName: string): Promise<boolean> {
  const result = await pool.query("select to_regclass($1) as table_name", [tableName]);
  return Boolean(result.rows[0]?.table_name);
}

async function ensureTables(pool: Pool): Promise<void> {
  await pool.query(`
    create table if not exists registry_artist_genres (
      id uuid primary key default gen_random_uuid(),
      artist_id uuid not null references registry_artists(id) on delete cascade,
      genre_id uuid not null references registry_genres(id) on delete cascade,
      source_ingestion_run_id uuid,
      source_staging_record_id uuid,
      source_record_id text,
      metadata jsonb not null default '{}'::jsonb,
      status text not null default 'active',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await pool.query(`create unique index if not exists registry_artist_genres_artist_genre_uidx on registry_artist_genres(artist_id, genre_id)`);
  await pool.query(`create unique index if not exists registry_artist_genres_source_uidx on registry_artist_genres(source_staging_record_id) where source_staging_record_id is not null`);

  await pool.query(`
    create table if not exists content_item_terms (
      id uuid primary key default gen_random_uuid(),
      content_item_id uuid not null references wk_content_items(id) on delete cascade,
      taxonomy text not null,
      term_id uuid,
      term_slug text not null,
      term_name text not null,
      term_order integer,
      source_ingestion_run_id uuid,
      source_staging_record_id uuid,
      source_record_id text,
      metadata jsonb not null default '{}'::jsonb,
      status text not null default 'active',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await pool.query(`create unique index if not exists content_item_terms_content_tax_slug_uidx on content_item_terms(content_item_id, taxonomy, term_slug)`);
  await pool.query(`create unique index if not exists content_item_terms_source_uidx on content_item_terms(source_staging_record_id) where source_staging_record_id is not null`);

  await pool.query(`
    create table if not exists registry_entity_terms (
      id uuid primary key default gen_random_uuid(),
      entity_table text not null,
      entity_id uuid not null,
      entity_slug text,
      entity_title text,
      taxonomy text not null,
      term_id uuid,
      term_slug text not null,
      term_name text not null,
      term_order integer,
      source_ingestion_run_id uuid,
      source_staging_record_id uuid,
      source_record_id text,
      metadata jsonb not null default '{}'::jsonb,
      status text not null default 'active',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await pool.query(`create unique index if not exists registry_entity_terms_entity_tax_slug_uidx on registry_entity_terms(entity_table, entity_id, taxonomy, term_slug)`);
  await pool.query(`create unique index if not exists registry_entity_terms_source_uidx on registry_entity_terms(source_staging_record_id) where source_staging_record_id is not null`);

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
  await pool.query(`create unique index if not exists entity_resolution_term_relationship_source_uidx on entity_resolution_decisions(entity_type, source_staging_record_id) where entity_type = 'term_relationship' and source_staging_record_id is not null`);
}

async function getRunIds(pool: Pool): Promise<string[]> {
  const jobId = arg("--job");
  if (jobId) return [jobId];
  const limit = Number(arg("--limit") || 5);
  const result = await pool.query(
    "select distinct ingestion_run_id::text as id from wk_import_staging_records where target_entity = 'entity_relationships' and source_file = 'mysql.wp_term_relationships' order by ingestion_run_id::text desc limit $1",
    [limit],
  );
  return result.rows.map((row) => String(row.id));
}

async function loadLinks(pool: Pool, runId: string): Promise<TermLink[]> {
  const result = await pool.query(`
    select id::text, ingestion_run_id::text, source_record_id, raw_record
    from wk_import_staging_records
    where ingestion_run_id = $1
      and target_entity = 'entity_relationships'
      and source_file = 'mysql.wp_term_relationships'
  `, [runId]);

  return result.rows.map((row) => {
    const raw = parsePayload(row.raw_record);
    return {
      stagingId: String(row.id),
      runId: String(row.ingestion_run_id),
      sourceRecordId: firstText(row.source_record_id, raw.object_id, raw.term_taxonomy_id),
      objectId: firstText(raw.object_id),
      termTaxonomyId: firstText(raw.term_taxonomy_id),
      termOrder: intValue(raw.term_order),
      raw,
    };
  }).filter((link) => link.objectId && link.termTaxonomyId);
}

async function loadTerms(pool: Pool, runId: string): Promise<Map<string, TermRecord>> {
  const result = await pool.query(`
    select id::text, source_record_id, target_entity, target_slug, title, body, raw_record, mapped_record
    from wk_import_staging_records
    where ingestion_run_id = $1
      and target_entity in ('taxonomy_terms', 'artist_taxonomy_terms')
  `, [runId]);
  const terms = new Map<string, TermRecord>();
  for (const row of result.rows) {
    const raw = parsePayload(row.raw_record);
    const mapped = parsePayload(row.mapped_record);
    const termTaxonomyId = firstText(raw.term_taxonomy_id, mapped.term_taxonomy_id);
    if (!termTaxonomyId) continue;
    terms.set(termTaxonomyId, {
      stagingId: String(row.id),
      termId: firstText(row.source_record_id, raw.term_id),
      termTaxonomyId,
      taxonomy: firstText(mapped.taxonomy, raw.taxonomy, "term"),
      slug: firstText(row.target_slug, mapped.slug, raw.slug, slugify(row.title)),
      name: firstText(row.title, raw.name, mapped.name),
      description: firstText(row.body, raw.description),
      targetEntity: firstText(row.target_entity),
      raw,
      mapped,
    });
  }
  return terms;
}

async function loadObjects(pool: Pool, runId: string): Promise<Map<string, ObjectRecord>> {
  const result = await pool.query(`
    select id::text, source_record_id, target_entity, target_slug, title
    from wk_import_staging_records
    where ingestion_run_id = $1
      and source_record_id is not null
      and target_entity not in ('entity_relationships', 'custom_fields', 'taxonomy_terms', 'artist_taxonomy_terms')
  `, [runId]);
  const objects = new Map<string, ObjectRecord>();
  for (const row of result.rows) {
    const objectId = firstText(row.source_record_id);
    if (!objectId || objects.has(objectId)) continue;
    objects.set(objectId, {
      objectId,
      targetEntity: firstText(row.target_entity),
      slug: firstText(row.target_slug),
      title: firstText(row.title),
      stagingId: String(row.id),
    });
  }
  return objects;
}

async function resolveRegistryByMetadata(pool: Pool, tableName: string, objectId: string): Promise<ResolvedObject | null> {
  if (!(await hasTable(pool, tableName))) return null;
  const titleColumn = tableName === "registry_artists" ? "display_name" : tableName === "registry_labels" || tableName === "registry_genres" ? "name" : "title";
  const kind = tableName === "registry_artists" ? "artist" : tableName === "registry_tracks" ? "track" : tableName === "registry_releases" ? "release" : tableName === "registry_labels" ? "label" : "wakilisha_entity";
  const result = await pool.query(`
    select id::text, slug, ${titleColumn} as title
    from ${tableName}
    where metadata::text like $1
    order by updated_at desc nulls last
    limit 1
  `, [`%${objectId}%`]);
  const row = result.rows[0];
  if (!row) return null;
  if (tableName === "registry_artists") return { kind: "artist", table: "registry_artists", id: String(row.id), slug: firstText(row.slug), title: firstText(row.title) };
  if (tableName === "registry_tracks") return { kind: "track", table: "registry_tracks", id: String(row.id), slug: firstText(row.slug), title: firstText(row.title) };
  if (tableName === "registry_releases") return { kind: "release", table: "registry_releases", id: String(row.id), slug: firstText(row.slug), title: firstText(row.title) };
  if (tableName === "registry_labels") return { kind: "label", table: "registry_labels", id: String(row.id), slug: firstText(row.slug), title: firstText(row.title) };
  return null;
}

async function resolveObject(pool: Pool, object: ObjectRecord | undefined): Promise<ResolvedObject | null> {
  if (!object) return null;
  if (["articles", "pages"].includes(object.targetEntity) && await hasTable(pool, "wk_content_items")) {
    const result = await pool.query("select id::text, slug, title from wk_content_items where source_record_id = $1 order by updated_at desc nulls last limit 1", [object.objectId]);
    const row = result.rows[0];
    if (row) return { kind: "content", table: "wk_content_items", id: String(row.id), slug: firstText(row.slug), title: firstText(row.title) };
  }
  if (object.targetEntity === "artists") return resolveRegistryByMetadata(pool, "registry_artists", object.objectId);
  if (object.targetEntity === "tracks") return resolveRegistryByMetadata(pool, "registry_tracks", object.objectId);
  if (object.targetEntity === "releases") return resolveRegistryByMetadata(pool, "registry_releases", object.objectId);
  if (object.targetEntity === "labels") return resolveRegistryByMetadata(pool, "registry_labels", object.objectId);
  if (object.targetEntity === "genres") return resolveRegistryByMetadata(pool, "registry_genres", object.objectId);
  if (await hasTable(pool, "wk_wakilisha_entities")) {
    const result = await pool.query("select id::text, entity_type, slug, title from wk_wakilisha_entities where source_record_id = $1 order by updated_at desc nulls last limit 1", [object.objectId]);
    const row = result.rows[0];
    if (row) return { kind: "wakilisha_entity", table: "wk_wakilisha_entities", id: String(row.id), slug: firstText(row.slug), title: firstText(row.title), entityType: firstText(row.entity_type) };
  }
  return null;
}

async function resolveTerm(pool: Pool, term: TermRecord): Promise<ResolvedTerm> {
  if (ARTIST_GENRE_TAXONOMIES.has(term.taxonomy) && await hasTable(pool, "registry_genres")) {
    const result = await pool.query("select id::text, slug, name from registry_genres where slug = $1 or name = $2 order by updated_at desc nulls last limit 1", [term.slug, term.name]);
    const row = result.rows[0];
    if (row) return { id: String(row.id), taxonomy: term.taxonomy, slug: firstText(row.slug), name: firstText(row.name) };
    if (hasFlag("--create-missing-genres") && !hasFlag("--dry-run")) {
      const inserted = await pool.query(`
        insert into registry_genres (slug, name, description, status, metadata, created_at, updated_at)
        values ($1, $2, nullif($3, ''), 'needs_review', $4::jsonb, now(), now())
        on conflict (slug) do update set name = excluded.name, description = coalesce(registry_genres.description, excluded.description), updated_at = now()
        returning id::text, slug, name
      `, [term.slug, term.name, term.description, JSON.stringify({ source: "resolve-wordpress-term-relationships", taxonomy: term.taxonomy, term_id: term.termId, term_taxonomy_id: term.termTaxonomyId })]);
      const created = inserted.rows[0];
      return { id: String(created.id), taxonomy: term.taxonomy, slug: firstText(created.slug), name: firstText(created.name) };
    }
  }

  if (await hasTable(pool, "wk_taxonomy_terms")) {
    const result = await pool.query("select id::text, taxonomy, slug, name from wk_taxonomy_terms where source_record_id = $1 or slug = $2 order by updated_at desc nulls last limit 1", [term.termId, term.slug]);
    const row = result.rows[0];
    if (row) return { id: String(row.id), taxonomy: firstText(row.taxonomy, term.taxonomy), slug: firstText(row.slug, term.slug), name: firstText(row.name, term.name) };
  }

  return { id: null, taxonomy: term.taxonomy, slug: term.slug, name: term.name };
}

async function queueDecision(pool: Pool, link: TermLink, term: TermRecord | undefined, object: ObjectRecord | undefined, resolvedObject: ResolvedObject | null, reason: string): Promise<void> {
  await pool.query(`
    insert into entity_resolution_decisions (
      entity_type, source_table, source_kind, source_record_id, source_staging_record_id, source_title,
      target_table, target_id, target_slug, target_title, confidence_score, decision, status, review_required,
      reason, candidate_payload, source_payload, updated_at
    ) values (
      'term_relationship', 'wk_import_staging_records', 'wordpress_database', $1, $2::uuid, $3,
      $4, $5, $6, $7, 0, 'term_relationship_review', 'open', true,
      $8, $9::jsonb, $10::jsonb, now()
    )
    on conflict (entity_type, source_staging_record_id) where entity_type = 'term_relationship' and source_staging_record_id is not null
    do update set
      target_table = excluded.target_table,
      target_id = excluded.target_id,
      target_slug = excluded.target_slug,
      target_title = excluded.target_title,
      reason = excluded.reason,
      candidate_payload = excluded.candidate_payload,
      source_payload = excluded.source_payload,
      updated_at = now()
  `, [
    link.sourceRecordId,
    link.stagingId,
    `object:${link.objectId} term_taxonomy:${link.termTaxonomyId}`,
    resolvedObject?.table ?? null,
    resolvedObject?.id ?? null,
    resolvedObject?.slug ?? null,
    resolvedObject?.title ?? null,
    reason,
    JSON.stringify({ term, object, resolvedObject }),
    JSON.stringify(link),
  ]);
}

async function promoteArtistGenre(pool: Pool, link: TermLink, object: ResolvedObject, term: ResolvedTerm, termRecord: TermRecord): Promise<void> {
  if (object.kind !== "artist" || !term.id) return;
  await pool.query(`
    insert into registry_artist_genres (artist_id, genre_id, source_ingestion_run_id, source_staging_record_id, source_record_id, metadata, status, updated_at)
    values ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6::jsonb, 'active', now())
    on conflict (artist_id, genre_id) do update set
      source_ingestion_run_id = excluded.source_ingestion_run_id,
      source_staging_record_id = excluded.source_staging_record_id,
      source_record_id = excluded.source_record_id,
      metadata = registry_artist_genres.metadata || excluded.metadata,
      status = 'active',
      updated_at = now()
  `, [object.id, term.id, link.runId, link.stagingId, link.sourceRecordId, JSON.stringify({ source: "resolve-wordpress-term-relationships", taxonomy: termRecord.taxonomy, term_taxonomy_id: link.termTaxonomyId, object_id: link.objectId })]);
}

async function promoteContentTerm(pool: Pool, link: TermLink, object: ResolvedObject, term: ResolvedTerm, termRecord: TermRecord): Promise<void> {
  if (object.kind !== "content") return;
  await pool.query(`
    insert into content_item_terms (content_item_id, taxonomy, term_id, term_slug, term_name, term_order, source_ingestion_run_id, source_staging_record_id, source_record_id, metadata, status, updated_at)
    values ($1::uuid, $2, $3::uuid, $4, $5, $6, $7::uuid, $8::uuid, $9, $10::jsonb, 'active', now())
    on conflict (content_item_id, taxonomy, term_slug) do update set
      term_id = coalesce(content_item_terms.term_id, excluded.term_id),
      term_name = excluded.term_name,
      term_order = excluded.term_order,
      source_ingestion_run_id = excluded.source_ingestion_run_id,
      source_staging_record_id = excluded.source_staging_record_id,
      source_record_id = excluded.source_record_id,
      metadata = content_item_terms.metadata || excluded.metadata,
      status = 'active',
      updated_at = now()
  `, [object.id, term.taxonomy, term.id, term.slug, term.name, link.termOrder, link.runId, link.stagingId, link.sourceRecordId, JSON.stringify({ source: "resolve-wordpress-term-relationships", term_taxonomy_id: link.termTaxonomyId, object_id: link.objectId, term_record: termRecord })]);
}

async function promoteRegistryTerm(pool: Pool, link: TermLink, object: ResolvedObject, term: ResolvedTerm, termRecord: TermRecord): Promise<void> {
  await pool.query(`
    insert into registry_entity_terms (entity_table, entity_id, entity_slug, entity_title, taxonomy, term_id, term_slug, term_name, term_order, source_ingestion_run_id, source_staging_record_id, source_record_id, metadata, status, updated_at)
    values ($1, $2::uuid, $3, $4, $5, $6::uuid, $7, $8, $9, $10::uuid, $11::uuid, $12, $13::jsonb, 'active', now())
    on conflict (entity_table, entity_id, taxonomy, term_slug) do update set
      entity_slug = excluded.entity_slug,
      entity_title = excluded.entity_title,
      term_id = coalesce(registry_entity_terms.term_id, excluded.term_id),
      term_name = excluded.term_name,
      term_order = excluded.term_order,
      source_ingestion_run_id = excluded.source_ingestion_run_id,
      source_staging_record_id = excluded.source_staging_record_id,
      source_record_id = excluded.source_record_id,
      metadata = registry_entity_terms.metadata || excluded.metadata,
      status = 'active',
      updated_at = now()
  `, [object.table, object.id, object.slug, object.title, term.taxonomy, term.id, term.slug, term.name, link.termOrder, link.runId, link.stagingId, link.sourceRecordId, JSON.stringify({ source: "resolve-wordpress-term-relationships", object_kind: object.kind, term_taxonomy_id: link.termTaxonomyId, object_id: link.objectId, term_record: termRecord })]);
}

async function promotionEvent(pool: Pool, link: TermLink, targetTable: string, targetRecordId: string, message: string): Promise<void> {
  await pool.query(`
    insert into wk_import_promotion_events (ingestion_run_id, staging_record_id, target_table, target_record_id, event_type, message)
    values ($1::uuid, $2::uuid, $3, $4, 'promoted', $5)
  `, [link.runId, link.stagingId, targetTable, targetRecordId, message]);
}

async function resolveRun(pool: Pool, runId: string): Promise<Summary> {
  const [links, terms, objects] = await Promise.all([loadLinks(pool, runId), loadTerms(pool, runId), loadObjects(pool, runId)]);
  const summary: Summary = { scanned: links.length, artistGenres: 0, artistTerms: 0, contentTerms: 0, registryTerms: 0, unresolved: 0, unknownTaxonomy: 0 };

  for (const link of links) {
    const termRecord = terms.get(link.termTaxonomyId);
    const objectRecord = objects.get(link.objectId);
    const resolvedObject = await resolveObject(pool, objectRecord);

    if (hasFlag("--dry-run")) {
      const action = !termRecord || !resolvedObject
        ? "unresolved"
        : ARTIST_GENRE_TAXONOMIES.has(termRecord.taxonomy) && resolvedObject.kind === "artist"
          ? "artist_genre"
          : CONTENT_TAXONOMIES.has(termRecord.taxonomy) && resolvedObject.kind === "content"
            ? "content_term"
            : REGISTRY_ENTITY_TARGETS.has(objectRecord?.targetEntity ?? "") || ARTIST_ORIGIN_TAXONOMIES.has(termRecord.taxonomy)
              ? "registry_entity_term"
              : "review";
      console.log(`[term-resolve] dry-run object=${link.objectId} term_taxonomy=${link.termTaxonomyId} taxonomy=${termRecord?.taxonomy ?? '?'} objectKind=${resolvedObject?.kind ?? '?'} action=${action}`);
      continue;
    }

    if (!termRecord) {
      await queueDecision(pool, link, termRecord, objectRecord, resolvedObject, "Could not find staged term for term_taxonomy_id.");
      summary.unresolved++;
      continue;
    }
    if (!resolvedObject) {
      await queueDecision(pool, link, termRecord, objectRecord, resolvedObject, "Could not resolve WP object_id to a live content or registry record.");
      summary.unresolved++;
      continue;
    }

    const term = await resolveTerm(pool, termRecord);

    if (ARTIST_GENRE_TAXONOMIES.has(termRecord.taxonomy) && resolvedObject.kind === "artist") {
      if (!term.id) {
        await queueDecision(pool, link, termRecord, objectRecord, resolvedObject, "Artist genre term has no matching registry_genres row. Re-run with --create-missing-genres or classify manually.");
        summary.unresolved++;
        continue;
      }
      await promoteArtistGenre(pool, link, resolvedObject, term, termRecord);
      await promotionEvent(pool, link, "registry_artist_genres", `${resolvedObject.id}:${term.id}`, `Phase 4 promoted artist genre ${resolvedObject.title} → ${term.name}.`);
      summary.artistGenres++;
      continue;
    }

    if (CONTENT_TAXONOMIES.has(termRecord.taxonomy) && resolvedObject.kind === "content") {
      await promoteContentTerm(pool, link, resolvedObject, term, termRecord);
      await promotionEvent(pool, link, "content_item_terms", `${resolvedObject.id}:${term.taxonomy}:${term.slug}`, `Phase 4 promoted content term ${resolvedObject.title} → ${term.name}.`);
      summary.contentTerms++;
      continue;
    }

    if (resolvedObject.kind !== "content") {
      await promoteRegistryTerm(pool, link, resolvedObject, term, termRecord);
      await promotionEvent(pool, link, "registry_entity_terms", `${resolvedObject.table}:${resolvedObject.id}:${term.taxonomy}:${term.slug}`, `Phase 4 promoted registry/entity term ${resolvedObject.title} → ${term.name}.`);
      if (resolvedObject.kind === "artist") summary.artistTerms++; else summary.registryTerms++;
      continue;
    }

    await queueDecision(pool, link, termRecord, objectRecord, resolvedObject, `Taxonomy ${termRecord.taxonomy} is not enabled for automatic promotion for ${resolvedObject.kind}.`);
    summary.unknownTaxonomy++;
  }

  if (!hasFlag("--dry-run")) {
    await pool.query(`
      update wk_ingestion_runs
      set source_manifest = jsonb_set(coalesce(source_manifest, '{}'::jsonb), '{term_relationship_resolution}', $2::jsonb, true),
          warnings = array_remove(array_append(coalesce(warnings, '{}'::text[]), $3), null)
      where id = $1
    `, [runId, JSON.stringify({ resolved_at: new Date().toISOString(), processor: "resolve-wordpress-term-relationships", version: "0.1.0", summary }), `Phase 4 term relationship resolution completed: ${summary.artistGenres + summary.artistTerms + summary.contentTerms + summary.registryTerms} promoted, ${summary.unresolved + summary.unknownTaxonomy} queued.`]);
  }

  return summary;
}

async function main(): Promise<void> {
  const pool = createPool();
  try {
    await ensureTables(pool);
    const runIds = await getRunIds(pool);
    if (!runIds.length) {
      console.log("[term-resolve] no WP term relationship staging records found");
      return;
    }
    for (const runId of runIds) {
      const summary = await resolveRun(pool, runId);
      console.log(`[term-resolve] ${runId}: scanned=${summary.scanned} artistGenres=${summary.artistGenres} artistTerms=${summary.artistTerms} contentTerms=${summary.contentTerms} registryTerms=${summary.registryTerms} unresolved=${summary.unresolved} unknownTaxonomy=${summary.unknownTaxonomy}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[term-resolve] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
