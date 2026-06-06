import pg from "pg";

type Pool = InstanceType<typeof pg.Pool>;
type ColumnSet = Set<string>;
type PromotionTarget = {
  targetEntity: "artists" | "tracks" | "releases" | "labels" | "genres";
  tableName: "registry_artists" | "registry_tracks" | "registry_releases" | "registry_labels" | "registry_genres";
  requiredColumns: string[];
  build: (columns: ColumnSet) => FieldSpec[];
};
type FieldSpec = { column: string; expression: string; update?: boolean };
type PromotionSummary = Record<string, { inserted_or_updated: number; staged_ready: number }>;

const TARGETS: PromotionTarget[] = [
  {
    targetEntity: "artists",
    tableName: "registry_artists",
    requiredColumns: ["slug", "display_name", "normalized_name", "status"],
    build: (columns) => [
      field(columns, "slug", "s.target_slug"),
      field(columns, "display_name", "s.title"),
      field(columns, "normalized_name", "normalize_text(s.title)"),
      field(columns, "bio", "nullif(s.body, '')"),
      field(columns, "artist_type", "nullif(s.mapped_record->>'artist_type', '')"),
      field(columns, "origin_iso2", "nullif(coalesce(s.mapped_record->>'origin_iso2', s.mapped_record->>'origin', s.mapped_record->>'country'), '')"),
      field(columns, "public_image_url", "nullif(coalesce(s.mapped_record->>'image_url', s.mapped_record->>'public_image_url', s.source_url), '')"),
      field(columns, "status", "case when lower(coalesce(s.raw_record->>'status', s.mapped_record->>'status', 'publish')) in ('draft','pending','private') then 'needs_review' else 'active' end"),
      field(columns, "metadata", "jsonb_strip_nulls(jsonb_build_object('source', 'wordpress_registry_promotion', 'wordpress_id', s.source_record_id, 'source_entity', s.source_entity, 'mapped_record', s.mapped_record, 'raw_record', s.raw_record))"),
      field(columns, "updated_at", "now()"),
      field(columns, "created_at", "now()", false),
    ],
  },
  {
    targetEntity: "tracks",
    tableName: "registry_tracks",
    requiredColumns: ["slug", "title", "normalized_title", "status"],
    build: (columns) => [
      field(columns, "slug", "s.target_slug"),
      field(columns, "title", "s.title"),
      field(columns, "normalized_title", "normalize_text(s.title)"),
      field(columns, "isrc", "nullif(s.mapped_record->>'isrc', '')"),
      field(columns, "duration_ms", "duration_to_ms(s.mapped_record->>'duration')"),
      field(columns, "explicit", "text_to_bool(s.mapped_record->>'explicit')"),
      field(columns, "artwork_url", "nullif(coalesce(s.mapped_record->>'artwork_url', s.mapped_record->>'cover_url', s.mapped_record->>'image_url'), '')"),
      field(columns, "preview_url", "nullif(coalesce(s.mapped_record->>'preview_url', s.mapped_record->>'audio_url'), '')"),
      field(columns, "status", "case when lower(coalesce(s.raw_record->>'status', s.mapped_record->>'status', 'publish')) in ('draft','pending','private') then 'needs_review' else 'active' end"),
      field(columns, "metadata", "jsonb_strip_nulls(jsonb_build_object('source', 'wordpress_registry_promotion', 'wordpress_id', s.source_record_id, 'source_entity', s.source_entity, 'artist_id', s.mapped_record->>'artist_id', 'release_id', s.mapped_record->>'release_id', 'genre_id', s.mapped_record->>'genre_id', 'spotify_id', s.mapped_record->>'spotify_id', 'apple_music_id', s.mapped_record->>'apple_music_id', 'youtube_id', s.mapped_record->>'youtube_id', 'mapped_record', s.mapped_record, 'raw_record', s.raw_record))"),
      field(columns, "updated_at", "now()"),
      field(columns, "created_at", "now()", false),
    ],
  },
  {
    targetEntity: "releases",
    tableName: "registry_releases",
    requiredColumns: ["slug", "title", "normalized_title", "status"],
    build: (columns) => [
      field(columns, "slug", "s.target_slug"),
      field(columns, "title", "s.title"),
      field(columns, "normalized_title", "normalize_text(s.title)"),
      field(columns, "release_type", "nullif(coalesce(s.mapped_record->>'type', s.raw_record->>'type'), '')"),
      field(columns, "release_date", "safe_date(coalesce(s.raw_record->>'release_date', s.published_at::text))"),
      field(columns, "artwork_url", "nullif(coalesce(s.mapped_record->>'cover_url', s.mapped_record->>'artwork_url', s.raw_record->>'cover_url'), '')"),
      field(columns, "description", "nullif(s.body, '')"),
      field(columns, "status", "case when lower(coalesce(s.raw_record->>'status', s.mapped_record->>'status', 'publish')) in ('draft','pending','private') then 'needs_review' else 'active' end"),
      field(columns, "metadata", "jsonb_strip_nulls(jsonb_build_object('source', 'wordpress_registry_promotion', 'wordpress_id', s.source_record_id, 'source_entity', s.source_entity, 'artist_id', s.mapped_record->>'artist_id', 'label_id', s.mapped_record->>'label_id', 'upc', s.mapped_record->>'upc', 'catalog_number', s.mapped_record->>'catalog_number', 'track_count', s.mapped_record->>'track_count', 'mapped_record', s.mapped_record, 'raw_record', s.raw_record))"),
      field(columns, "updated_at", "now()"),
      field(columns, "created_at", "now()", false),
    ],
  },
  {
    targetEntity: "labels",
    tableName: "registry_labels",
    requiredColumns: ["slug", "name", "normalized_name", "status"],
    build: (columns) => [
      field(columns, "slug", "s.target_slug"),
      field(columns, "name", "s.title"),
      field(columns, "normalized_name", "normalize_text(s.title)"),
      field(columns, "description", "nullif(s.body, '')"),
      field(columns, "country_code", "nullif(coalesce(s.mapped_record->>'country_code', s.mapped_record->>'country'), '')"),
      field(columns, "status", "case when lower(coalesce(s.raw_record->>'status', s.mapped_record->>'status', 'publish')) in ('draft','pending','private') then 'needs_review' else 'active' end"),
      field(columns, "metadata", "jsonb_strip_nulls(jsonb_build_object('source', 'wordpress_registry_promotion', 'wordpress_id', s.source_record_id, 'source_entity', s.source_entity, 'logo_url', coalesce(s.mapped_record->>'logo_url', s.raw_record->>'logo_url'), 'website', coalesce(s.source_url, s.raw_record->>'website'), 'founded_year', s.mapped_record->>'founded_year', 'parent_label_id', s.mapped_record->>'parent_label_id', 'mapped_record', s.mapped_record, 'raw_record', s.raw_record))"),
      field(columns, "updated_at", "now()"),
      field(columns, "created_at", "now()", false),
    ],
  },
  {
    targetEntity: "genres",
    tableName: "registry_genres",
    requiredColumns: ["slug", "name", "status"],
    build: (columns) => [
      field(columns, "slug", "s.target_slug"),
      field(columns, "name", "s.title"),
      field(columns, "description", "nullif(s.body, '')"),
      field(columns, "status", "case when lower(coalesce(s.raw_record->>'status', s.mapped_record->>'status', 'publish')) in ('draft','pending','private') then 'draft' else 'active' end"),
      field(columns, "metadata", "jsonb_strip_nulls(jsonb_build_object('source', 'wordpress_registry_promotion', 'wordpress_id', s.source_record_id, 'source_entity', s.source_entity, 'parent_id', s.mapped_record->>'parent_id', 'color', s.mapped_record->>'color', 'icon', s.mapped_record->>'icon', 'mapped_record', s.mapped_record, 'raw_record', s.raw_record))"),
      field(columns, "updated_at", "now()"),
      field(columns, "created_at", "now()", false),
    ],
  },
];

