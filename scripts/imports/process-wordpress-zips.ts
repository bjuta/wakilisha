import { createClient } from "@supabase/supabase-js";
import unzipper from "unzipper";
import { parse } from "csv-parse/sync";

const DEFAULT_BUCKET = "migration-imports";
const MAX_TEXT_FILE_BYTES = Number(process.env.WAKILISHA_IMPORT_SCAN_MAX_TEXT_BYTES ?? 25 * 1024 * 1024);
const pollMs = Number(process.env.WAKILISHA_IMPORT_PROCESSOR_POLL_MS ?? 15000);

type IngestionRun = {
  id: string;
  source_name: string;
  source_kind: string;
  source_manifest: Record<string, unknown> | null;
  status: string;
  warnings: string[] | null;
  errors: string[] | null;
};

type ScanFile = {
  path: string;
  size: number;
  extension: string;
  kind: string;
  rows?: number;
  detected?: string[];
  warning?: string;
};

type ScanResult = {
  scanned_at: string;
  archive: {
    file_count: number;
    total_uncompressed_bytes: number;
  };
  counts: Record<string, number>;
  detected: string[];
  files: ScanFile[];
  warnings: string[];
};

function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasArg(name: string) {
  return process.argv.includes(name);
}

function env(name: string, fallback = "") {
  return process.env[name] ?? fallback;
}

function createSupabaseAdmin() {
  const url = env("SUPABASE_URL", env("VITE_PUBLIC_SUPABASE_URL"));
  const key = env("SUPABASE_SERVICE_ROLE_KEY", env("SUPABASE_SERVICE_KEY", env("VITE_PUBLIC_SUPABASE_ANON_KEY")));
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL/VITE_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY.");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_KEY) {
    console.warn("[processor] WARNING: using anon key fallback. Storage/table permissions may block processing.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function extensionFor(filePath: string) {
  const match = filePath.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function addCount(counts: Record<string, number>, key: string, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  counts[key] = (counts[key] ?? 0) + amount;
}

function classifyPath(filePath: string) {
  const lower = filePath.toLowerCase();
  if (/wp_posts|posts|articles|content/.test(lower)) return "posts";
  if (/postmeta|meta|acf/.test(lower)) return "postmeta";
  if (/users|authors/.test(lower)) return "users";
  if (/terms|term_taxonomy|categories|tags|genres|labels|taxonomy/.test(lower)) return "taxonomy";
  if (/term_relationship|relationship|edges|links/.test(lower)) return "relationships";
  if (/uploads|media|attachment|image|images|assets/.test(lower)) return "media";
  if (/tracks|artists|releases|charts|registry/.test(lower)) return "registry";
  if (/\.sql$/i.test(filePath)) return "sql_dump";
  if (/\.xml$/i.test(filePath)) return "wordpress_xml";
  if (/\.json$/i.test(filePath)) return "json";
  if (/\.csv$/i.test(filePath)) return "csv";
  return "unknown";
}

function detectCsvEntity(filePath: string) {
  const kind = classifyPath(filePath);
  if (kind !== "csv") return kind;
  const lower = filePath.toLowerCase();
  if (/postmeta|meta|acf/.test(lower)) return "postmeta";
  if (/posts|articles|pages/.test(lower)) return "posts";
  if (/users|authors/.test(lower)) return "users";
  if (/terms|categories|tags|taxonomy|genres|labels/.test(lower)) return "taxonomy";
  if (/relationship|term_relationship|edges|links/.test(lower)) return "relationships";
  if (/media|attachments|uploads|images|assets/.test(lower)) return "media";
  if (/tracks|artists|releases|charts|registry/.test(lower)) return "registry";
  return "csv_rows";
}

function parseCsvRows(text: string) {
  const records = parse(text, { columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true });
  return Array.isArray(records) ? records.length : 0;
}

function scanWordPressXml(text: string) {
  const counts: Record<string, number> = {};
  const detected = ["wordpress_wxr_xml"];
  const postTypes: Record<string, number> = {};
  for (const match of text.matchAll(/<wp:post_type><!\[CDATA\[(.*?)\]\]><\/wp:post_type>|<wp:post_type>(.*?)<\/wp:post_type>/g)) {
    const type = String(match[1] ?? match[2] ?? "unknown").trim() || "unknown";
    postTypes[type] = (postTypes[type] ?? 0) + 1;
  }
  const itemCount = (text.match(/<item>/g) ?? []).length;
  addCount(counts, "wxr_items", itemCount);
  Object.entries(postTypes).forEach(([type, count]) => addCount(counts, `post_type_${type}`, count));
  addCount(counts, "wxr_authors", (text.match(/<wp:author>/g) ?? []).length);
  addCount(counts, "wxr_categories", (text.match(/<wp:category>/g) ?? []).length);
  addCount(counts, "wxr_tags", (text.match(/<wp:tag>/g) ?? []).length);
  return { counts, detected };
}

function scanJson(text: string, filePath: string) {
  const counts: Record<string, number> = {};
  const detected = ["json"];
  const parsed = JSON.parse(text) as unknown;
  const base = classifyPath(filePath);
  if (Array.isArray(parsed)) {
    addCount(counts, base === "unknown" ? "json_array_items" : base, parsed.length);
  } else if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (Array.isArray(value)) {
        addCount(counts, key, value.length);
        detected.push(key);
      }
    }
  }
  return { counts, detected };
}

