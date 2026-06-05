import { createClient } from "@supabase/supabase-js";

type IngestionRun = {
  id: string;
  source_name: string;
  source_kind: string;
  source_manifest: Record<string, unknown> | null;
  status: string;
  warnings: string[] | null;
  errors: string[] | null;
};

type MappingCandidate = {
  id: string;
  source: { entity: string; field: string; file?: string; evidence: string };
  target: { entity: string; field: string };
  confidence: number;
  status: "auto_matched" | "needs_review" | "ignored";
  reason: string;
};

type StagingBucket = {
  target_entity: string;
  candidate_count: number;
  auto_matched: number;
  needs_review: number;
  blocked: boolean;
  blocker_reasons: string[];
  source_files: string[];
  candidate_ids: string[];
};

function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function env(name: string, fallback = "") {
  return process.env[name] ?? fallback;
}

function createSupabaseAdmin() {
  const url = env("SUPABASE_URL", env("VITE_PUBLIC_SUPABASE_URL"));
  const key = env("SUPABASE_SERVICE_ROLE_KEY", env("SUPABASE_SERVICE_KEY", env("VITE_PUBLIC_SUPABASE_ANON_KEY")));
  if (!url || !key) throw new Error("Missing SUPABASE_URL/VITE_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY.");
  return createClient(url, key, { auth: { persistSession: false } });
}

function getMappings(manifest: Record<string, unknown> | null): MappingCandidate[] {
  const mappings = manifest?.mappings;
  if (!mappings || typeof mappings !== "object") return [];
  const candidates = (mappings as { candidates?: unknown[] }).candidates;
  return Array.isArray(candidates) ? candidates as MappingCandidate[] : [];
}

function getScan(manifest: Record<string, unknown> | null) {
  const scan = manifest?.scan;
  return scan && typeof scan === "object" ? scan as { counts?: Record<string, number>; archive?: { file_count?: number }; evidence?: unknown } : null;
}

function groupByTargetEntity(candidates: MappingCandidate[]): StagingBucket[] {
  const groups = new Map<string, MappingCandidate[]>();
  for (const candidate of candidates) {
    const key = candidate.target?.entity || "unknown";
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }

  return Array.from(groups.entries()).map(([target_entity, items]) => {
    const needsReview = items.filter((item) => item.status === "needs_review");
    const autoMatched = items.filter((item) => item.status === "auto_matched");
    const blocker_reasons: string[] = [];

    if (items.length === 0) blocker_reasons.push("No mapping candidates found for this target.");
    if (needsReview.length > 0) blocker_reasons.push(`${needsReview.length} mapping candidate(s) require human review.`);
    if (target_entity.includes("relationships")) blocker_reasons.push("Relationship staging requires source and target entity resolution before import.");
    if (target_entity.includes("custom_fields")) blocker_reasons.push("Custom fields/ACF staging requires approved field policy before import.");
    if (target_entity.includes("media")) blocker_reasons.push("Media staging requires download/copy policy before import.");

    return {
      target_entity,
      candidate_count: items.length,
      auto_matched: autoMatched.length,
      needs_review: needsReview.length,
      blocked: blocker_reasons.length > 0,
      blocker_reasons,
      source_files: Array.from(new Set(items.map((item) => item.source?.file).filter(Boolean) as string[])).slice(0, 50),
      candidate_ids: items.map((item) => item.id),
    };
  }).sort((a, b) => a.target_entity.localeCompare(b.target_entity));
}

function buildStagingPlan(run: IngestionRun) {
  const manifest = run.source_manifest ?? {};
  const scan = getScan(manifest);
  const candidates = getMappings(manifest);
  const buckets = groupByTargetEntity(candidates);
  const readyBuckets = buckets.filter((bucket) => !bucket.blocked);
  const blockedBuckets = buckets.filter((bucket) => bucket.blocked);
  const blockers = blockedBuckets.flatMap((bucket) => bucket.blocker_reasons.map((reason) => `${bucket.target_entity}: ${reason}`));

  return {
    planned_at: new Date().toISOString(),
    processor: "plan-wordpress-staging",
    version: "0.1.0",
    mode: "plan_only",
    source_job: {
      id: run.id,
      source_name: run.source_name,
      source_kind: run.source_kind,
    },
    scan_summary: {
      archive_files: scan?.archive?.file_count ?? 0,
      count_groups: Object.keys(scan?.counts ?? {}).length,
    },
    mapping_summary: {
      total_candidates: candidates.length,
      auto_matched: candidates.filter((item) => item.status === "auto_matched").length,
      needs_review: candidates.filter((item) => item.status === "needs_review").length,
    },
    buckets,
    readiness: {
      ready_bucket_count: readyBuckets.length,
      blocked_bucket_count: blockedBuckets.length,
      can_stage_anything: readyBuckets.length > 0,
      can_import_to_production: false,
      reason: "This is a staging plan only. Production import/promotion is intentionally not enabled yet.",
    },
    blockers: Array.from(new Set(blockers)),
  };
}

async function getRuns(supabase: ReturnType<typeof createSupabaseAdmin>) {
  const jobId = arg("--job");
  let query = supabase
    .from("wk_ingestion_runs")
    .select("id, source_name, source_kind, source_manifest, status, warnings, errors")
    .eq("source_kind", "wordpress_export_zip")
    .order("created_at", { ascending: true })
    .limit(Number(arg("--limit") ?? 20));

  if (jobId) query = query.eq("id", jobId);
  else query = query.eq("status", "mapped");

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as IngestionRun[];
}

async function updateRun(supabase: ReturnType<typeof createSupabaseAdmin>, id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from("wk_ingestion_runs").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

async function processRun(supabase: ReturnType<typeof createSupabaseAdmin>, run: IngestionRun) {
  const mappings = getMappings(run.source_manifest);
  if (!mappings.length) throw new Error("Run has no source_manifest.mappings candidates. Run imports:discover-wordpress-mappings first.");

  const plan = buildStagingPlan(run);
  const nextManifest = {
    ...(run.source_manifest ?? {}),
    staging_plan: plan,
  };
  const warnings = Array.from(new Set([...(run.warnings ?? []), "Staging plan generated. No records have been staged or imported yet.", ...plan.blockers]));

  await updateRun(supabase, run.id, {
    status: "planned",
    source_manifest: nextManifest,
    warnings,
    errors: [],
  });
  console.log(`[staging-plan] ${run.id}: ${plan.buckets.length} bucket(s), ${plan.readiness.blocked_bucket_count} blocked`);
}

async function main() {
  const supabase = createSupabaseAdmin();
  const runs = await getRuns(supabase);
  if (!runs.length) {
    console.log("[staging-plan] no mapped wordpress_export_zip jobs found");
    return;
  }
  for (const run of runs) {
    try {
      await processRun(supabase, run);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[staging-plan] failed ${run.id}: ${message}`);
      await updateRun(supabase, run.id, { status: "failed", errors: Array.from(new Set([...(run.errors ?? []), message])) });
    }
  }
}

main().catch((error) => {
  console.error("[staging-plan] fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});