function field(columns: ColumnSet, column: string, expression: string, update = true): FieldSpec {
  return { column, expression, update };
}

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

async function getRunIds(pool: Pool): Promise<string[]> {
  const jobId = arg("--job");
  if (jobId) return [jobId];
  const limit = Number(arg("--limit") || 5);
  const statuses = hasFlag("--staged-only") ? ["staged"] : ["staged", "finalized", "completed"];
  const result = await pool.query(
    "select id::text from wk_ingestion_runs where source_kind in ($1,$2) and status = any($3::text[]) order by created_at desc limit $4",
    ["wordpress_export_zip", "wordpress_database", statuses, limit],
  );
  return result.rows.map((row) => row.id);
}

async function tableColumns(pool: Pool, tableName: string): Promise<ColumnSet> {
  const result = await pool.query("select column_name from information_schema.columns where table_schema = current_schema() and table_name = $1", [tableName]);
  return new Set(result.rows.map((row) => String(row.column_name)));
}

async function hasTable(pool: Pool, tableName: string): Promise<boolean> {
  const result = await pool.query("select to_regclass($1) as table_name", [tableName]);
  return Boolean(result.rows[0]?.table_name);
}

async function hasUniqueSlug(pool: Pool, tableName: string): Promise<boolean> {
  const result = await pool.query(`
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join unnest(c.conkey) with ordinality as cols(attnum, ord) on true
    join pg_attribute a on a.attrelid = t.oid and a.attnum = cols.attnum
    where n.nspname = current_schema()
      and t.relname = $1
      and c.contype in ('u','p')
    group by c.oid
    having array_agg(a.attname order by cols.ord) = array['slug']::name[]
    limit 1
  `, [tableName]);
  return Boolean(result.rowCount);
}