function scanSql(text: string) {
  const counts: Record<string, number> = {};
  const detected = ["sql_dump"];
  addCount(counts, "sql_insert_statements", (text.match(/INSERT\s+INTO\s+/gi) ?? []).length);
  addCount(counts, "sql_create_table_statements", (text.match(/CREATE\s+TABLE\s+/gi) ?? []).length);
  for (const table of ["wp_posts", "wp_postmeta", "wp_users", "wp_terms", "wp_term_relationships", "wp_term_taxonomy"]) {
    if (new RegExp(table, "i").test(text)) detected.push(table);
  }
  return { counts, detected };
}

async function scanZipBuffer(buffer: Buffer): Promise<ScanResult> {
  const directory = await unzipper.Open.buffer(buffer);
  const counts: Record<string, number> = {};
  const detected = new Set<string>();
  const warnings: string[] = [];
  const files: ScanFile[] = [];
  let total = 0;

  for (const entry of directory.files) {
    if (entry.type !== "File") continue;
    const size = Number(entry.uncompressedSize ?? 0);
    total += size;
    const filePath = entry.path;
    const extension = extensionFor(filePath);
    const kind = classifyPath(filePath);
    const fileRecord: ScanFile = { path: filePath, size, extension, kind };
    detected.add(kind);

    try {
      if (["csv", "xml", "json", "sql"].includes(extension)) {
        if (size > MAX_TEXT_FILE_BYTES) {
          fileRecord.warning = `Skipped text scan because file is larger than ${MAX_TEXT_FILE_BYTES} bytes.`;
          warnings.push(`${filePath}: ${fileRecord.warning}`);
        } else {
          const text = (await entry.buffer()).toString("utf8");
          if (extension === "csv") {
            const rows = parseCsvRows(text);
            fileRecord.rows = rows;
            addCount(counts, detectCsvEntity(filePath), rows);
            detected.add("csv");
          } else if (extension === "xml") {
            const result = scanWordPressXml(text);
            Object.entries(result.counts).forEach(([key, value]) => addCount(counts, key, value));
            result.detected.forEach((item) => detected.add(item));
          } else if (extension === "json") {
            const result = scanJson(text, filePath);
            Object.entries(result.counts).forEach(([key, value]) => addCount(counts, key, value));
            result.detected.forEach((item) => detected.add(item));
          } else if (extension === "sql") {
            const result = scanSql(text);
            Object.entries(result.counts).forEach(([key, value]) => addCount(counts, key, value));
            result.detected.forEach((item) => detected.add(item));
          }
        }
      } else if (["jpg", "jpeg", "png", "webp", "gif", "svg", "avif"].includes(extension)) {
        addCount(counts, "media_files", 1);
        detected.add("media_files");
      }
    } catch (error) {
      fileRecord.warning = error instanceof Error ? error.message : "Could not scan file.";
      warnings.push(`${filePath}: ${fileRecord.warning}`);
    }
    files.push(fileRecord);
  }

  addCount(counts, "archive_files", files.length);
  return {
    scanned_at: new Date().toISOString(),
    archive: { file_count: files.length, total_uncompressed_bytes: total },
    counts,
    detected: Array.from(detected).filter(Boolean).sort(),
    files: files.sort((a, b) => b.size - a.size).slice(0, 500),
    warnings,
  };
}

