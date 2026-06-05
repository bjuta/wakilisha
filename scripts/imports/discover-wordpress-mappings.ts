import { createClient } from "@supabase/supabase-js";

type IngestionRun = { id: string; source_name: string; source_kind: string; source_manifest: Record<string, unknown> | null; status: string; warnings: string[] | null; errors: string[] | null };
type MappingCandidate = { id: string; source: { entity: string; field: string; file?: string; evidence: string }; target: { entity: string; field: string }; confidence: number; status: "auto_matched" | "needs_review" | "ignored"; reason: string };

function arg(name: string) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function env(name: string, fallback = "") { return process.env[name] ?? fallback; }
function createSupabaseAdmin() { const url = env("SUPABASE_URL", env("VITE_PUBLIC_SUPABASE_URL")); const key = env("SUPABASE_SERVICE_ROLE_KEY", env("SUPABASE_SERVICE_KEY", env("VITE_PUBLIC_SUPABASE_ANON_KEY"))); if (!url || !key) throw new Error("Missing SUPABASE_URL/VITE_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY."); return createClient(url, key, { auth: { persistSession: false } }); }
function normalize(value: string) { return value.toLowerCase().replace(/^wp_/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
function has(headers: string[], ...names: string[]) { const set = new Set(headers.map(normalize)); return names.some((name) => set.has(normalize(name))); }
function candidate(id: string, sourceEntity: string, sourceField: string, targetEntity: string, targetField: string, confidence: number, reason: string, file?: string): MappingCandidate { return { id, source: { entity: sourceEntity, field: sourceField, file, evidence: file ? `Detected in ${file}` : "Detected in scan evidence" }, target: { entity: targetEntity, field: targetField }, confidence, status: confidence >= 0.85 ? "auto_matched" : "needs_review", reason }; }
function pushUnique(list: MappingCandidate[], item: MappingCandidate) { if (!list.some((existing) => existing.id === item.id)) list.push(item); }

function mappingsFromCsvHeaders(scan: any): MappingCandidate[] {
  const list: MappingCandidate[] = [];
  const rows = scan?.evidence?.csv_headers;
  if (!Array.isArray(rows)) return list;
  for (const row of rows) {
    const headers = Array.isArray(row.headers) ? row.headers.map(String) : [];
    const kind = String(row.kind ?? "unknown");
    const file = String(row.path ?? "");
    if (kind === "posts" || has(headers, "post_title", "post_content", "post_name")) {
      if (has(headers, "post_title")) pushUnique(list, candidate("csv-post-title", "csv.posts", "post_title", "articles", "title", 0.96, "WordPress post_title is the canonical article title.", file));
      if (has(headers, "post_content")) pushUnique(list, candidate("csv-post-content", "csv.posts", "post_content", "articles", "body", 0.94, "WordPress post_content is the canonical article body.", file));
      if (has(headers, "post_excerpt")) pushUnique(list, candidate("csv-post-excerpt", "csv.posts", "post_excerpt", "articles", "dek", 0.88, "WordPress post_excerpt usually maps to an article dek/summary.", file));
      if (has(headers, "post_name")) pushUnique(list, candidate("csv-post-slug", "csv.posts", "post_name", "articles", "slug", 0.9, "WordPress post_name is the URL slug.", file));
      if (has(headers, "post_date", "post_date_gmt")) pushUnique(list, candidate("csv-post-date", "csv.posts", "post_date", "articles", "published_at", 0.86, "WordPress post_date maps to publication time.", file));
      if (has(headers, "post_status")) pushUnique(list, candidate("csv-post-status", "csv.posts", "post_status", "articles", "status", 0.84, "WordPress post_status needs review against React publishing states.", file));
      if (has(headers, "post_type")) pushUnique(list, candidate("csv-post-type", "csv.posts", "post_type", "content_entities", "entity_type", 0.78, "Custom post types require review before promotion.", file));
    }
    if (kind === "postmeta" || has(headers, "meta_key", "meta_value")) {
      pushUnique(list, candidate("csv-postmeta", "csv.postmeta", "meta_key/meta_value", "custom_fields", "structured_metadata", 0.7, "Postmeta/ACF data is real but site-specific, so it must be reviewed.", file));
      if (headers.some((header) => normalize(header).includes("thumbnail"))) pushUnique(list, candidate("csv-featured-image", "csv.postmeta", "_thumbnail_id", "media_assets", "hero_url", 0.82, "Featured image metadata can become article hero images once attachment IDs are resolved.", file));
    }
    if (kind === "users" || has(headers, "display_name", "user_login")) {
      if (has(headers, "display_name")) pushUnique(list, candidate("csv-author-name", "csv.users", "display_name", "authors", "name", 0.9, "WordPress display_name maps to author profile name.", file));
      if (has(headers, "user_email")) pushUnique(list, candidate("csv-author-email", "csv.users", "user_email", "authors", "email", 0.72, "Author emails may be private; review before importing.", file));
    }
    if (kind === "taxonomy" || has(headers, "term_id", "name", "slug", "taxonomy")) {
      pushUnique(list, candidate("csv-taxonomy", "csv.taxonomy", "name/slug/taxonomy", "taxonomy_terms", "name/slug/type", 0.82, "Taxonomy rows can become categories, tags, genres or labels after type review.", file));
    }
    if (kind === "relationships" || has(headers, "object_id", "term_taxonomy_id")) {
      pushUnique(list, candidate("csv-relationships", "csv.relationships", "object_id/term_taxonomy_id", "entity_relationships", "source/target/type", 0.76, "Relationship rows need a join step against terms and posts.", file));
    }
    if (kind === "media" || has(headers, "guid", "attachment_url", "mime_type")) {
      pushUnique(list, candidate("csv-media", "csv.media", "guid/attachment_url", "media_assets", "source_url", 0.84, "Attachment URLs can become media asset source URLs.", file));
    }
  }
  return list;
}

function mappingsFromWxr(scan: any): MappingCandidate[] {
  const list: MappingCandidate[] = [];
  const postTypes = scan?.evidence?.wxr_post_types;
  if (!postTypes || typeof postTypes !== "object") return list;
  for (const [type, count] of Object.entries(postTypes)) {
    const normalized = normalize(type);
    if (["post", "page"].includes(normalized)) pushUnique(list, candidate(`wxr-${normalized}`, "wordpress_wxr", String(type), normalized === "post" ? "articles" : "pages", "content", 0.88, `WXR contains ${count} ${type} items.`));
    else if (/artist|track|release|label|genre|chart/.test(normalized)) pushUnique(list, candidate(`wxr-cpt-${normalized}`, "wordpress_wxr.custom_post_type", String(type), "registry_entities", normalized, 0.74, `Custom post type ${type} needs registry mapping review.`));
    else pushUnique(list, candidate(`wxr-cpt-${normalized}`, "wordpress_wxr.custom_post_type", String(type), "content_entities", "custom_type", 0.55, `Unknown custom post type ${type}; review required.`));
  }
  return list;
}

function mappingsFromSql(scan: any): MappingCandidate[] {
  const list: MappingCandidate[] = [];
  const tables = Array.isArray(scan?.evidence?.sql_tables) ? scan.evidence.sql_tables.map(String) : [];
  for (const table of tables) {
    const normalized = normalize(table);
    if (normalized.endsWith("posts") || normalized === "posts") pushUnique(list, candidate("sql-posts", "sql", table, "articles/pages/entities", "source_table", 0.66, "SQL wp_posts table detected; import requires SQL row extraction in the next phase."));
    if (normalized.endsWith("postmeta") || normalized === "postmeta") pushUnique(list, candidate("sql-postmeta", "sql", table, "custom_fields", "source_table", 0.62, "SQL wp_postmeta table detected; ACF/meta mapping requires row extraction."));
    if (normalized.endsWith("users") || normalized === "users") pushUnique(list, candidate("sql-users", "sql", table, "authors", "source_table", 0.68, "SQL users table detected; author extraction requires SQL row parsing."));
    if (normalized.includes("term")) pushUnique(list, candidate(`sql-${normalized}`, "sql", table, "taxonomy_terms", "source_table", 0.62, "SQL taxonomy table detected; term joins are required."));
  }
  return list;
}

function discoverMappings(scan: any): MappingCandidate[] {
  return [...mappingsFromCsvHeaders(scan), ...mappingsFromWxr(scan), ...mappingsFromSql(scan)].sort((a, b) => b.confidence - a.confidence);
}

async function getRuns(supabase: ReturnType<typeof createSupabaseAdmin>) {
  const jobId = arg("--job");
  let query = supabase.from("wk_ingestion_runs").select("id, source_name, source_kind, source_manifest, status, warnings, errors").eq("source_kind", "wordpress_export_zip").order("created_at", { ascending: true }).limit(Number(arg("--limit") ?? 20));
  if (jobId) query = query.eq("id", jobId); else query = query.eq("status", "scanned");
  const { data, error } = await query; if (error) throw new Error(error.message); return (data ?? []) as IngestionRun[];
}
async function updateRun(supabase: ReturnType<typeof createSupabaseAdmin>, id: string, patch: Record<string, unknown>) { const { error } = await supabase.from("wk_ingestion_runs").update(patch).eq("id", id); if (error) throw new Error(error.message); }
async function processRun(supabase: ReturnType<typeof createSupabaseAdmin>, run: IngestionRun) { const manifest = run.source_manifest ?? {}; const scan = (manifest as any).scan; if (!scan) throw new Error("Run has no source_manifest.scan. Run imports:process-wordpress-zips first."); const mappings = discoverMappings(scan); const nextManifest = { ...manifest, mappings: { discovered_at: new Date().toISOString(), processor: "discover-wordpress-mappings", version: "0.1.0", candidates: mappings, summary: { total: mappings.length, auto_matched: mappings.filter((m) => m.status === "auto_matched").length, needs_review: mappings.filter((m) => m.status === "needs_review").length } } }; const warnings = Array.from(new Set([...(run.warnings ?? []), mappings.length ? "Mapping discovery completed. No import has been run yet." : "Mapping discovery found no candidates. Review scan evidence."])); await updateRun(supabase, run.id, { status: "mapped", source_manifest: nextManifest, warnings, errors: [] }); console.log(`[mappings] ${run.id}: ${mappings.length} candidates`); }
async function main() { const supabase = createSupabaseAdmin(); const runs = await getRuns(supabase); if (!runs.length) { console.log("[mappings] no scanned wordpress_export_zip jobs found"); return; } for (const run of runs) { try { await processRun(supabase, run); } catch (error) { const message = error instanceof Error ? error.message : String(error); console.error(`[mappings] failed ${run.id}: ${message}`); await updateRun(supabase, run.id, { status: "failed", errors: Array.from(new Set([...(run.errors ?? []), message])) }); } } }
main().catch((error) => { console.error("[mappings] fatal:", error instanceof Error ? error.message : error); process.exit(1); });