async function ensureHelpers(pool: Pool): Promise<void> {
  await pool.query(`
    create or replace function normalize_text(value text) returns text
    language sql immutable as $$
      select nullif(lower(regexp_replace(trim(coalesce(value, '')), '[^a-z0-9]+', ' ', 'g')), '')
    $$;
  `);
  await pool.query(`
    create or replace function text_to_bool(value text) returns boolean
    language sql immutable as $$
      select case
        when value is null or trim(value) = '' then null
        when lower(trim(value)) in ('1','true','yes','y','explicit') then true
        when lower(trim(value)) in ('0','false','no','n','clean') then false
        else null
      end
    $$;
  `);
  await pool.query(`
    create or replace function duration_to_ms(value text) returns integer
    language plpgsql immutable as $$
    declare
      parts text[];
      seconds numeric;
    begin
      if value is null or trim(value) = '' then return null; end if;
      if value ~ '^\\d+$' then
        seconds := value::numeric;
        if seconds > 10000 then return seconds::integer; end if;
        return (seconds * 1000)::integer;
      end if;
      if value ~ '^\\d+:\\d{1,2}$' then
        parts := string_to_array(value, ':');
        return (((parts[1])::integer * 60 + (parts[2])::integer) * 1000)::integer;
      end if;
      return null;
    exception when others then
      return null;
    end
    $$;
  `);
  await pool.query(`
    create or replace function safe_date(value text) returns date
    language plpgsql immutable as $$
    begin
      if value is null or trim(value) = '' then return null; end if;
      return value::date;
    exception when others then
      return null;
    end
    $$;
  `);
}

async function readyCount(pool: Pool, runId: string, targetEntity: string): Promise<number> {
  const result = await pool.query(
    "select count(*)::int as count from wk_import_staging_records where ingestion_run_id = $1 and target_entity = $2 and target_status = 'ready' and target_slug is not null and title is not null",
    [runId, targetEntity],
  );
  return Number(result.rows[0]?.count ?? 0);
}

function buildInsertSql(target: PromotionTarget, fields: FieldSpec[], uniqueSlug: boolean): string {
  const insertColumns = fields.map((f) => f.column);
  const selectExpressions = fields.map((f) => `${f.expression} as ${f.column}`);
  const updateFields = fields.filter((f) => f.update && !["slug", "created_at"].includes(f.column));
  const updateSet = updateFields.map((f) => `${f.column} = coalesce(excluded.${f.column}, ${target.tableName}.${f.column})`).join(", ");

  if (uniqueSlug) {
    return `
      insert into ${target.tableName} (${insertColumns.join(", ")})
      select ${selectExpressions.join(", ")}
      from wk_import_staging_records s
      where s.ingestion_run_id = $1
        and s.target_entity = $2
        and s.target_status = 'ready'
        and s.target_slug is not null
        and s.title is not null
      on conflict (slug) do update set ${updateSet || "slug = excluded.slug"}
    `;
  }

  return `
    insert into ${target.tableName} (${insertColumns.join(", ")})
    select ${selectExpressions.join(", ")}
    from wk_import_staging_records s
    where s.ingestion_run_id = $1
      and s.target_entity = $2
      and s.target_status = 'ready'
      and s.target_slug is not null
      and s.title is not null
      and not exists (select 1 from ${target.tableName} existing where existing.slug = s.target_slug)
  `;
}

