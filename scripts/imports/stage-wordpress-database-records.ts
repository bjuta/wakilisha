import mysql from "mysql2/promise";
import pg from "pg";

type PgPool = InstanceType<typeof pg.Pool>;

type WordPressConnection = { host: string; port: number; user: string; password: string; database: string; prefix: string };

type IngestionRun = { id: string; source_manifest: Record<string, unknown> | null; status: string; warnings: string[] | null; errors: string[] | null };

type StageRecord = {
  ingestion_run_id: string;
  source_kind: string;
  source_file: string;
  source_entity: string;
  source_record_id: string | null;
  source_slug: string | null;
  target_entity: string;
  target_status: "ready" | "needs_review" | "blocked";
  target_slug: string | null;
  title: string | null;
  body: string | null;
  excerpt: string | null;
  published_at: string | null;
  author_name: string | null;
  source_url: string | null;
  raw_record: Record<string, unknown>;
  mapped_record: Record<string, unknown>;
  mapping_candidate_ids: string[];
  warnings: string[];
  errors: string[];
};

const BATCH_SIZE = Number(process.env.WAKILISHA_IMPORT_STAGE_BATCH_SIZE ?? 500);
function arg(name: string) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function required(value: string | undefined, label: string) { if (!value) throw new Error(`${label} is required.`); return value; }
function normalizeDatabaseUrl(databaseUrl: string) { try { const url = new URL(databaseUrl); url.searchParams.delete("sslmode"); url.searchParams.delete("uselibpqcompat"); return url.toString(); } catch { return databaseUrl; } }
function pgPool(): PgPool { const databaseUrl = process.env.DATABASE_URL; if (!databaseUrl) throw new Error("DATABASE_URL is required."); return new pg.Pool({ connectionString: normalizeDatabaseUrl(databaseUrl), ssl: { rejectUnauthorized: false }, max: 4 }); }
function wpConfig(): WordPressConnection { return { host: required(arg("--host") ?? process.env.WP_DB_HOST, "WP_DB_HOST or --host"), port: Number(arg("--port") ?? process.env.WP_DB_PORT ?? 3306), user: required(arg("--user") ?? process.env.WP_DB_USER, "WP_DB_USER or --user"), password: required(arg("--password") ?? process.env.WP_DB_PASSWORD, "WP_DB_PASSWORD or --password"), database: required(arg("--database") ?? process.env.WP_DB_NAME, "WP_DB_NAME or --database"), prefix: arg("--prefix") ?? process.env.WP_DB_PREFIX ?? "wp_" }; }
function table(prefix: string, name: string) { return `\`${prefix}${name}\``; }
function clean(value: unknown) { return String(value ?? "").trim(); }
function slugify(value: string) { return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160); }
function parseDate(value: string) { if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString(); }
function targetForPostType(type: string) { const normalized = type.toLowerCase().replace(/^wk_/, ""); if (normalized === "post") return "articles"; if (normalized === "page") return "pages"; if (["artist", "track", "release", "label", "genre", "chart"].includes(normalized)) return "registry_entities"; return "content_entities"; }
async function getRun(pool: PgPool, id: string): Promise<IngestionRun> { const result = await pool.query("select id::text, source_manifest, status, warnings, errors from wk_ingestion_runs where id=$1", [id]); if (!result.rowCount) throw new Error(`Job ${id} not found.`); return result.rows[0]; }
async function clearPrior(pool: PgPool, id: string) { await pool.query("delete from wk_import_staging_records where ingestion_run_id=$1", [id]); await pool.query("delete from wk_import_staging_failures where ingestion_run_id=$1", [id]); }
async function insertBatch(pool: PgPool, rows: StageRecord[]) { for (let i = 0; i < rows.length; i += BATCH_SIZE) { const batch = rows.slice(i, i + BATCH_SIZE); const values: unknown[] = []; const params = batch.map((r, idx) => { const base = idx * 20; values.push(r.ingestion_run_id, r.source_kind, r.source_file, r.source_entity, r.source_record_id, r.source_slug, r.target_entity, r.target_status, r.target_slug, r.title, r.body, r.excerpt, r.published_at, r.author_name, r.source_url, JSON.stringify(r.raw_record), JSON.stringify(r.mapped_record), r.mapping_candidate_ids, r.warnings, r.errors); return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},$${base+12},$${base+13},$${base+14},$${base+15},$${base+16}::jsonb,$${base+17}::jsonb,$${base+18},$${base+19},$${base+20})`; }).join(","); await pool.query(`insert into wk_import_staging_records (ingestion_run_id, source_kind, source_file, source_entity, source_record_id, source_slug, target_entity, target_status, target_slug, title, body, excerpt, published_at, author_name, source_url, raw_record, mapped_record, mapping_candidate_ids, warnings, errors) values ${params}`, values); } }
function mapPost(runId: string, row: Record<string, unknown>): StageRecord { const type = clean(row.post_type) || "post"; const title = clean(row.post_title); const slug = clean(row.post_name) || slugify(title || clean(row.ID) || "untitled"); const target = targetForPostType(type); const status = clean(row.post_status); const ready = ["publish", "published"].includes(status.toLowerCase()) && title && ["articles", "pages"].includes(target); return { ingestion_run_id: runId, source_kind: "wordpress_database", source_file: "mysql.wp_posts", source_entity: `mysql.${type}`, source_record_id: clean(row.ID) || null, source_slug: clean(row.post_name) || null, target_entity: target, target_status: ready ? "ready" : title ? "needs_review" : "blocked", target_slug: slug || null, title: title || null, body: clean(row.post_content) || null, excerpt: clean(row.post_excerpt) || null, published_at: parseDate(clean(row.post_date_gmt) || clean(row.post_date)), author_name: null, source_url: clean(row.guid) || null, raw_record: row, mapped_record: { post_type: type, status, slug }, mapping_candidate_ids: ["mysql-posts"], warnings: ready ? [] : [`Post type/status requires review before finalization: ${type}/${status}`], errors: title ? [] : ["Missing title"] }; }
function mapUser(runId: string, row: Record<string, unknown>): StageRecord { const name = clean(row.display_name) || clean(row.user_login); const slug = slugify(clean(row.user_nicename) || clean(row.user_login) || name || clean(row.ID)); return { ingestion_run_id: runId, source_kind: "wordpress_database", source_file: "mysql.wp_users", source_entity: "mysql.users", source_record_id: clean(row.ID) || null, source_slug: slug, target_entity: "authors", target_status: name ? "ready" : "blocked", target_slug: slug, title: name || null, body: null, excerpt: null, published_at: null, author_name: name || null, source_url: clean(row.user_url) || null, raw_record: row, mapped_record: { email: clean(row.user_email) || null, url: clean(row.user_url) || null }, mapping_candidate_ids: ["mysql-users"], warnings: clean(row.user_email) ? ["Author email staged in mapped_record only; review privacy before public use."] : [], errors: name ? [] : ["Missing author name"] }; }
async function stage(pool: PgPool, wp: mysql.Connection, config: WordPressConnection, runId: string) { await getRun(pool, runId); await pool.query("update wk_ingestion_runs set status='staging', errors='{}' where id=$1", [runId]); await clearPrior(pool, runId); const [postRows] = await wp.query(`select ID, post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt, post_status, post_name, post_type, guid from ${table(config.prefix, "posts")} where post_type not in ('revision','nav_menu_item')`); const [userRows] = await wp.query(`select ID, user_login, user_nicename, user_email, user_url, display_name from ${table(config.prefix, "users")}`); const records = [...(postRows as Record<string, unknown>[]).map((r) => mapPost(runId, r)), ...(userRows as Record<string, unknown>[]).map((r) => mapUser(runId, r))]; await insertBatch(pool, records); const counts = records.reduce<Record<string, number>>((acc, r) => { acc[r.target_entity] = (acc[r.target_entity] ?? 0) + 1; return acc; }, {}); const statusCounts = records.reduce<Record<string, number>>((acc, r) => { acc[r.target_status] = (acc[r.target_status] ?? 0) + 1; return acc; }, {}); const summary = { staged_at: new Date().toISOString(), processor: "stage-wordpress-database-records", version: "0.1.0", records: records.length, counts_by_target_entity: counts, counts_by_status: statusCounts, production_import_enabled: false }; await pool.query("update wk_ingestion_runs set status='staged', source_manifest=jsonb_set(coalesce(source_manifest,'{}'::jsonb), '{staging}', $2::jsonb, true), imported_counts=$3::jsonb, warnings=array_append(coalesce(warnings,'{}'::text[]), 'Direct database records staged. Production finalization has not been run.') where id=$1", [runId, JSON.stringify(summary), JSON.stringify(counts)]); console.log(`[wp-db-stage] ${runId}: ${records.length} records staged`); }
async function main() { const runId = required(arg("--job"), "--job"); const config = wpConfig(); const wp = await mysql.createConnection({ host: config.host, port: config.port, user: config.user, password: config.password, database: config.database, connectTimeout: 15000 }); const pool = pgPool(); try { await wp.ping(); await stage(pool, wp, config, runId); } finally { await wp.end(); await pool.end(); } }
main().catch((error) => { console.error("[wp-db-stage] failed:", error instanceof Error ? error.message : error); process.exit(1); });
