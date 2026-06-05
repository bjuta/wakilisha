import { createClient } from "@supabase/supabase-js";
import unzipper from "unzipper";
import { parse } from "csv-parse/sync";

const DEFAULT_BUCKET = "migration-imports";
const MAX_TEXT_FILE_BYTES = Number(process.env.WAKILISHA_IMPORT_STAGE_MAX_TEXT_BYTES ?? 40 * 1024 * 1024);
const BATCH_SIZE = Number(process.env.WAKILISHA_IMPORT_STAGE_BATCH_SIZE ?? 500);

type IngestionRun = {
  id: string;
  source_name: string;
  source_kind: string;
  source_manifest: Record<string, unknown> | null;
  status: string;
  warnings: string[] | null;
  errors: string[] | null;
};

type StageRecord = {
  ingestion_run_id: string;
  source_kind: string;
  source_file: string;
  source_entity: string;
  source_record_id: string | null;
  source_slug: string | null;
  target_entity: string;
  target_status: "draft" | "ready" | "needs_review" | "blocked" | "ignored";
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

type StageFailure = {
  ingestion_run_id: string;
  source_file: string | null;
  source_entity: string | null;
  source_record_id: string | null;
  failure_stage: string;
  message: string;
  raw_record: Record<string, unknown>;
};

function arg(name: string) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function env(name: string, fallback = "") { return process.env[name] ?? fallback; }
function createSupabaseAdmin() { const url = env("SUPABASE_URL", env("VITE_PUBLIC_SUPABASE_URL")); const key = env("SUPABASE_SERVICE_ROLE_KEY", env("SUPABASE_SERVICE_KEY", env("VITE_PUBLIC_SUPABASE_ANON_KEY"))); if (!url || !key) throw new Error("Missing SUPABASE_URL/VITE_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY."); return createClient(url, key, { auth: { persistSession: false } }); }
function extensionFor(filePath: string) { return filePath.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ""; }
function clean(value: unknown) { return String(value ?? "").trim(); }
function first(record: Record<string, unknown>, keys: string[]) { for (const key of keys) { const value = record[key]; if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim(); } return ""; }
function slugify(value: string) { return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160); }
function parseDate(value: string) { if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString(); }
function classifyPath(filePath: string) { const lower = filePath.toLowerCase(); if (/postmeta|meta|acf/.test(lower)) return "postmeta"; if (/wp_posts|posts|articles|pages|content/.test(lower)) return "posts"; if (/users|authors/.test(lower)) return "users"; if (/terms|term_taxonomy|categories|tags|genres|labels|taxonomy/.test(lower)) return "taxonomy"; if (/term_relationship|relationship|edges|links/.test(lower)) return "relationships"; if (/uploads|media|attachment|image|images|assets/.test(lower)) return "media"; if (/tracks|artists|releases|charts|registry/.test(lower)) return "registry"; if (/\.xml$/i.test(filePath)) return "wordpress_xml"; if (/\.json$/i.test(filePath)) return "json"; return "unknown"; }
function csvRows(text: string) { return parse(text, { columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true }) as Record<string, unknown>[]; }

function targetForPostType(type: string) {
  const normalized = type.toLowerCase().replace(/^wk_/, "");
  if (normalized === "post") return "articles";
  if (normalized === "page") return "pages";
  if (["artist", "track", "release", "label", "genre", "chart", "registry_entity"].includes(normalized)) return "registry_entities";
  return "content_entities";
}

function mapPostRecord(runId: string, sourceFile: string, record: Record<string, unknown>): StageRecord {
  const postType = first(record, ["post_type", "type"]) || "post";
  const title = first(record, ["post_title", "title", "name"]);
  const body = first(record, ["post_content", "content", "body"]);
  const excerpt = first(record, ["post_excerpt", "excerpt", "summary"]);
  const postName = first(record, ["post_name", "slug"]);
  const id = first(record, ["ID", "id", "post_id"]);
  const status = first(record, ["post_status", "status"]);
  const targetStatus = status && !["publish", "published"].includes(status.toLowerCase()) ? "needs_review" : title ? "ready" : "blocked";
  const warnings = [!title ? "Missing title." : "", postType !== "post" && postType !== "page" ? `Custom post type ${postType} staged as ${targetForPostType(postType)} and needs review before promotion.` : ""].filter(Boolean);
  const slug = postName || slugify(title || id || "untitled");
  const mapped = { title, body, excerpt, slug, source_status: status, post_type: postType, published_at: parseDate(first(record, ["post_date_gmt", "post_date", "date", "created_at"])) };
  return { ingestion_run_id: runId, source_kind: "wordpress_export_zip", source_file: sourceFile, source_entity: `csv.${postType}`, source_record_id: id || null, source_slug: postName || null, target_entity: targetForPostType(postType), target_status: targetStatus, target_slug: slug || null, title: title || null, body: body || null, excerpt: excerpt || null, published_at: mapped.published_at, author_name: null, source_url: first(record, ["guid", "url", "link"]) || null, raw_record: record, mapped_record: mapped, mapping_candidate_ids: ["csv-post-title", "csv-post-content", "csv-post-slug"], warnings, errors: targetStatus === "blocked" ? ["Cannot stage as ready without a title."] : [] };
}

