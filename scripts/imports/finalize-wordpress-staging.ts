import pg from "pg";

type Pool = InstanceType<typeof pg.Pool>;

type FinalizeSummary = {
  content_items: number;
  authors: number;
  taxonomy_terms: number;
  media_assets: number;
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
    return new pg.Pool({
      host: explicitHost,
      port: explicitPort,
      user: explicitUser,
      password: explicitPassword,
      database: explicitDatabase,
      ssl: { rejectUnauthorized: false },
      max: 4,
      connectionTimeoutMillis: 15000,
      query_timeout: 120000,
      statement_timeout: 120000,
    });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL or explicit PG* env vars are required.");
  return new pg.Pool({
    connectionString: normalizeDatabaseUrl(databaseUrl),
    ssl: { rejectUnauthorized: false },
    max: 4,
    connectionTimeoutMillis: 15000,
    query_timeout: 120000,
    statement_timeout: 120000,
  });
}

function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function getRunIds(pool: Pool): Promise<string[]> {
  const jobId = arg("--job");
  if (jobId) return [jobId];
  const limit = Number(arg("--limit") || 5);
  const result = await pool.query(
    "select id::text from wk_ingestion_runs where source_kind = $1 and status = $2 order by created_at asc limit $3",
    ["wordpress_export_zip", "staged", limit]
  );
  return result.rows.map((row) => row.id);
}

async function ensureRunIsStaged(pool: Pool, runId: string) {
  const result = await pool.query("select status from wk_ingestion_runs where id = $1", [runId]);
  if (!result.rowCount) throw new Error(`Import job ${runId} was not found.`);
  const status = result.rows[0].status;
  if (status !== "staged" && !process.argv.includes("--force")) {
    throw new Error(`Import job ${runId} must be staged before finalization. Current status: ${status}`);
  }
}

async function insertPromotionEvent(pool: Pool, runId: string, targetTable: string, targetEntity: string, message: string) {
  await pool.query(
    `insert into wk_import_promotion_events (ingestion_run_id, staging_record_id, target_table, target_record_id, event_type, message)
     select ingestion_run_id, id, $2, null, 'promoted', $4
     from wk_import_staging_records
     where ingestion_run_id = $1 and target_entity = $3 and target_status = 'ready'`,
    [runId, targetTable, targetEntity, message]
  );
}

async function finalizeContent(pool: Pool, runId: string): Promise<number> {
  const result = await pool.query(
    `insert into wk_content_items (content_type, slug, title, body, excerpt, status, published_at, author_name, source_url, source_kind, source_ingestion_run_id, source_staging_record_id, source_record_id, raw_record, mapped_record)
     select case when target_entity = 'pages' then 'page' else 'article' end, target_slug, title, body, excerpt, 'published', published_at, author_name, source_url, source_kind, ingestion_run_id, id, source_record_id, raw_record, mapped_record
     from wk_import_staging_records
     where ingestion_run_id = $1 and target_status = 'ready' and target_entity in ('articles','pages') and target_slug is not null and title is not null
     on conflict (source_staging_record_id) do update set title = excluded.title, body = excluded.body, excerpt = excluded.excerpt, updated_at = now()`,
    [runId]
  );
  await insertPromotionEvent(pool, runId, "wk_content_items", "articles", "Finalized ready article records.");
  await insertPromotionEvent(pool, runId, "wk_content_items", "pages", "Finalized ready page records.");
  return result.rowCount ?? 0;
}

async function finalizeAuthors(pool: Pool, runId: string): Promise<number> {
  const result = await pool.query(
    `insert into wk_authors (slug, name, email, url, source_kind, source_ingestion_run_id, source_staging_record_id, source_record_id, raw_record, mapped_record)
     select target_slug, title, mapped_record->>'email', mapped_record->>'url', source_kind, ingestion_run_id, id, source_record_id, raw_record, mapped_record
     from wk_import_staging_records
     where ingestion_run_id = $1 and target_status = 'ready' and target_entity = 'authors' and target_slug is not null and title is not null
     on conflict (source_staging_record_id) do update set name = excluded.name, email = excluded.email, url = excluded.url, updated_at = now()`,
    [runId]
  );
  await insertPromotionEvent(pool, runId, "wk_authors", "authors", "Finalized ready author records.");
  return result.rowCount ?? 0;
}