async function updateRun(supabase: ReturnType<typeof createSupabaseAdmin>, id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from("wk_ingestion_runs").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

async function processRun(supabase: ReturnType<typeof createSupabaseAdmin>, run: IngestionRun) {
  const manifest = run.source_manifest ?? {};
  const bucket = String(manifest.storage_bucket ?? DEFAULT_BUCKET);
  const storagePath = String(manifest.storage_path ?? "");
  if (!storagePath) throw new Error("source_manifest.storage_path is missing; cannot download ZIP.");

  console.log(`[processor] scanning ${run.id}: ${run.source_name}`);
  await updateRun(supabase, run.id, { status: "scanning", started_at: new Date().toISOString(), errors: [] });

  const download = await supabase.storage.from(bucket).download(storagePath);
  if (download.error) throw new Error(`Storage download failed: ${download.error.message}`);
  if (!download.data) throw new Error("Storage download returned no data.");

  const buffer = Buffer.from(await download.data.arrayBuffer());
  const scan = await scanZipBuffer(buffer);
  const nextManifest = {
    ...manifest,
    scan,
    processor: {
      name: "process-wordpress-zips",
      version: "0.1.0",
      mode: "scan_only",
      updated_at: new Date().toISOString(),
    },
  };
  const warnings = Array.from(new Set([...(run.warnings ?? []), ...scan.warnings, "Scan completed. No import has been run yet."]));

  await updateRun(supabase, run.id, {
    status: "scanned",
    source_manifest: nextManifest,
    warnings,
    errors: [],
    finished_at: new Date().toISOString(),
  });
  console.log(`[processor] scanned ${run.id}: ${Object.keys(scan.counts).length} count groups, ${scan.archive.file_count} files`);
}

async function markFailed(supabase: ReturnType<typeof createSupabaseAdmin>, run: IngestionRun, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[processor] failed ${run.id}: ${message}`);
  await updateRun(supabase, run.id, {
    status: "failed",
    errors: Array.from(new Set([...(run.errors ?? []), message])),
    finished_at: new Date().toISOString(),
  });
}

async function getRuns(supabase: ReturnType<typeof createSupabaseAdmin>) {
  const jobId = arg("--job");
  let query = supabase
    .from("wk_ingestion_runs")
    .select("id, source_name, source_kind, source_manifest, status, warnings, errors")
    .eq("source_kind", "wordpress_export_zip")
    .order("created_at", { ascending: true })
    .limit(Number(arg("--limit") ?? 5));

  if (jobId) query = query.eq("id", jobId);
  else query = query.eq("status", "queued");

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as IngestionRun[];
}

async function tick(supabase: ReturnType<typeof createSupabaseAdmin>) {
  const runs = await getRuns(supabase);
  if (!runs.length) {
    console.log("[processor] no queued wordpress_export_zip jobs found");
    return;
  }
  for (const run of runs) {
    try {
      await processRun(supabase, run);
    } catch (error) {
      await markFailed(supabase, run, error);
    }
  }
}

async function main() {
  const supabase = createSupabaseAdmin();
  if (hasArg("--watch")) {
    console.log(`[processor] watching queued wordpress_export_zip jobs every ${pollMs}ms`);
    await tick(supabase);
    setInterval(() => { void tick(supabase); }, pollMs);
    return;
  }
  await tick(supabase);
}

main().catch((error) => {
  console.error("[processor] fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});
