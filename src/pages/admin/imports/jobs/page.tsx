import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";

interface IngestRun {
  id: string;
  source_name: string;
  source_kind: string;
  source_manifest: Record<string, unknown> | null;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  imported_counts: Record<string, number> | null;
  warnings: string[] | null;
  errors: string[] | null;
}

function getScan(run: IngestRun) {
  const scan = run.source_manifest?.scan;
  return scan && typeof scan === "object" ? scan as { archive?: { file_count?: number }; counts?: Record<string, number> } : null;
}
function getMappings(run: IngestRun) {
  const mappings = run.source_manifest?.mappings;
  return mappings && typeof mappings === "object" ? mappings as { summary?: { total?: number; auto_matched?: number; needs_review?: number }; candidates?: unknown[] } : null;
}
function getStagingPlan(run: IngestRun) {
  const plan = run.source_manifest?.staging_plan;
  return plan && typeof plan === "object" ? plan as { buckets?: unknown[]; readiness?: { ready_bucket_count?: number; blocked_bucket_count?: number; can_stage_anything?: boolean } } : null;
}
function getTotalImported(counts: Record<string, number> | null): number { if (!counts) return 0; return Object.values(counts).reduce((sum, v) => sum + (typeof v === "number" ? v : 0), 0); }

const RUNNING = new Set(["running", "validating", "staging", "promoting", "processing", "scanning"]);

