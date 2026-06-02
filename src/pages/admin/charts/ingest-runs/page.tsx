import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getIngestRuns, getIngestKpis, resetStudioStore } from "@/services/chartsIngestion/client";
import type { IngestRun } from "@/services/chartsIngestion/ingestStudioTypes";
import { WkSurface } from "@/components/design-system/primitives/Surface";

export default function AdminChartsIngestRuns() {
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [kpis, setKpis] = useState({ editionsThisWeek: 0, canonicalMatchRate: 0, rowsAwaitingReview: 0, averageRunTimeMs: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const [r, k] = await Promise.all([getIngestRuns(), getIngestKpis()]);
      setRuns(r);
      setKpis(k);
      setLoading(false);
    }
    load();
  }, []);

  const filteredRuns = filter === "all" ? runs : runs.filter((r) => r.status === filter);

  const statusBadge = (status: string) => {
    const classes: Record<string, string> = {
      draft: "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]",
      running: "bg-[var(--wk-info-soft)] text-[var(--wk-info)]",
      dry_run_complete: "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]",
      ready_to_commit: "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]",
      committing: "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]",
      committed: "bg-[var(--wk-success-soft)] text-[var(--wk-success)]",
      failed: "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]",
      cancelled: "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]",
      needs_review: "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]",
    };
    return classes[status] || classes.draft;
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: "Draft", running: "Running", dry_run_complete: "Dry Run Complete",
      ready_to_commit: "Ready to Commit", committing: "Committing", committed: "Committed",
      failed: "Failed", cancelled: "Cancelled", needs_review: "Needs Review",
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[var(--wk-text-muted)]">Loading ingest runs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--wk-text)]">Ingest Runs</h1>
          <p className="text-[13px] text-[var(--wk-text-muted)]">All provider-based ingestion runs and their status</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/admin/charts/ingest")}
            className="wk-button wk-button-primary whitespace-nowrap"
          >
            <i className="ri-add-line" />
            New Run
          </button>
          <button
            onClick={async () => { await resetStudioStore(); window.location.reload(); }}
            className="wk-button wk-button-ghost whitespace-nowrap"
          >
            <i className="ri-refresh-line" />
            Reset
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <WkSurface className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-faint)]">Editions This Week</p>
          <p className="mt-1 text-[24px] font-black text-[var(--wk-text)]">{kpis.editionsThisWeek}</p>
        </WkSurface>
        <WkSurface className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-faint)]">Canonical Match Rate</p>
          <p className="mt-1 text-[24px] font-black text-[var(--wk-text)]">{kpis.canonicalMatchRate.toFixed(1)}%</p>
        </WkSurface>
        <WkSurface className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-faint)]">Rows Awaiting Review</p>
          <p className="mt-1 text-[24px] font-black text-[var(--wk-text)]">{kpis.rowsAwaitingReview}</p>
        </WkSurface>
        <WkSurface className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-faint)]">Avg Run Time</p>
          <p className="mt-1 text-[24px] font-black text-[var(--wk-text)]">{(kpis.averageRunTimeMs / 1000).toFixed(1)}s</p>
        </WkSurface>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {["all", "running", "dry_run_complete", "ready_to_commit", "committed", "failed", "needs_review"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all ${
              filter === s
                ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                : "bg-[var(--wk-surface)] text-[var(--wk-text-soft)] border border-[var(--wk-border)] hover:bg-[var(--wk-surface-raised)]"
            }`}
          >
            {s === "all" ? "All" : statusLabel(s)}
          </button>
        ))}
      </div>

      {/* Runs Table */}
      <WkSurface className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--wk-border)]">
                <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]">Chart</th>
                <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]">Status</th>
                <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]">Providers</th>
                <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]">Rows</th>
                <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]">Match Rate</th>
                <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]">Date</th>
                <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]">Actor</th>
                <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map((run) => (
                <tr
                  key={run.id}
                  className="border-b border-[var(--wk-border)]/50 transition-colors hover:bg-[var(--wk-surface-raised)]/50"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[var(--wk-text)]">{run.chartTitle}</div>
                    <div className="text-[11px] text-[var(--wk-text-muted)]">{run.chartSlug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadge(run.status)}`}>
                      {statusLabel(run.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {run.detectedProviders.map((p) => (
                        <span key={p} className="rounded px-1.5 py-0.5 text-[11px] font-semibold bg-[var(--wk-surface-raised)] text-[var(--wk-text-soft)] border border-[var(--wk-border)]">
                          {p === "spotify" ? "Spotify" : p === "apple_music" ? "Apple" : p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--wk-text-soft)]">{run.summary.totalRows}</td>
                  <td className="px-4 py-3 text-[var(--wk-text-soft)]">{run.summary.matchRate.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-[var(--wk-text-muted)]">{run.editionDate}</td>
                  <td className="px-4 py-3 text-[var(--wk-text-muted)]">{run.createdBy}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/admin/charts/ingest-runs/${run.id}`)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-[var(--wk-brand)] hover:bg-[var(--wk-brand-soft)] transition-colors"
                    >
                      <i className="ri-arrow-right-line" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredRuns.length === 0 && (
          <div className="px-4 py-12 text-center text-[13px] text-[var(--wk-text-muted)]">
            No runs match the selected filter.
          </div>
        )}
      </WkSurface>
    </div>
  );
}