function mapUserRecord(runId: string, sourceFile: string, record: Record<string, unknown>): StageRecord {
  const name = first(record, ["display_name", "user_nicename", "user_login", "name"]);
  const id = first(record, ["ID", "id", "user_id"]);
  const slug = slugify(first(record, ["user_nicename", "user_login"]) || name || id || "author");
  const mapped = { name, slug, email: first(record, ["user_email", "email"]) || null, url: first(record, ["user_url", "url"]) || null };
  return { ingestion_run_id: runId, source_kind: "wordpress_export_zip", source_file: sourceFile, source_entity: "csv.users", source_record_id: id || null, source_slug: slug, target_entity: "authors", target_status: name ? "ready" : "blocked", target_slug: slug, title: name || null, body: null, excerpt: null, published_at: null, author_name: name || null, source_url: mapped.url, raw_record: record, mapped_record: mapped, mapping_candidate_ids: ["csv-author-name"], warnings: mapped.email ? ["Author email staged in mapped_record only; review privacy before promotion."] : [], errors: name ? [] : ["Missing author name."] };
}

function mapTaxonomyRecord(runId: string, sourceFile: string, record: Record<string, unknown>): StageRecord {
  const name = first(record, ["name", "term_name", "title"]);
  const id = first(record, ["term_id", "id", "term_taxonomy_id"]);
  const taxonomy = first(record, ["taxonomy", "type"]) || "term";
  const slug = first(record, ["slug"]) || slugify(name || id || taxonomy);
  return { ingestion_run_id: runId, source_kind: "wordpress_export_zip", source_file: sourceFile, source_entity: `csv.${taxonomy}`, source_record_id: id || null, source_slug: slug, target_entity: "taxonomy_terms", target_status: name ? "ready" : "blocked", target_slug: slug, title: name || null, body: first(record, ["description"]) || null, excerpt: null, published_at: null, author_name: null, source_url: null, raw_record: record, mapped_record: { name, slug, taxonomy, description: first(record, ["description"]) || null }, mapping_candidate_ids: ["csv-taxonomy"], warnings: [], errors: name ? [] : ["Missing taxonomy name."] };
}

function mapMediaRecord(runId: string, sourceFile: string, record: Record<string, unknown>): StageRecord {
  const url = first(record, ["guid", "attachment_url", "source_url", "url"]);
  const title = first(record, ["post_title", "title", "filename", "name"]) || url.split("/").pop() || "media";
  const id = first(record, ["ID", "id", "attachment_id", "post_id"]);
  const slug = slugify(first(record, ["post_name", "slug"]) || title || id || "media");
  return { ingestion_run_id: runId, source_kind: "wordpress_export_zip", source_file: sourceFile, source_entity: "csv.media", source_record_id: id || null, source_slug: slug, target_entity: "media_assets", target_status: url ? "needs_review" : "blocked", target_slug: slug, title, body: null, excerpt: null, published_at: null, author_name: null, source_url: url || null, raw_record: record, mapped_record: { title, slug, source_url: url, mime_type: first(record, ["post_mime_type", "mime_type"]) || null }, mapping_candidate_ids: ["csv-media"], warnings: url ? ["Media asset requires download/copy policy before promotion."] : [], errors: url ? [] : ["Missing media URL."] };
}