export default function AdminImportsJobsPage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("wk_ingestion_runs")
      .select("id, source_name, source_kind, source_manifest, status, started_at, finished_at, created_at, imported_counts, warnings, errors")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) console.error("Error loading import jobs:", error);
    else setRuns(data ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const filtered = runs.filter((r) => {
    const matchesSearch = !search || r.source_name.toLowerCase().includes(search.toLowerCase()) || r.source_kind.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = runs.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const totalImportedAll = runs.reduce((sum, r) => sum + getTotalImported(r.imported_counts), 0);
  const totalErrors = runs.reduce((sum, r) => sum + (r.errors?.length ?? 0), 0);
  const totalWarnings = runs.reduce((sum, r) => sum + (r.warnings?.length ?? 0), 0);
  const activeRuns = runs.filter((r) => RUNNING.has(r.status)).length;

  const statusOptions = ["all", "queued", "scanning", "scanned", "mapped", "planned", "running", "completed", "failed", "paused"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Imports</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Import Jobs</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            {runs.length} total runs · {activeRuns} active · {statusCounts["completed"] || 0} completed · {statusCounts["failed"] || 0} failed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"><WkIcon name="RefreshCw" size={14} /> Refresh</button>
          <button onClick={() => navigate("/admin/imports/wordpress-connect")} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"><WkIcon name="Link" size={14} /> Connect WordPress</button>
          <button onClick={() => navigate("/admin/imports/upload")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"><WkIcon name="Upload" size={14} /> Upload</button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Total Records Imported" value={totalImportedAll} icon="Layers" color="wk-text" />
        <KpiCard label="Active Runs" value={activeRuns} icon="Loader2" color={activeRuns > 0 ? "wk-info" : "wk-text-muted"} />
        <KpiCard label="Completed" value={statusCounts["completed"] || 0} icon="CheckCircle2" color="wk-success" />
        <KpiCard label="Failed" value={statusCounts["failed"] || 0} icon="XCircle" color={(statusCounts["failed"] || 0) > 0 ? "wk-danger" : "wk-text-muted"} />
        <KpiCard label="Warnings" value={totalWarnings} icon="AlertTriangle" color={totalWarnings > 0 ? "wk-warning" : "wk-text-muted"} />
      </div>

      {/* Errors Banner */}
      {totalErrors > 0 && (
        <div className="rounded-xl border border-wk-danger/20 bg-wk-danger-soft p-4">
          <div className="flex items-center gap-3">
            <WkIcon name="AlertCircle" size={18} className="text-wk-danger" />
            <div>
              <span className="text-[13px] font-bold text-wk-danger">{totalErrors} errors across all runs</span>
              <button onClick={() => navigate("/admin/imports/failed")} className="ml-3 text-[12px] font-semibold text-wk-danger underline whitespace-nowrap">View failed records</button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <WkSurface className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex max-w-md flex-1 items-center gap-2 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2">
            <WkIcon name="Search" size={14} className="text-wk-text-faint" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by source name or kind..." className="w-full bg-transparent text-[13px] text-wk-text outline-none placeholder:text-wk-text-faint" />
            {search && <button onClick={() => setSearch("")} className="text-wk-text-faint hover:text-wk-text"><WkIcon name="X" size={14} /></button>}
          </div>
          <div className="flex items-center gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="cursor-pointer rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none">
              <option value="all">All Status</option>
              {statusOptions.filter((s) => s !== "all").map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <span className="whitespace-nowrap text-[12px] text-wk-text-muted">{filtered.length} of {runs.length}</span>
          </div>
        </div>
      </WkSurface>

      {/* Runs Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-wk-border bg-wk-surface p-4">
              <div className="mb-2 h-4 w-48 rounded bg-wk-surface-raised" />
              <div className="h-3 w-32 rounded bg-wk-surface-raised" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length > 0 ? (
            filtered.map((run) => {
              const scan = getScan(run);
              const mappings = getMappings(run);
              const plan = getStagingPlan(run);
              const totalImp = getTotalImported(run.imported_counts);
              const errCount = run.errors?.length ?? 0;
              const isRunning = RUNNING.has(run.status);

              return (
                <div
                  key={run.id}
                  onClick={() => navigate(`/admin/imports/jobs/${run.id}`)}
                  className="cursor-pointer rounded-lg border border-wk-border bg-wk-bg-subtle p-4 transition-colors hover:bg-wk-surface"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wk-surface-raised">
                      <WkIcon
                        name={run.status === "completed" ? "CheckCircle2" : run.status === "failed" ? "XCircle" : isRunning ? "Loader2" : "Clock"}
                        size={16}
                        className={run.status === "completed" ? "text-wk-success" : run.status === "failed" ? "text-wk-danger" : isRunning ? "animate-spin text-wk-info" : "text-wk-warning"}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-bold text-wk-text truncate">{run.source_name}</span>
                        <span className="text-[11px] text-wk-text-muted">{run.source_kind}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-wk-text-muted">
                        <span>Imported: {totalImp.toLocaleString()} records</span>
                        {scan && <span>Scan: {scan.archive?.file_count ?? 0} files</span>}
                        {mappings && <span>Mappings: {mappings.candidates?.length ?? 0}</span>}
                        {plan && <span>Buckets: {plan.buckets?.length ?? 0}</span>}
                        <span>{new Date(run.created_at).toLocaleDateString()}</span>
                      </div>
                      {/* Imported counts preview */}
                      {run.imported_counts && Object.keys(run.imported_counts).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Object.entries(run.imported_counts).slice(0, 6).map(([key, count]) => (
                            <span key={key} className="rounded-full border border-wk-border bg-wk-surface-raised px-2 py-0.5 text-[10px] font-semibold text-wk-text-muted">
                              {key}: {Number(count).toLocaleString()}
                            </span>
                          ))}
                          {Object.keys(run.imported_counts).length > 6 && (
                            <span className="rounded-full border border-wk-border bg-wk-surface-raised px-2 py-0.5 text-[10px] font-semibold text-wk-text-muted">
                              +{Object.keys(run.imported_counts).length - 6} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <StatusBadge status={run.status} />
                      {errCount > 0 && (
                        <span className="rounded-full bg-wk-danger-soft px-2 py-0.5 text-[10px] font-bold text-wk-danger">{errCount} errors</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <WkSurface className="p-10 text-center">
              <WkIcon name="Inbox" size={28} className="mx-auto mb-3 text-wk-text-muted" />
              <p className="text-[14px] font-bold text-wk-text">No import jobs found</p>
              <p className="mt-1 text-[12px] text-wk-text-muted">Start by connecting a WordPress site or uploading a ZIP export.</p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button onClick={() => navigate("/admin/imports/wordpress-connect")} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"><WkIcon name="Link" size={14} /> Connect WordPress</button>
                <button onClick={() => navigate("/admin/imports/upload")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"><WkIcon name="Upload" size={14} /> Upload ZIP</button>
              </div>
            </WkSurface>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
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

function StatusBadge({ status }: { status: string }) {
  const color = status === "completed"
    ? "bg-wk-success-soft text-wk-success"
    : RUNNING.has(status)
    ? "bg-wk-info-soft text-wk-info"
    : status === "failed"
    ? "bg-wk-danger-soft text-wk-danger"
    : status === "queued"
    ? "bg-wk-warning-soft text-wk-warning"
    : status === "scanned" || status === "mapped" || status === "planned"
    ? "bg-wk-brand-soft text-wk-brand"
    : "bg-wk-surface-raised text-wk-text-muted";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${color} whitespace-nowrap`}>
      {status}
    </span>
  );
}