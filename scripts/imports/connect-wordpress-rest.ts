import pg from "pg";

type Pool = InstanceType<typeof pg.Pool>;

type RestScan = {
  scanned_at: string;
  source: string;
  counts: Record<string, number>;
  detected: string[];
  evidence: Record<string, unknown>;
  warnings: string[];
};

function arg(name: string) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function required(value: string | undefined, label: string) { if (!value) throw new Error(`${label} is required.`); return value; }
function normalizeUrl(input: string) { return input.trim().replace(/\/$/, ""); }
function db(): Pool { const url = process.env.DATABASE_URL; if (!url) throw new Error("DATABASE_URL is required."); const parsed = new URL(url); parsed.searchParams.delete("sslmode"); parsed.searchParams.delete("uselibpqcompat"); return new pg.Pool({ connectionString: parsed.toString(), ssl: { rejectUnauthorized: false }, max: 4 }); }
function authHeader() { const user = arg("--user") ?? process.env.WP_REST_USER; const pass = arg("--password") ?? process.env.WP_REST_APP_PASSWORD; return user && pass ? { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}` } : {}; }
async function fetchJson(url: string, headers: Record<string, string>) { const res = await fetch(url, { headers }); if (!res.ok) throw new Error(`${url} returned ${res.status}`); const total = Number(res.headers.get("x-wp-total") ?? 0); const totalPages = Number(res.headers.get("x-wp-totalpages") ?? 0); const data = await res.json(); return { total, totalPages, data }; }
async function scanRest(site: string): Promise<RestScan> { const base = `${normalizeUrl(site)}/wp-json/wp/v2`; const headers = authHeader(); const endpoints = ["posts", "pages", "media", "users", "categories", "tags"]; const counts: Record<string, number> = {}; const samples: Record<string, unknown> = {}; const warnings: string[] = []; for (const endpoint of endpoints) { try { const result = await fetchJson(`${base}/${endpoint}?per_page=1`, headers); counts[endpoint] = result.total || (Array.isArray(result.data) ? result.data.length : 0); samples[endpoint] = Array.isArray(result.data) ? result.data[0] ?? null : result.data; } catch (error) { counts[endpoint] = 0; warnings.push(`${endpoint}: ${error instanceof Error ? error.message : String(error)}`); } } return { scanned_at: new Date().toISOString(), source: "wordpress_rest_api", counts, detected: ["wordpress_rest_api", ...endpoints.filter((e) => counts[e] > 0)], evidence: { endpoint_base: base, authenticated: Boolean(headers.Authorization), samples }, warnings }; }
async function writeRun(pool: Pool, site: string, scan: RestScan) { const manifest = { connection: { connector: "wordpress_rest_api", site_url: normalizeUrl(site), credential_storage: "env_or_cli_only", password_persisted: false }, scan, processor: { name: "connect-wordpress-rest", version: "0.1.0", mode: "scan_only", updated_at: new Date().toISOString() } }; const job = arg("--job"); if (job) { await pool.query("update wk_ingestion_runs set source_name=$2, source_kind='wordpress_rest_api', source_manifest=$3::jsonb, status='scanned', started_at=coalesce(started_at, now()), finished_at=now(), warnings=$4, errors='{}' where id=$1", [job, site, JSON.stringify(manifest), scan.warnings]); console.log(`[wp-rest] updated ingestion run ${job}`); return; } const result = await pool.query("insert into wk_ingestion_runs (source_name, source_kind, source_manifest, status, started_at, finished_at, warnings, errors) values ($1,'wordpress_rest_api',$2::jsonb,'scanned',now(),now(),$3,'{}') returning id::text", [site, JSON.stringify(manifest), scan.warnings]); console.log(`[wp-rest] created scanned ingestion run ${result.rows[0].id}`); }
async function main() { const site = required(arg("--site") ?? process.env.WP_SITE_URL, "WP_SITE_URL or --site"); const pool = db(); try { const scan = await scanRest(site); await writeRun(pool, site, scan); } finally { await pool.end(); } }
main().catch((e) => { console.error("[wp-rest] failed:", e instanceof Error ? e.message : e); process.exit(1); });