async function promoteTarget(pool: Pool, runId: string, target: PromotionTarget): Promise<{ inserted_or_updated: number; staged_ready: number }> {
  if (!(await hasTable(pool, target.tableName))) {
    console.warn(`[registry-promote] ${target.tableName} skipped: table does not exist`);
    return { inserted_or_updated: 0, staged_ready: 0 };
  }

  const columns = await tableColumns(pool, target.tableName);
  const missing = target.requiredColumns.filter((column) => !columns.has(column));
  if (missing.length) {
    console.warn(`[registry-promote] ${target.tableName} skipped: missing required column(s): ${missing.join(", ")}`);
    return { inserted_or_updated: 0, staged_ready: await readyCount(pool, runId, target.targetEntity) };
  }

  const fields = target.build(columns).filter((spec) => columns.has(spec.column));
  const uniqueSlug = await hasUniqueSlug(pool, target.tableName);
  const sql = buildInsertSql(target, fields, uniqueSlug);
  const stagedReady = await readyCount(pool, runId, target.targetEntity);
  if (hasFlag("--dry-run")) {
    console.log(`[registry-promote] dry-run ${target.targetEntity} → ${target.tableName}: ${stagedReady} ready row(s), ${uniqueSlug ? "upsert" : "insert-missing-only"}`);
    return { inserted_or_updated: 0, staged_ready: stagedReady };
  }

  const result = await pool.query(sql, [runId, target.targetEntity]);
  await pool.query(`
    insert into wk_import_promotion_events (ingestion_run_id, staging_record_id, target_table, target_record_id, event_type, message)
    select s.ingestion_run_id, s.id, $3, t.slug, 'promoted', $4
    from wk_import_staging_records s
    join ${target.tableName} t on t.slug = s.target_slug
    where s.ingestion_run_id = $1 and s.target_entity = $2 and s.target_status = 'ready'
  `, [runId, target.targetEntity, target.tableName, `Phase 1 promoted ${target.targetEntity} into ${target.tableName}.`]);

  return { inserted_or_updated: result.rowCount ?? 0, staged_ready: stagedReady };
}

async function promoteRun(pool: Pool, runId: string): Promise<PromotionSummary> {
  const run = await pool.query("select id, status from wk_ingestion_runs where id = $1", [runId]);
  if (!run.rowCount) throw new Error(`Import job ${runId} was not found.`);
  const status = String(run.rows[0].status ?? "");
  if (!["staged", "finalized", "completed"].includes(status) && !hasFlag("--force")) {
    throw new Error(`Import job ${runId} must be staged/finalized before registry promotion. Current status: ${status}`);
  }

  await ensureHelpers(pool);
  const summary: PromotionSummary = {};
  for (const target of TARGETS) {
    const result = await promoteTarget(pool, runId, target);
    summary[target.targetEntity] = result;
    console.log(`[registry-promote] ${runId}: ${target.targetEntity} → ${target.tableName}: ${result.inserted_or_updated} inserted/updated from ${result.staged_ready} ready`);
  }

  if (!hasFlag("--dry-run")) {
    const promoted = Object.values(summary).reduce((sum, item) => sum + item.inserted_or_updated, 0);
    await pool.query(`
      update wk_ingestion_runs
      set source_manifest = jsonb_set(coalesce(source_manifest, '{}'::jsonb), '{registry_promotion}', $2::jsonb, true),
          warnings = array_remove(array_append(coalesce(warnings, '{}'::text[]), $3), null)
      where id = $1
    `, [runId, JSON.stringify({ promoted_at: new Date().toISOString(), processor: "promote-wordpress-registry-entities", version: "0.1.0", promoted, counts_by_target_entity: summary }), `Phase 1 registry promotion completed: ${promoted} inserted/updated records.`]);
  }

  return summary;
}

async function main(): Promise<void> {
  const pool = createPool();
  try {
    const runIds = await getRunIds(pool);
    if (!runIds.length) {
      console.log("[registry-promote] no staged/finalized wordpress jobs found");
      return;
    }
    for (const runId of runIds) await promoteRun(pool, runId);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[registry-promote] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
