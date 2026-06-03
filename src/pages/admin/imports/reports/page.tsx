import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";

interface IngestRun {
  id: string;
  source_name: string;
  source_kind: string;
  status: string;
  imported_counts: Record<string, number> | null;
  warnings: string[] | null;
  errors: string[] | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export default function AdminImportsReportsPage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("wk_ingestion_runs")
        .select("id, source_name, source_kind, status, imported_counts, warnings, errors, started_at, finished_at, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) console.error(error);
      else setRuns(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const completed = runs.filter((r) => r.status === "completed");
  const failed = runs.filter((r) => r.status === "failed");
  const totalImported = runs.reduce((sum, r) => {
    if (!r.imported_counts) return sum;
    return sum + Object.values(r.imported_counts).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);
  }, 0);
  const totalWarnings = runs.reduce((sum, r) => sum + (r.warnings?.length ?? 0), 0);
  const totalErrors = runs.reduce((sum, r) => sum + (r.errors?.length ?? 0), 0);

  const entityCounts: Record<string, number> = {};
  runs.forEach((r) => {
    if (!r.imported_counts) return;
    Object.entries(r.imported_counts).forEach(([key, count]) => {
      entityCounts[key] = (entityCounts[key] || 0) + (typeof count === "number" ? count : 0);
    });
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Imports</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Import Reports</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            {runs.length} total jobs · {completed.length} completed · {failed.length} failed
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/imports/jobs")}
          className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
        >
          <WkIcon name="List" size={14} />
          View Jobs
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon="CheckCircle2" label="Completed Jobs" value={completed.length} color="success" />
        <SummaryCard icon="XCircle" label="Failed Jobs" value={failed.length} color="danger" />
        <SummaryCard icon="Database" label="Total Imported" value={totalImported} color="brand" />
        <SummaryCard icon="AlertTriangle" label="Total Warnings" value={totalWarnings} color="warning" />
      </div>

      {/* Entity Breakdown */}
      <WkSurface className="p-5">
        <h2 className="mb-4 text-[14px] font-bold text-wk-text">Entity Breakdown</h2>
        {Object.keys(entityCounts).length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(entityCounts).map(([key, count]) => (
              <div key={key} className="rounded-lg border border-wk-border bg-wk-bg-subtle p-4">
                <div className="text-[22px] font-black text-wk-text">{count}</div>
                <div className="mt-0.5 text-[11px] font-semibold text-wk-text-muted uppercase tracking-wider">{key}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-6 text-center">
            <p className="text-[13px] text-wk-text-muted">No import data available yet.</p>
          </div>
        )}
      </WkSurface>

      {/* Recent Jobs Table */}
      <WkSurface className="p-5">
        <h2 className="mb-4 text-[14px] font-bold text-wk-text">Recent Jobs</h2>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg border border-wk-border bg-wk-bg-subtle p-4">
                <div className="h-4 w-48 rounded bg-wk-surface-raised mb-2" />
                <div className="h-3 w-32 rounded bg-wk-surface-raised" />
              </div>
            ))}
          </div>
        ) : runs.length > 0 ? (
          <div className="space-y-2">
            {runs.slice(0, 20).map((run) => (
              <button
                key={run.id}
                onClick={() => navigate(`/admin/imports/jobs/${run.id}`)}
                className="flex w-full items-center gap-3 rounded-lg border border-wk-border bg-wk-bg-subtle p-3 text-left transition-all hover:bg-wk-surface-raised"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-wk-surface-raised">
                  <WkIcon
                    name={run.status === "completed" ? "CheckCircle2" : run.status === "failed" ? "XCircle" : "Clock"}
                    size={14}
                    className={run.status === "completed" ? "text-wk-success" : run.status === "failed" ? "text-wk-danger" : "text-wk-text-muted"}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-wk-text">{run.source_name}</div>
                  <div className="text-[11px] text-wk-text-muted">{run.source_kind} · {new Date(run.created_at).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-wk-text-muted">
                    {run.imported_counts ? Object.values(run.imported_counts).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0) : 0} items
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    run.status === "completed" ? "bg-wk-success-soft text-wk-success" :
                    run.status === "failed" ? "bg-wk-danger-soft text-wk-danger" :
                    "bg-wk-warning-soft text-wk-warning"
                  }`}>
                    {run.status}
                  </span>
                  <WkIcon name="ChevronRight" size={14} className="text-wk-text-faint" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-6 text-center">
            <p className="text-[13px] text-wk-text-muted">No import jobs found.</p>
          </div>
        )}
      </WkSurface>
    </div>
  );
}

function SummaryCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  const colorClass = {
    success: "bg-wk-success-soft text-wk-success",
    danger: "bg-wk-danger-soft text-wk-danger",
    warning: "bg-wk-warning-soft text-wk-warning",
    brand: "bg-wk-brand-soft text-wk-brand",
    info: "bg-wk-info-soft text-wk-info",
  }[color] || "bg-wk-surface-raised text-wk-text-muted";

  return (
    <div className="rounded-xl border border-wk-border bg-wk-surface p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colorClass}`}>
          <WkIcon name={icon as never} size={16} />
        </div>
        <div>
          <div className="text-[22px] font-black text-wk-text">{value}</div>
          <div className="text-[11px] font-semibold text-wk-text-muted uppercase tracking-wider">{label}</div>
        </div>
      </div>
    </div>
  );
}