function mapGenericRecord(runId: string, sourceFile: string, sourceEntity: string, targetEntity: string, record: Record<string, unknown>): StageRecord {
  const title = first(record, ["title", "name", "post_title", "label"]);
  const id = first(record, ["id", "ID", "post_id", "term_id"]);
  const slug = first(record, ["slug", "post_name"]) || slugify(title || id || sourceEntity);
  return { ingestion_run_id: runId, source_kind: "wordpress_export_zip", source_file: sourceFile, source_entity: sourceEntity, source_record_id: id || null, source_slug: slug || null, target_entity: targetEntity, target_status: "needs_review", target_slug: slug || null, title: title || null, body: first(record, ["body", "content", "post_content"]) || null, excerpt: first(record, ["excerpt", "summary", "post_excerpt"]) || null, published_at: parseDate(first(record, ["date", "post_date", "created_at"])), author_name: first(record, ["author", "author_name", "display_name"]) || null, source_url: first(record, ["url", "guid", "link"]) || null, raw_record: record, mapped_record: { ...record, slug }, mapping_candidate_ids: [], warnings: ["Generic staged record requires human mapping review before promotion."], errors: [] };
}

function stageCsvRecord(runId: string, sourceFile: string, kind: string, record: Record<string, unknown>): StageRecord {
  if (kind === "posts" || record.post_title || record.post_content || record.post_type) return mapPostRecord(runId, sourceFile, record);
  if (kind === "users" || record.display_name || record.user_login) return mapUserRecord(runId, sourceFile, record);
  if (kind === "taxonomy" || record.taxonomy || record.term_id) return mapTaxonomyRecord(runId, sourceFile, record);
  if (kind === "media" || record.attachment_url || record.guid || record.post_mime_type) return mapMediaRecord(runId, sourceFile, record);
  if (kind === "relationships" || record.object_id || record.term_taxonomy_id) return mapGenericRecord(runId, sourceFile, "csv.relationships", "entity_relationships", record);
  if (kind === "postmeta" || record.meta_key) return mapGenericRecord(runId, sourceFile, "csv.postmeta", "custom_fields", record);
  return mapGenericRecord(runId, sourceFile, `csv.${kind}`, "staging_unknown", record);
}

function extractWxrItems(text: string): Record<string, unknown>[] {
  const blocks = text.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return blocks.map((block) => {
    const get = (pattern: RegExp) => block.match(pattern)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() ?? "";
    return { post_type: get(/<wp:post_type>([\s\S]*?)<\/wp:post_type>/), post_title: get(/<title>([\s\S]*?)<\/title>/), post_content: get(/<content:encoded>([\s\S]*?)<\/content:encoded>/), post_excerpt: get(/<excerpt:encoded>([\s\S]*?)<\/excerpt:encoded>/), post_name: get(/<wp:post_name>([\s\S]*?)<\/wp:post_name>/), post_date: get(/<wp:post_date>([\s\S]*?)<\/wp:post_date>/), ID: get(/<wp:post_id>([\s\S]*?)<\/wp:post_id>/), guid: get(/<guid[^>]*>([\s\S]*?)<\/guid>/) };
  });
}

async function insertBatches(supabase: ReturnType<typeof createSupabaseAdmin>, table: string, rows: unknown[]) {
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const batch = rows.slice(index, index + BATCH_SIZE);
    if (!batch.length) continue;
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw new Error(`${table} insert failed: ${error.message}`);
  }
}

async function getRuns(supabase: ReturnType<typeof createSupabaseAdmin>) {
  const jobId = arg("--job");
  let query = supabase.from("wk_ingestion_runs").select("id, source_name, source_kind, source_manifest, status, warnings, errors").eq("source_kind", "wordpress_export_zip").order("created_at", { ascending: true }).limit(Number(arg("--limit") ?? 5));
  if (jobId) query = query.eq("id", jobId); else query = query.eq("status", "planned");
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as IngestionRun[];
}

async function updateRun(supabase: ReturnType<typeof createSupabaseAdmin>, id: string, patch: Record<string, unknown>) { const { error } = await supabase.from("wk_ingestion_runs").update(patch).eq("id", id); if (error) throw new Error(error.message); }
async function clearPriorStaging(supabase: ReturnType<typeof createSupabaseAdmin>, runId: string) { await supabase.from("wk_import_staging_records").delete().eq("ingestion_run_id", runId); await supabase.from("wk_import_staging_failures").delete().eq("ingestion_run_id", runId); }