async function finalizeTerms(pool: Pool, runId: string): Promise<number> {
  const result = await pool.query(
    `insert into wk_taxonomy_terms (taxonomy, slug, name, description, source_kind, source_ingestion_run_id, source_staging_record_id, source_record_id, raw_record, mapped_record)
     select coalesce(nullif(mapped_record->>'taxonomy',''),'term'), target_slug, title, body, source_kind, ingestion_run_id, id, source_record_id, raw_record, mapped_record
     from wk_import_staging_records
     where ingestion_run_id = $1 and target_status = 'ready' and target_entity = 'taxonomy_terms' and target_slug is not null and title is not null
     on conflict (source_staging_record_id) do update set name = excluded.name, description = excluded.description, updated_at = now()`,
    [runId]
  );
  await insertPromotionEvent(pool, runId, "wk_taxonomy_terms", "taxonomy_terms", "Finalized ready taxonomy records.");
  return result.rowCount ?? 0;
}

async function finalizeMedia(pool: Pool, runId: string): Promise<number> {
  const result = await pool.query(
    `insert into wk_media_assets (slug, title, source_url, mime_type, status, source_kind, source_ingestion_run_id, source_staging_record_id, source_record_id, raw_record, mapped_record)
     select target_slug, title, source_url, mapped_record->>'mime_type', 'needs_review', source_kind, ingestion_run_id, id, source_record_id, raw_record, mapped_record
     from wk_import_staging_records
     where ingestion_run_id = $1 and target_status = 'ready' and target_entity = 'media_assets' and target_slug is not null and title is not null and source_url is not null
     on conflict (source_staging_record_id) do update set title = excluded.title, source_url = excluded.source_url, mime_type = excluded.mime_type, updated_at = now()`,
    [runId]
  );
  await insertPromotionEvent(pool, runId, "wk_media_assets", "media_assets", "Finalized ready media records as needs_review assets.");
  return result.rowCount ?? 0;
}

async function unsupportedReadyCount(pool: Pool, runId: string): Promise<number> {
  const result = await pool.query(
    `select count(*)::int as count
     from wk_import_staging_records
     where ingestion_run_id = $1 and target_status = 'ready' and target_entity not in ('articles','pages','authors','taxonomy_terms','media_assets')`,
    [runId]
  );
  return result.rows[0]?.count ?? 0;
}

async function finalizeRun(pool: Pool, runId: string) {
  await ensureRunIsStaged(pool, runId);
  await pool.query("update wk_ingestion_runs set status = 'finalizing', errors = '{}' where id = $1", [runId]);

  const summary: FinalizeSummary = {
    content_items: await finalizeContent(pool, runId),
    authors: await finalizeAuthors(pool, runId),
    taxonomy_terms: await finalizeTerms(pool, runId),
    media_assets: await finalizeMedia(pool, runId),
  };
  const skipped = await unsupportedReadyCount(pool, runId);
  const total = Object.values(summary).reduce((sum, count) => sum + count, 0);
  const payload = {
    finalized_at: new Date().toISOString(),
    processor: "finalize-wordpress-staging",
    version: "0.1.0",
    finalized: total,
    skipped,
    counts_by_target_entity: summary,
    only_ready_records: true,
  };

  await pool.query(
    `update wk_ingestion_runs
     set status = 'finalized',
         source_manifest = jsonb_set(coalesce(source_manifest,'{}'::jsonb), '{finalization}', $2::jsonb, true),
         warnings = array_remove(array_append(coalesce(warnings,'{}'::text[]), $3), null),
         finished_at = now()
     where id = $1`,
    [runId, JSON.stringify(payload), skipped ? `${skipped} ready staging records were skipped because their target entity is not enabled for finalization.` : null]
  );
  console.log(`[finalize] ${runId}: ${total} records finalized, ${skipped} skipped`);
}

async function main() {
  const pool = createPool();
  try {
    const runIds = await getRunIds(pool);
    if (!runIds.length) {
      console.log("[finalize] no staged wordpress_export_zip jobs found");
      return;
    }
    for (const runId of runIds) await finalizeRun(pool, runId);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[finalize] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
