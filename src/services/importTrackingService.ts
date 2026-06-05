import { supabase } from "@/lib/supabase";

// ---- Types ----

export type ImportItemStatus = "pending" | "importing" | "imported" | "skipped" | "failed";

export type ImportItem = {
  id: string;
  job_id: string;
  source_kind: string;
  legacy_id: string;
  target_table: string;
  target_id: string | null;
  status: ImportItemStatus;
  raw_payload: Record<string, unknown> | null;
  error_message: string | null;
  error_code: string | null;
  suggested_action: string | null;
  retry_count: number;
  created_at: string;
};

export type EntityBreakdown = {
  target_table: string;
  total: number;
  imported: number;
  failed: number;
  skipped: number;
  pending: number;
  latest_error?: string | null;
};

export type ImportRunSummary = {
  runId: string;
  totalItems: number;
  succeeded: number;
  failed: number;
  skipped: number;
  pending: number;
  importing: number;
  entityBreakdowns: EntityBreakdown[];
  recentFailures: ImportItem[];
};

// ---- Queries ----

export async function getImportItemsForRun(runId: string, status?: ImportItemStatus): Promise<ImportItem[]> {
  const query = supabase
    .from("legacy_import_records")
    .select("id, job_id, source_kind, legacy_id, target_table, target_id, status, raw_payload, error_message, created_at")
    .eq("job_id", runId)
    .order("created_at", { ascending: false });

  if (status) {
    query.eq("status", status);
  }

  const { data, error } = await query.limit(500);

  if (error) {
    console.error("Error fetching import items:", error);
    return [];
  }

  return (data as ImportItem[]).map((item) => ({
    ...item,
    error_code: null,
    suggested_action: null,
    retry_count: 0,
  }));
}

export async function getImportRunSummary(runId: string): Promise<ImportRunSummary | null> {
  // Get run-level data
  const { data: run, error: runError } = await supabase
    .from("wk_ingestion_runs")
    .select("id, imported_counts, status")
    .eq("id", runId)
    .maybeSingle();

  if (runError || !run) return null;

  // Get per-item breakdown from legacy_import_records
  const { data: items, error: itemsError } = await supabase
    .from("legacy_import_records")
    .select("id, job_id, target_table, status, error_message, created_at")
    .eq("job_id", runId)
    .order("created_at", { ascending: false })
    .limit(1000);

  const allItems = (items ?? []) as (Pick<ImportItem, "id" | "job_id" | "target_table" | "status" | "error_message" | "created_at">)[];

  // Aggregate
  const tableMap = new Map<string, { total: number; imported: number; failed: number; skipped: number; pending: number; errors: string[] }>();

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  let pending = 0;
  let importing = 0;
  const failures: ImportItem[] = [];

  for (const item of allItems) {
    const entry = tableMap.get(item.target_table) || { total: 0, imported: 0, failed: 0, skipped: 0, pending: 0, errors: [] };
    entry.total++;
    if (item.status === "imported") { succeeded++; entry.imported++; }
    else if (item.status === "failed") { failed++; entry.failed++; if (item.error_message) entry.errors.push(item.error_message); }
    else if (item.status === "skipped") { skipped++; entry.skipped++; }
    else if (item.status === "importing") { importing++; }
    else { pending++; entry.pending++; }
    tableMap.set(item.target_table, entry);

    if (item.status === "failed" && failures.length < 50) {
      failures.push(item as ImportItem);
    }
  }

  const entityBreakdowns: EntityBreakdown[] = Array.from(tableMap.entries()).map(([table, counts]) => ({
    target_table: table,
    total: counts.total,
    imported: counts.imported,
    failed: counts.failed,
    skipped: counts.skipped,
    pending: counts.pending,
    latest_error: counts.errors[0] ?? null,
  })).sort((a, b) => b.total - a.total);

  return {
    runId,
    totalItems: allItems.length,
    succeeded,
    failed,
    skipped,
    pending,
    importing,
    entityBreakdowns,
    recentFailures: failures,
  };
}

