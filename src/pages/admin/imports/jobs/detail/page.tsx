import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { getIngestionRun, totalImported, processImportRun, type IngestionRun } from "@/services/migrationImportJobs";
import {
  getImportRunSummary,
  getImportItemsForRun,
  retryFailedItem,
  retryAllFailed,
  skipFailedItem,
  skipAllFailed,
  classifyImportError,
  type ImportRunSummary,
  type ImportItem,
  type EntityBreakdown,
  type ErrorClassification,
} from "@/services/importTrackingService";

type ActiveTab = "overview" | "items" | "failures" | "manifest";

const RUNNING_STATUSES = new Set(["running", "validating", "staging", "promoting", "processing", "scanning"]);

export default function AdminImportsJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<IngestionRun | null>(null);
  const [summary, setSummary] = useState<ImportRunSummary | null>(null);
  const [failedItems, setFailedItems] = useState<ImportItem[]>([]);
  const [allItems, setAllItems] = useState<ImportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const runData = await getIngestionRun(id);
      setRun(runData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load import job.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadSummary = useCallback(async () => {
    if (!id) return;
    setSummaryLoading(true);
    try {
      const [summaryData, failed] = await Promise.all([
        getImportRunSummary(id),
        getImportItemsForRun(id, "failed"),
      ]);
      setSummary(summaryData);
      setFailedItems(failed);
    } catch {
      // non-fatal
    } finally {
      setSummaryLoading(false);
    }
  }, [id]);

  const loadAllItems = useCallback(async () => {
    if (!id) return;
    const items = await getImportItemsForRun(id);
    setAllItems(items);
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (run) {
      void loadSummary();
    }
  }, [run, loadSummary]);

  useEffect(() => {
    if (activeTab === "items") void loadAllItems();
  }, [activeTab, loadAllItems]);

  const flash = useCallback((type: "success" | "error", text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 4000);
  }, []);

  const handleRetryItem = useCallback(async (itemId: string) => {
    setActionLoading((prev) => new Set(prev).add(itemId));
    const result = await retryFailedItem(itemId);
    flash(result.success ? "success" : "error", result.message);
    setActionLoading((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
    if (result.success) {
      setFailedItems((prev) => prev.filter((i) => i.id !== itemId));
      setSummary((prev) => prev ? { ...prev, failed: prev.failed - 1, pending: prev.pending + 1 } : prev);
    }
  }, [flash]);

  const handleSkipItem = useCallback(async (itemId: string) => {
    setActionLoading((prev) => new Set(prev).add(itemId));
    const result = await skipFailedItem(itemId);
    flash(result.success ? "success" : "error", result.message);
    setActionLoading((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
    if (result.success) {
      setFailedItems((prev) => prev.filter((i) => i.id !== itemId));
      setSummary((prev) => prev ? { ...prev, failed: prev.failed - 1, skipped: prev.skipped + 1 } : prev);
    }
  }, [flash]);

  const handleRetryAll = useCallback(async () => {
    if (!id) return;
    setActionLoading((prev) => new Set(prev).add("__retry_all"));
    const result = await retryAllFailed(id);
    flash(result.success ? "success" : "error", result.message);
    setActionLoading((prev) => { const next = new Set(prev); next.delete("__retry_all"); return next; });
    if (result.success) {
      setFailedItems([]);
      setSummary((prev) => prev ? { ...prev, failed: 0, pending: prev.pending + result.count } : prev);
    }
  }, [id, flash]);

  const handleSkipAll = useCallback(async () => {
    if (!id) return;
    setActionLoading((prev) => new Set(prev).add("__skip_all"));
    const result = await skipAllFailed(id);
    flash(result.success ? "success" : "error", result.message);
    setActionLoading((prev) => { const next = new Set(prev); next.delete("__skip_all"); return next; });
    if (result.success) {
      setFailedItems([]);
      setSummary((prev) => prev ? { ...prev, failed: 0, skipped: prev.skipped + result.count } : prev);
    }
  }, [id, flash]);

  const handleProcess = useCallback(async () => {
    if (!id) return;
    setProcessing(true);
    flash("success", "Starting import processor. This may take a while for large imports...");
    const result = await processImportRun(id, 500);
    if (result.success) {
      flash("success", `Processed ${result.stats.total} items: ${result.stats.imported} imported, ${result.stats.failed} failed, ${result.stats.skipped} skipped, ${result.stats.drafts} drafts preserved.`);
      await load();
      await loadSummary();
    } else {
      flash("error", result.error || "Processing failed.");
    }
    setProcessing(false);
  }, [id, flash, load, loadSummary]);

  const isRunning = run ? RUNNING_STATUSES.has(run.status) : false;
  const isCompleted = run?.status === "completed";
  const isFailed = run?.status === "failed";
  const importedTotal = run ? totalImported(run) : 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-7 w-56 animate-pulse rounded bg-wk-surface-raised" />
        <div className="h-40 animate-pulse rounded-xl border border-wk-border bg-wk-surface" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="py-20 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-wk-surface-raised">
          <WkIcon name={error ? "AlertCircle" : "FileX"} size={28} className="text-wk-text-muted" />
        </div>
        <h2 className="text-[18px] font-bold text-wk-text">{error ? "Could not load import job" : "Import job not found"}</h2>
        <p className="mt-2 text-[13px] text-wk-text-muted">{error || "The import job does not exist."}</p>
        <button onClick={() => navigate("/admin/imports/jobs")} className="mt-4 wk-button wk-button-primary wk-button-sm whitespace-nowrap">Back to jobs</button>
      </div>
    );
  }

  const entityBreakdowns = summary?.entityBreakdowns ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-wk-brand">
            <button onClick={() => navigate("/admin/imports/jobs")} className="hover:text-wk-brand-600">Imports</button>
            <WkIcon name="ChevronRight" size={12} />
            <span>Job Detail</span>
          </div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">{run.source_name}</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">{run.source_kind} · {run.id.slice(0, 8)}...</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => { void load(); void loadSummary(); }} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
            <WkIcon name="RefreshCw" size={14} /> Refresh
          </button>
          <button onClick={() => navigate("/admin/imports/jobs")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
            <WkIcon name="ArrowLeft" size={14} /> Back to jobs
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`rounded-xl border p-4 ${isCompleted ? "border-wk-success/20 bg-wk-success-soft" : isFailed ? "border-wk-danger/20 bg-wk-danger-soft" : isRunning ? "border-wk-info/20 bg-wk-info-soft" : "border-wk-warning/20 bg-wk-warning-soft"}`}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-wk-surface">
            <WkIcon
              name={isCompleted ? "CheckCircle2" : isFailed ? "XCircle" : isRunning ? "Loader2" : "Clock"}
              size={20}
              className={isCompleted ? "text-wk-success" : isFailed ? "text-wk-danger" : isRunning ? "animate-spin text-wk-info" : "text-wk-warning"}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold text-wk-text">
              {isCompleted ? "Import completed" : isFailed ? "Import failed" : isRunning ? "Processing..." : `Status: ${run.status}`}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-wk-text-muted">
              {run.started_at && <span>Started: {new Date(run.started_at).toLocaleString()}</span>}
              {run.finished_at && <span>Finished: {new Date(run.finished_at).toLocaleString()}</span>}
              <span>Imported: {importedTotal.toLocaleString()} records</span>
            </div>
          </div>
          <StatusBadge status={run.status} />
        </div>
      </div>

      {/* Action flash message */}
      {actionMessage && (
        <div className={`rounded-xl border p-3 ${actionMessage.type === "success" ? "border-wk-success/20 bg-wk-success-soft text-wk-success" : "border-wk-danger/20 bg-wk-danger-soft text-wk-danger"}`}>
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <WkIcon name={actionMessage.type === "success" ? "CheckCircle2" : "AlertCircle"} size={16} />
            {actionMessage.text}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {summaryLoading ? (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-wk-border bg-wk-surface" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Total Items" value={summary.totalItems} icon="Layers" color="wk-text" />
          <KpiCard label="Succeeded" value={summary.succeeded} icon="CheckCircle2" color="wk-success" />
          <KpiCard label="Failed" value={summary.failed} icon="XCircle" color={summary.failed > 0 ? "wk-danger" : "wk-text-muted"} onClick={summary.failed > 0 ? () => setActiveTab("failures") : undefined} />
          <KpiCard label="Skipped" value={summary.skipped} icon="MinusCircle" color="wk-text-muted" />
          <KpiCard label="Pending" value={summary.pending} icon="Clock" color="wk-warning" />
          <KpiCard label="In Progress" value={summary.importing} icon="Loader2" color="wk-info" />
        </div>
      ) : (
        <WkSurface className="p-8 text-center">
          <WkIcon name="Database" size={28} className="mx-auto mb-3 text-wk-text-muted" />
          <p className="text-[13px] text-wk-text-muted">
            {run.status === "completed"
              ? "This import was completed without per-item tracking. View the imported counts in the manifest tab."
              : "Per-item tracking is only available for imports processed through the backend pipeline."}
          </p>
        </WkSurface>
      )}

      {/* Entity Breakdown (always shown if we have data) */}
      {entityBreakdowns.length > 0 && (
        <WkSurface className="p-0 overflow-hidden">
          <div className="border-b border-wk-border px-5 py-3">
            <h3 className="text-[14px] font-bold text-wk-text">Entity Breakdown</h3>
            <p className="mt-1 text-[12px] text-wk-text-muted">Per-table import status with proportions.</p>
          </div>
          <div className="divide-y divide-wk-border">
            {entityBreakdowns.map((eb) => (
              <EntityBreakdownRow key={eb.target_table} breakdown={eb} onViewFailures={() => setActiveTab("failures")} />
            ))}
          </div>
        </WkSurface>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-wk-border">
        {([
          { key: "overview", label: "Overview", icon: "LayoutDashboard" },
          { key: "items", label: "All Items", icon: "List", count: summary?.totalItems ?? 0 },
          { key: "failures", label: "Failures", icon: "AlertCircle", count: summary?.failed ?? 0 },
          { key: "manifest", label: "Manifest", icon: "FileJson" },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[13px] font-semibold transition-colors whitespace-nowrap ${
              activeTab === tab.key ? "border-wk-brand text-wk-brand" : "border-transparent text-wk-text-muted hover:text-wk-text"
            }`}
          >
            <WkIcon name={tab.icon as never} size={14} />
            {tab.label}
            {typeof tab.count === "number" && tab.count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab.key === "failures" && summary && summary.failed > 0 ? "bg-wk-danger text-white" : "bg-wk-brand text-black"}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab run={run} summary={summary} onProcess={handleProcess} processing={processing} />}
      {activeTab === "items" && <AllItemsTab items={allItems} />}
      {activeTab === "failures" && (
        <FailuresTab
          items={failedItems}
          actionLoading={actionLoading}
          onRetry={handleRetryItem}
          onSkip={handleSkipItem}
          onRetryAll={handleRetryAll}
          onSkipAll={handleSkipAll}
          navigate={navigate}
        />
      )}
      {activeTab === "manifest" && (
        <WkSurface className="p-5">
          <h3 className="mb-3 text-[14px] font-bold text-wk-text">Source Manifest</h3>
          <pre className="max-h-[520px] overflow-auto rounded-lg border border-wk-border bg-wk-bg-subtle p-3 text-[11px] leading-5 text-wk-text">
            {JSON.stringify(run.source_manifest ?? {}, null, 2)}
          </pre>
        </WkSurface>
      )}
    </div>
  );
}

// ---- KPI Card ----
function KpiCard({ label, value, icon, color, onClick }: {
  label: string;
  value: number;
  icon: string;
  color: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-wk-border bg-wk-bg-subtle p-4 ${onClick ? "cursor-pointer hover:border-wk-danger/40 transition-colors" : ""}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-wk-surface-raised">
          <WkIcon name={icon as never} size={14} className={`text-${color}`} />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-wk-text-muted">{label}</span>
      </div>
      <div className={`text-[22px] font-black text-${color}`}>{value.toLocaleString()}</div>
    </div>
  );
}

// ---- Entity Breakdown Row ----
function EntityBreakdownRow({ breakdown, onViewFailures }: { breakdown: EntityBreakdown; onViewFailures: () => void }) {
  const pct = breakdown.total > 0 ? Math.round((breakdown.imported / breakdown.total) * 100) : 0;

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-wk-surface-raised">
          <WkIcon name="Database" size={14} className="text-wk-text-muted" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-bold text-wk-text">{breakdown.target_table}</span>
            {breakdown.failed > 0 && (
              <button onClick={onViewFailures} className="rounded-full bg-wk-danger-soft px-2 py-0.5 text-[10px] font-bold text-wk-danger hover:bg-wk-danger/20">
                {breakdown.failed} failed
              </button>
            )}
          </div>
          {breakdown.latest_error && (
            <p className="mt-0.5 text-[11px] text-wk-danger truncate max-w-lg">{breakdown.latest_error}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-[14px] font-bold text-wk-text">{breakdown.total}</div>
          <div className="text-[11px] text-wk-text-muted">{pct}% imported</div>
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-wk-border overflow-hidden flex">
        {breakdown.imported > 0 && (
          <div className="h-full bg-wk-success" style={{ width: `${(breakdown.imported / breakdown.total) * 100}%` }} />
        )}
        {breakdown.failed > 0 && (
          <div className="h-full bg-wk-danger" style={{ width: `${(breakdown.failed / breakdown.total) * 100}%` }} />
        )}
        {breakdown.skipped > 0 && (
          <div className="h-full bg-wk-surface-raised" style={{ width: `${(breakdown.skipped / breakdown.total) * 100}%` }} />
        )}
        {breakdown.pending > 0 && (
          <div className="h-full bg-wk-warning" style={{ width: `${(breakdown.pending / breakdown.total) * 100}%` }} />
        )}
      </div>
      <div className="mt-1.5 flex gap-4 text-[11px] text-wk-text-muted">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-wk-success inline-block" /> {breakdown.imported} done</span>
        {breakdown.failed > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-wk-danger inline-block" /> {breakdown.failed} failed</span>}
        {breakdown.skipped > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-wk-border inline-block" /> {breakdown.skipped} skipped</span>}
        {breakdown.pending > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-wk-warning inline-block" /> {breakdown.pending} pending</span>}
      </div>
    </div>
  );
}

// ---- Failures Tab ----
function FailuresTab({
  items, actionLoading, onRetry, onSkip, onRetryAll, onSkipAll, navigate,
}: {
  items: ImportItem[];
  actionLoading: Set<string>;
  onRetry: (id: string) => void;
  onSkip: (id: string) => void;
  onRetryAll: () => void;
  onSkipAll: () => void;
  navigate: (path: string) => void;
}) {
  // Group errors by category for the summary
  const errorCategories = useMemo(() => {
    const map = new Map<string, { classification: ErrorClassification; count: number; items: ImportItem[] }>();
    for (const item of items) {
      const classification = classifyImportError(item.error_message ?? "");
      const key = classification.category;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        existing.items.push(item);
      } else {
        map.set(key, { classification, count: 1, items: [item] });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [items]);

  if (items.length === 0) {
    return (
      <WkSurface className="p-10 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-wk-success-soft">
          <WkIcon name="CheckCircle2" size={24} className="text-wk-success" />
        </div>
        <p className="text-[14px] font-bold text-wk-text">No failed items</p>
        <p className="mt-1 text-[12px] text-wk-text-muted">All records were imported successfully.</p>
      </WkSurface>
    );
  }

  return (
    <div className="space-y-5">
      {/* Error summary */}
      <WkSurface className="p-5">
        <h3 className="mb-3 text-[14px] font-bold text-wk-text">Error Summary</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {errorCategories.map((cat) => {
            const c = cat.classification;
            return (
              <div key={c.category} className="rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
                <div className="flex items-center gap-2 mb-1">
                  <WkIcon
                    name={c.category === "missing_table" ? "Table" : c.category === "missing_column" ? "Columns" : c.category === "duplicate_key" ? "Copy" : c.category === "validation" ? "ShieldAlert" : c.category === "network" ? "WifiOff" : "HelpCircle"}
                    size={14}
                    className="text-wk-danger"
                  />
                  <span className="text-[13px] font-bold text-wk-text">{c.label}</span>
                  <span className="rounded-full bg-wk-danger-soft px-1.5 py-0.5 text-[10px] font-bold text-wk-danger">{cat.count}</span>
                </div>
                <p className="text-[11px] text-wk-text-muted">{c.suggestedAction}</p>
                {c.suggestedActionType === "create_table" && (
                  <a
                    href={`https://supabase.com/dashboard/project/_/sql`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-wk-brand hover:underline"
                  >
                    <WkIcon name="ExternalLink" size={12} /> Open Supabase SQL editor
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </WkSurface>

      {/* Bulk actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRetryAll}
          disabled={actionLoading.has("__retry_all")}
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
        >
          <WkIcon name={actionLoading.has("__retry_all") ? "Loader2" : "RefreshCw"} size={14} className={actionLoading.has("__retry_all") ? "animate-spin" : ""} />
          Retry All ({items.length})
        </button>
        <button
          onClick={onSkipAll}
          disabled={actionLoading.has("__skip_all")}
          className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
        >
          <WkIcon name="MinusCircle" size={14} /> Skip All
        </button>
      </div>

      {/* Failed items list */}
      <div className="space-y-2">
        {items.map((item) => {
          const classification = classifyImportError(item.error_message ?? "");
          const isLoading = actionLoading.has(item.id);

          return (
            <div key={item.id} className="rounded-lg border border-wk-border bg-wk-bg-subtle p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wk-danger-soft">
                  <WkIcon name="XCircle" size={14} className="text-wk-danger" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-bold text-wk-text">{item.target_table}</span>
                    <span className="text-[11px] text-wk-text-muted">#{item.legacy_id}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      classification.category === "missing_table" ? "bg-wk-warning-soft text-wk-warning" :
                      classification.category === "duplicate_key" ? "bg-wk-info-soft text-wk-info" :
                      "bg-wk-danger-soft text-wk-danger"
                    }`}>
                      {classification.label}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-wk-danger leading-5 break-all">{item.error_message}</p>
                  <div className="mt-2 flex items-center gap-3 text-[11px]">
                    <span className="text-wk-text-muted">{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                  {/* Suggested action */}
                  <div className="mt-2 rounded-lg border border-wk-warning/20 bg-wk-warning-soft/40 p-2">
                    <div className="flex items-center gap-1.5">
                      <WkIcon name="Lightbulb" size={12} className="text-wk-warning" />
                      <span className="text-[11px] font-semibold text-wk-warning">{classification.suggestedAction}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onRetry(item.id)}
                    disabled={isLoading}
                    className="flex items-center gap-1 rounded-lg border border-wk-border bg-wk-surface px-2.5 py-1.5 text-[11px] font-semibold text-wk-text hover:bg-wk-surface-raised transition-colors whitespace-nowrap"
                  >
                    <WkIcon name={isLoading ? "Loader2" : "RefreshCw"} size={12} className={isLoading ? "animate-spin" : ""} />
                    Retry
                  </button>
                  <button
                    onClick={() => onSkip(item.id)}
                    disabled={isLoading}
                    className="flex items-center gap-1 rounded-lg border border-wk-border bg-wk-surface px-2.5 py-1.5 text-[11px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised transition-colors whitespace-nowrap"
                  >
                    <WkIcon name="MinusCircle" size={12} /> Skip
                  </button>
                  <button
                    onClick={() => navigate(`/admin/imports/jobs/${item.job_id}`)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
                    title="View in job detail"
                  >
                    <WkIcon name="Eye" size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- All Items Tab ----
function AllItemsTab({ items }: { items: ImportItem[] }) {
  if (items.length === 0) {
    return (
      <WkSurface className="p-10 text-center">
        <WkIcon name="Inbox" size={28} className="mx-auto mb-3 text-wk-text-muted" />
        <p className="text-[13px] text-wk-text-muted">No import items found for this run.</p>
      </WkSurface>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">
        <span className="w-6" />
        <span className="flex-1">Target Table / Source ID</span>
        <span className="w-20 text-right">Status</span>
        <span className="w-36 text-right">Date</span>
      </div>
      {items.slice(0, 100).map((item) => (
        <div key={item.id} className="flex items-center gap-3 rounded-lg border border-wk-border bg-wk-bg-subtle px-4 py-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-wk-surface-raised">
            <WkIcon
              name={item.status === "imported" ? "CheckCircle2" : item.status === "failed" ? "XCircle" : item.status === "skipped" ? "MinusCircle" : "Clock"}
              size={12}
              className={item.status === "imported" ? "text-wk-success" : item.status === "failed" ? "text-wk-danger" : "text-wk-text-muted"}
            />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[12px] font-semibold text-wk-text">{item.target_table}</span>
            <span className="ml-2 text-[11px] text-wk-text-muted">#{item.legacy_id}</span>
          </div>
          <div className="w-20 text-right">
            <span className={`text-[11px] font-bold uppercase ${
              item.status === "imported" ? "text-wk-success" : item.status === "failed" ? "text-wk-danger" : "text-wk-text-muted"
            }`}>
              {item.status}
            </span>
          </div>
          <div className="w-36 text-right text-[11px] text-wk-text-muted">{new Date(item.created_at).toLocaleDateString()}</div>
        </div>
      ))}
      {items.length > 100 && (
        <p className="text-center text-[12px] text-wk-text-muted py-4">Showing first 100 of {items.length} items.</p>
      )}
    </div>
  );
}

// ---- Overview Tab ----
function OverviewTab({ run, summary, onProcess, processing }: { run: IngestionRun; summary: ImportRunSummary | null; onProcess: () => void; processing: boolean }) {
  const counts = run.imported_counts ?? {};
  const manifest = (run.source_manifest ?? {}) as Record<string, unknown>;
  const reviewItems = (manifest._review_items as Record<string, unknown>) || null;
  const draftCounts = (manifest._draft_counts as Record<string, number>) || {};

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        {/* Imported counts from run */}
        <WkSurface className="p-5">
          <h3 className="mb-4 text-[14px] font-bold text-wk-text">Exported Records</h3>
          {Object.keys(counts).length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(counts).map(([key, count]) => (
                <div key={key} className="rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
                  <div className="text-[18px] font-black text-wk-text">{Number(count).toLocaleString()}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-wk-text-muted">{key}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-6 text-center">
              <p className="text-[13px] text-wk-text-muted">No imported counts recorded yet.</p>
            </div>
          )}
        </WkSurface>

        {/* Draft counts */}
        {Object.keys(draftCounts).length > 0 && (
          <WkSurface className="p-5">
            <h3 className="mb-4 flex items-center gap-2 text-[14px] font-bold text-wk-text">
              <WkIcon name="FileText" size={16} className="text-wk-warning" />
              Preserved Drafts
            </h3>
            <p className="mb-4 text-[12px] text-wk-text-muted">
              These records were marked as <span className="font-semibold text-wk-warning">draft</span> in WordPress and stayed draft here.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(draftCounts).map(([key, count]) => (
                <div key={key} className="rounded-lg border border-wk-warning/20 bg-wk-warning-soft p-3">
                  <div className="text-[18px] font-black text-wk-warning">{Number(count).toLocaleString()}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-wk-text-muted">{key}</div>
                </div>
              ))}
            </div>
          </WkSurface>
        )}

        {/* Review Flags (metadata that doesn't have UI) */}
        {reviewItems && (reviewItems.total_fields_flagged as number) > 0 && (
          <WkSurface className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-wk-text">
              <WkIcon name="Flag" size={16} className="text-wk-accent" />
              Import Review Flags
            </h3>
            <p className="mb-4 text-[12px] text-wk-text-muted">
              <span className="font-bold text-wk-text">{(reviewItems.total_fields_flagged as number)} fields</span> were imported into metadata JSONB because they don&apos;t have dedicated UI columns yet. Review these and decide if new columns or admin fields are needed.
            </p>

            {/* By entity summary */}
            {reviewItems.by_entity && (
              <div className="mb-4 flex flex-wrap gap-2">
                {Object.entries(reviewItems.by_entity as Record<string, number>).map(([table, count]) => (
                  <span key={table} className="rounded-full border border-wk-accent/20 bg-wk-accent-soft px-3 py-1 text-[11px] font-semibold text-wk-accent">
                    {table}: {count} fields
                  </span>
                ))}
              </div>
            )}

            {/* Items list */}
            <div className="max-h-[400px] overflow-auto space-y-1.5">
              {Array.isArray(reviewItems.items) && (reviewItems.items as Array<Record<string, unknown>>).slice(0, 50).map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-wk-accent-soft">
                    <WkIcon name="Flag" size={12} className="text-wk-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[11px] font-bold text-wk-text">{item.wp_meta_key as string}</span>
                      <span className="text-[10px] text-wk-text-muted">→ {item.entity_table as string}.{item.field as string}</span>
                    </div>
                    <p className="text-[11px] text-wk-text-muted">{item.suggestion as string}</p>
                    {item.sample_value && (
                      <p className="mt-1 text-[10px] text-wk-text-muted/70 truncate max-w-lg">Sample: {(item.sample_value as string).slice(0, 120)}</p>
                    )}
                  </div>
                </div>
              ))}
              {(reviewItems.items as Array<unknown> | undefined)?.length && (reviewItems.items as Array<unknown>).length > 50 && (
                <p className="text-center text-[11px] text-wk-text-muted py-2">Showing 50 of {(reviewItems.items as Array<unknown>).length} flagged fields.</p>
              )}
            </div>

            <div className="mt-4 rounded-lg border border-wk-accent/10 bg-wk-accent-soft/50 p-3">
              <div className="flex items-start gap-2">
                <WkIcon name="Lightbulb" size={14} className="text-wk-accent shrink-0 mt-0.5" />
                <div className="text-[11px] text-wk-text-muted">
                  To resolve: either add database columns in Supabase for these fields and update the admin editor, or keep them in the <code className="rounded bg-wk-border px-1 text-wk-text">metadata</code> JSONB column and build custom display components.
                </div>
              </div>
            </div>
          </WkSurface>
        )}

        {/* Summary from per-item tracking */}
        {summary && summary.entityBreakdowns.length > 0 && (
          <WkSurface className="p-5">
            <h3 className="mb-4 text-[14px] font-bold text-wk-text">Per-Entity Status</h3>
            <div className="space-y-0.5">
              {summary.entityBreakdowns.map((eb) => (
                <div key={eb.target_table} className="flex items-center gap-3 py-2">
                  <span className="text-[12px] font-semibold text-wk-text w-48 truncate">{eb.target_table}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-wk-border overflow-hidden flex">
                    {eb.imported > 0 && <div className="h-full bg-wk-success" style={{ width: `${(eb.imported / eb.total) * 100}%` }} />}
                    {eb.failed > 0 && <div className="h-full bg-wk-danger" style={{ width: `${(eb.failed / eb.total) * 100}%` }} />}
                    {eb.skipped > 0 && <div className="h-full bg-wk-surface-raised" style={{ width: `${(eb.skipped / eb.total) * 100}%` }} />}
                  </div>
                  <span className="text-[11px] text-wk-text-muted w-20 text-right">{eb.total} items</span>
                </div>
              ))}
            </div>
          </WkSurface>
        )}

        {/* Warnings */}
        {(run.warnings ?? []).length > 0 && (
          <WkSurface className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-wk-text">
              <WkIcon name="AlertTriangle" size={16} className="text-wk-warning" /> Warnings ({run.warnings!.length})
            </h3>
            <div className="space-y-2">
              {run.warnings!.map((w, i) => (
                <div key={i} className="rounded-lg border border-wk-warning/20 bg-wk-warning-soft p-3 text-[12px] text-wk-warning">{w}</div>
              ))}
            </div>
          </WkSurface>
        )}

        {/* Errors */}
        {(run.errors ?? []).length > 0 && (
          <WkSurface className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-wk-text">
              <WkIcon name="AlertCircle" size={16} className="text-wk-danger" /> Errors ({run.errors!.length})
            </h3>
            <div className="space-y-2">
              {run.errors!.map((e, i) => (
                <div key={i} className="rounded-lg border border-wk-danger/20 bg-wk-danger-soft p-3 text-[12px] text-wk-danger">{e}</div>
              ))}
            </div>
          </WkSurface>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <WkSurface className="p-5">
          <h3 className="mb-3 text-[14px] font-bold text-wk-text">Job Info</h3>
          <div className="space-y-3">
            <InfoRow label="ID" value={run.id} />
            <InfoRow label="Source" value={run.source_name} />
            <InfoRow label="Kind" value={run.source_kind} />
            <InfoRow label="Status" value={run.status} />
            <InfoRow label="Created" value={new Date(run.created_at).toLocaleString()} />
            {run.started_at && <InfoRow label="Started" value={new Date(run.started_at).toLocaleString()} />}
            {run.finished_at && <InfoRow label="Finished" value={new Date(run.finished_at).toLocaleString()} />}
          </div>
        </WkSurface>

        <WkSurface className="p-5">
          <h3 className="mb-3 text-[14px] font-bold text-wk-text">Quick Actions</h3>
          <div className="space-y-2">
            {(run.status === "queued" || run.status === "scanned" || run.status === "mapped" || run.status === "planned" || run.status === "staged") && (
              <button
                onClick={onProcess}
                disabled={processing}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-wk-brand bg-wk-brand-soft px-3 py-2.5 text-[12px] font-bold text-wk-brand hover:bg-wk-brand/20 transition-colors whitespace-nowrap"
              >
                <WkIcon name={processing ? "Loader2" : "Play"} size={14} className={processing ? "animate-spin" : ""} />
                {processing ? "Processing..." : "Process Import"}
              </button>
            )}
            <button
              onClick={() => window.open("https://supabase.com/dashboard", "_blank")}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[12px] font-semibold text-wk-text hover:bg-wk-surface-raised transition-colors whitespace-nowrap"
            >
              <WkIcon name="ExternalLink" size={14} /> Open Supabase Dashboard
            </button>
            <button
              onClick={() => window.open(`https://supabase.com/dashboard/project/_/editor?table=legacy_import_records`, "_blank")}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[12px] font-semibold text-wk-text hover:bg-wk-surface-raised transition-colors whitespace-nowrap"
            >
              <WkIcon name="Table" size={14} /> View Import Records
            </button>
          </div>
        </WkSurface>
      </div>
    </div>
  );
}

// ---- Shared ----
function StatusBadge({ status }: { status: string }) {
  const color = status === "completed"
    ? "bg-wk-success-soft text-wk-success"
    : RUNNING_STATUSES.has(status)
    ? "bg-wk-info-soft text-wk-info"
    : status === "failed"
    ? "bg-wk-danger-soft text-wk-danger"
    : status === "queued"
    ? "bg-wk-warning-soft text-wk-warning"
    : "bg-wk-surface-raised text-wk-text-muted";
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase ${color} whitespace-nowrap`}>
      {status}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[12px] font-semibold text-wk-text-muted">{label}</span>
      <span className="text-right text-[12px] text-wk-text break-all">{value}</span>
    </div>
  );
}