async function stageRun(supabase: ReturnType<typeof createSupabaseAdmin>, run: IngestionRun) {
  const manifest = run.source_manifest ?? {};
  const storagePath = clean((manifest as any).storage_path);
  const bucket = clean((manifest as any).storage_bucket) || DEFAULT_BUCKET;
  if (!storagePath) throw new Error("source_manifest.storage_path is missing; cannot stage records.");
  if (!(manifest as any).staging_plan) throw new Error("source_manifest.staging_plan is missing. Run imports:plan-wordpress-staging first.");

  await updateRun(supabase, run.id, { status: "staging", errors: [] });
  await clearPriorStaging(supabase, run.id);

  const download = await supabase.storage.from(bucket).download(storagePath);
  if (download.error) throw new Error(`Storage download failed: ${download.error.message}`);
  if (!download.data) throw new Error("Storage download returned no data.");
  const directory = await unzipper.Open.buffer(Buffer.from(await download.data.arrayBuffer()));
  const records: StageRecord[] = [];
  const failures: StageFailure[] = [];

  for (const entry of directory.files) {
    if (entry.type !== "File") continue;
    const extension = extensionFor(entry.path);
    const kind = classifyPath(entry.path);
    const size = Number(entry.uncompressedSize ?? 0);
    if (!["csv", "xml", "json"].includes(extension)) continue;
    if (size > MAX_TEXT_FILE_BYTES) {
      failures.push({ ingestion_run_id: run.id, source_file: entry.path, source_entity: kind, source_record_id: null, failure_stage: "stage", message: `Skipped file larger than ${MAX_TEXT_FILE_BYTES} bytes.`, raw_record: {} });
      continue;
    }
    try {
      const text = (await entry.buffer()).toString("utf8");
      if (extension === "csv") {
        const rows = csvRows(text);
        rows.forEach((row) => records.push(stageCsvRecord(run.id, entry.path, kind, row)));
      } else if (extension === "xml") {
        extractWxrItems(text).forEach((row) => records.push(mapPostRecord(run.id, entry.path, row)));
      } else if (extension === "json") {
        const parsed = JSON.parse(text) as unknown;
        const rows = Array.isArray(parsed) ? parsed : Object.values(parsed as Record<string, unknown>).find(Array.isArray) as unknown[] | undefined;
        if (Array.isArray(rows)) rows.filter((row) => row && typeof row === "object").forEach((row) => records.push(mapGenericRecord(run.id, entry.path, `json.${kind}`, kind === "json" ? "staging_json" : kind, row as Record<string, unknown>)));
      }
    } catch (error) {
      failures.push({ ingestion_run_id: run.id, source_file: entry.path, source_entity: kind, source_record_id: null, failure_stage: "stage", message: error instanceof Error ? error.message : String(error), raw_record: {} });
    }
  }

  await insertBatches(supabase, "wk_import_staging_records", records);
  await insertBatches(supabase, "wk_import_staging_failures", failures);
  const counts = records.reduce<Record<string, number>>((acc, row) => { acc[row.target_entity] = (acc[row.target_entity] ?? 0) + 1; return acc; }, {});
  const statusCounts = records.reduce<Record<string, number>>((acc, row) => { acc[row.target_status] = (acc[row.target_status] ?? 0) + 1; return acc; }, {});
  const stagingSummary = { staged_at: new Date().toISOString(), processor: "stage-wordpress-records", version: "0.1.0", records: records.length, failures: failures.length, counts_by_target_entity: counts, counts_by_status: statusCounts, production_import_enabled: false };
  const nextManifest = { ...manifest, staging: stagingSummary };
  const warnings = Array.from(new Set([...(run.warnings ?? []), "Records staged. Production promotion has not been run.", failures.length ? `${failures.length} staging failure(s) recorded.` : ""])).filter(Boolean);
  await updateRun(supabase, run.id, { status: "staged", source_manifest: nextManifest, imported_counts: counts, warnings, errors: [] });
  console.log(`[stage] ${run.id}: ${records.length} records staged, ${failures.length} failures`);
}

async function main() {
  const supabase = createSupabaseAdmin();
  const runs = await getRuns(supabase);
  if (!runs.length) { console.log("[stage] no planned wordpress_export_zip jobs found"); return; }
  for (const run of runs) {
    try { await stageRun(supabase, run); }
    catch (error) { const message = error instanceof Error ? error.message : String(error); console.error(`[stage] failed ${run.id}: ${message}`); await updateRun(supabase, run.id, { status: "failed", errors: Array.from(new Set([...(run.errors ?? []), message])) }); }
  }
}

main().catch((error) => { console.error("[stage] fatal:", error instanceof Error ? error.message : error); process.exit(1); });