// ---- Remediation Actions ----

export async function retryFailedItem(itemId: string): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from("legacy_import_records")
    .update({ status: "pending", error_message: null })
    .eq("id", itemId)
    .eq("status", "failed");

  if (error) {
    return { success: false, message: error.message };
  }
  return { success: true, message: "Item queued for retry." };
}

export async function retryAllFailed(runId: string): Promise<{ success: boolean; count: number; message: string }> {
  const { data, error } = await supabase
    .from("legacy_import_records")
    .update({ status: "pending", error_message: null })
    .eq("job_id", runId)
    .eq("status", "failed")
    .select("id");

  if (error) {
    return { success: false, count: 0, message: error.message };
  }
  return { success: true, count: data?.length ?? 0, message: `${data?.length ?? 0} items queued for retry.` };
}

export async function skipFailedItem(itemId: string): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from("legacy_import_records")
    .update({ status: "skipped", error_message: "Manually skipped by admin." })
    .eq("id", itemId)
    .eq("status", "failed");

  if (error) {
    return { success: false, message: error.message };
  }
  return { success: true, message: "Item skipped." };
}

export async function skipAllFailed(runId: string): Promise<{ success: boolean; count: number; message: string }> {
  const { data, error } = await supabase
    .from("legacy_import_records")
    .update({ status: "skipped", error_message: "Manually skipped by admin." })
    .eq("job_id", runId)
    .eq("status", "failed")
    .select("id");

  if (error) {
    return { success: false, count: 0, message: error.message };
  }
  return { success: true, count: data?.length ?? 0, message: `${data?.length ?? 0} items skipped.` };
}

// ---- Error classification for remediation hints ----

export type ErrorClassification = {
  category: "missing_table" | "missing_column" | "fk_constraint" | "duplicate_key" | "validation" | "network" | "unknown";
  label: string;
  suggestedAction: string;
  suggestedActionType: "create_table" | "add_column" | "fix_data" | "retry" | "investigate";
};

export function classifyImportError(errorMessage: string): ErrorClassification {
  const msg = errorMessage.toLowerCase();

  if (msg.includes("relation") && msg.includes("does not exist")) {
    return {
      category: "missing_table",
      label: "Target table missing",
      suggestedAction: "Create this table in Supabase SQL editor.",
      suggestedActionType: "create_table",
    };
  }

  if (msg.includes("column") && (msg.includes("does not exist") || msg.includes("not found"))) {
    return {
      category: "missing_column",
      label: "Target column missing",
      suggestedAction: "Add the missing column to the target table.",
      suggestedActionType: "add_column",
    };
  }

  if (msg.includes("foreign key") || msg.includes("fk_") || msg.includes("violates foreign key")) {
    return {
      category: "fk_constraint",
      label: "Foreign key constraint violation",
      suggestedAction: "Check that referenced records exist or adjust the FK relationship.",
      suggestedActionType: "fix_data",
    };
  }

  if (msg.includes("duplicate key") || msg.includes("unique constraint") || msg.includes("already exists")) {
    return {
      category: "duplicate_key",
      label: "Duplicate or already exists",
      suggestedAction: "This record may already be imported. Review and skip if appropriate.",
      suggestedActionType: "fix_data",
    };
  }

  if (msg.includes("validation") || msg.includes("required") || msg.includes("null value")) {
    return {
      category: "validation",
      label: "Validation error",
      suggestedAction: "Required fields are missing or invalid. Update the source data or mapping.",
      suggestedActionType: "fix_data",
    };
  }

  if (msg.includes("timeout") || msg.includes("network") || msg.includes("fetch") || msg.includes("abort")) {
    return {
      category: "network",
      label: "Network or timeout error",
      suggestedAction: "Connection issue. Retry the import.",
      suggestedActionType: "retry",
    };
  }

  return {
    category: "unknown",
    label: "Unknown error",
    suggestedAction: "Review the full error and investigate in Supabase.",
    suggestedActionType: "investigate",
  };
}