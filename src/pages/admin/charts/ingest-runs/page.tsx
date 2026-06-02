import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getIngestRuns, getIngestKpis, cancelIngestRun, retryIngestRun, sendGapsToReview } from "@/services/chartsIngestion/client";
import type { IngestRun } from "@/services/chartsIngestion/ingestStudioTypes";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminChartsPageHeader } from "../components/AdminChartsPageHeader";
import { AdminChartsKpiCard } from "../components/AdminChartsKpiCard";
import { AdminChartsStatusBadge } from "../components/AdminChartsStatusBadge";
import { AdminChartsEmptyState } from "../components/AdminChartsEmptyState";
import { AdminChartsLoadingState } from "../components/AdminChartsLoadingState";
import { AdminChartsConfirmDialog } from "../components/AdminChartsConfirmDialog";

const ALL_STATUSES = ["all", "running", "dry_run_complete", "ready_to_commit", "committed", "failed", "needs_review", "cancelled"];

export default function AdminChartsIngestRuns() {
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [kpis, setKpis] = useState({ editionsThisWeek: 0, canonicalMatchRate: 0, rowsAwaitingReview: 0, averageRunTimeMs: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [seriesFilter, setSeriesFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<IngestRun | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    const [r, k] = await Promise.all([getIngestRuns(), getIngestKpis()]);
    setRuns(r);
    setKpis(k);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleCancel = async (run: IngestRun) => {
    setActionLoading(run.id + "_cancel");
    try {
      await cancelIngestRun(run.id);
      await load();
      showToast(`Run "${run.chartTitle}" cancelled.`);
    } catch (err) {
      showToast(`Failed to cancel: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setActionLoading(null);
      setCancelTarget(null);
    }
  };

  const handleRetry = async (run: IngestRun) => {
    setActionLoading(run.id + "_retry");
    try {
      await retryIngestRun(run.id);
      await load();
      showToast(`Run "${run.chartTitle}" queued for retry.`);
    } catch (err) {
      showToast(`Failed to retry: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendGaps = async (run: IngestRun) => {
    setActionLoading(run.id + "_gaps");
    try {
      await sendGapsToReview(run.id);
      await load();
      showToast(`${run.summary.gaps} gap(s) from "${run.chartTitle}" sent to review.`);
    } catch (err) {
      showToast(`Failed to send gaps: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setActionLoading(null);
    }
  };

  const allSeries = Array.from(new Set(runs.map((r) => r.chartSlug)));
  const allProviders = Array.from(new Set(runs.flatMap((r) => r.detectedProviders)));

  const filteredRuns = runs.filter((r) => {
    const matchStatus = filter === "all" || r.status === filter;
    const matchSeries = seriesFilter === "all" || r.chartSlug === seriesFilter;
    const matchProvider = providerFilter === "all" || r.detectedProviders.includes(providerFilter as never);
    const matchSearch = !search || r.chartTitle.toLowerCase().includes(search.toLowerCase()) || r.editionDate.includes(search) || r.createdBy.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSeries && matchProvider && matchSearch;
  });

  if (loading) return <AdminChartsLoadingState message="Loading ingest runs..." />;

  const failedCount = runs.filter((r) => r.status === "failed").length;
  const needsReviewCount = runs.filter((r) => r.status === "needs_review" || r.summary.gaps > 0).length;

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-wk-surface-strong px-4 py-3 text-[13px] font-semibold text-wk-text shadow-lg border border-wk-border">
          {toastMsg}
        </div>
      )}

      <AdminChartsConfirmDialog
        open={!!cancelTarget}
        title="Cancel this run?"
        description={cancelTarget ? `"${cancelTarget.chartTitle}" will be cancelled and cannot be resumed. Start a new run instead.` : ""}
        confirmLabel="Yes, Cancel Run"
        variant="danger"
        onConfirm={() => cancelTarget && handleCancel(cancelTarget)}
        onCancel={() => setCancelTarget(null)}
        loading={!!actionLoading}
      />

      <AdminChartsPageHeader
        eyebrow="Chart Operations"
        title="Ingest Runs"
        description="Provider-based ingestion runs — Spotify and Apple Music playlist pipelines"
      >
        <button onClick={() => navigate("/admin/settings/charts/ingest")} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
          <i className="ri-add-line" />
          New Run
        </button>
        <button onClick={load} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
          <i className="ri-refresh-line" />
          Refresh
        </button>
      </AdminChartsPageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminChartsKpiCard
          value={kpis.editionsThisWeek}
          label="Editions This Week"
          icon="CalendarCheck"
          accent="brand"
        />
        <AdminChartsKpiCard
          value={`${kpis.canonicalMatchRate.toFixed(1)}%`}
          label="Match Rate"
          icon="BarChart3"
          accent={kpis.canonicalMatchRate >= 85 ? "success" : "warning"}
        />
        <AdminChartsKpiCard
          value={needsReviewCount}
          label="Needs Review"
          icon="Flag"
          accent={needsReviewCount > 0 ? "warning" : "muted"}
        />
        <AdminChartsKpiCard
          value={failedCount}
          label="Failed"
          icon="AlertCircle"
          accent={failedCount > 0 ? "danger" : "muted"}
        />
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all ${
                filter === s
                  ? "bg-wk-brand text-wk-brand-on"
                  : "bg-wk-surface text-wk-text-soft border border-wk-border hover:bg-wk-surface-raised"
              }`}
            >
              {s === "all" ? "All" : s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
              {s !== "all" && (
                <span className="ml-1 text-[10px] opacity-70">
                  ({runs.filter((r) => r.status === s).length})
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-wk-text-faint text-[13px]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search runs by title, date, or creator…"
              className="w-full rounded-lg border border-wk-border bg-wk-surface py-2 pl-9 pr-3 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-border-strong"
            />
          </div>
          {allSeries.length > 1 && (
            <select
              value={seriesFilter}
              onChange={(e) => setSeriesFilter(e.target.value)}
              className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none"
            >
              <option value="all">All Series</option>
              {allSeries.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {allProviders.length > 1 && (
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none"
            >
              <option value="all">All Providers</option>
              {allProviders.map((p) => <option key={p} value={p}>{p === "spotify" ? "Spotify" : p === "apple_music" ? "Apple Music" : p}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Runs Table */}
      <WkSurface className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-wk-border">
                {["Chart", "Status", "Edition Date", "Providers", "Rows", "Match Rate", "Gaps", "By", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map((run) => {
                const hasGaps = run.summary.gaps > 0;
                const isFailed = run.status === "failed";
                const isActive = run.status === "running";
                const isCommitted = run.status === "committed";
                const canCancel = run.status === "running" || run.status === "draft";
                const canRetry = run.status === "failed" || run.status === "cancelled";
                const canSendGaps = hasGaps && run.status !== "cancelled";

                return (
                  <tr
                    key={run.id}
                    className={`border-b border-wk-border/50 transition-colors hover:bg-wk-surface-raised/50 ${isFailed ? "bg-wk-danger-soft/30" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-wk-text">{run.chartTitle}</div>
                      <div className="text-[11px] text-wk-text-muted font-mono">{run.chartSlug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {isActive && <span className="h-2 w-2 shrink-0 rounded-full bg-wk-info animate-pulse" />}
                        <AdminChartsStatusBadge status={run.status} size="sm" />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-wk-text-soft">{run.editionDate}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {run.detectedProviders.map((p) => (
                          <span
                            key={p}
                            className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-wk-surface-raised text-wk-text-soft border border-wk-border"
                          >
                            {p === "spotify" ? "SFY" : p === "apple_music" ? "AM" : p.substring(0, 3).toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-wk-text-soft">{run.summary.totalRows}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-14 rounded-full bg-wk-surface-raised overflow-hidden">
                          <div
                            className={`h-full rounded-full ${run.summary.matchRate >= 85 ? "bg-wk-success" : run.summary.matchRate >= 70 ? "bg-wk-warning" : "bg-wk-danger"}`}
                            style={{ width: `${run.summary.matchRate}%` }}
                          />
                        </div>
                        <span className={`text-[12px] font-semibold ${run.summary.matchRate >= 85 ? "text-wk-success" : run.summary.matchRate >= 70 ? "text-wk-warning" : "text-wk-danger"}`}>
                          {run.summary.matchRate.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {hasGaps ? (
                        <span className="font-semibold text-wk-danger">{run.summary.gaps}</span>
                      ) : (
                        <span className="text-wk-text-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-wk-text-muted">{run.createdBy}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/admin/settings/charts/ingest-runs/${run.id}`)}
                          className="rounded px-2 py-1 text-[11px] font-semibold text-wk-brand hover:bg-wk-brand-soft transition-colors whitespace-nowrap"
                        >
                          View
                        </button>
                        {canRetry && (
                          <button
                            onClick={() => handleRetry(run)}
                            disabled={actionLoading === run.id + "_retry"}
                            className="rounded px-2 py-1 text-[11px] font-semibold text-wk-text-soft hover:bg-wk-surface-raised transition-colors disabled:opacity-50 whitespace-nowrap"
                            title="Retry this run"
                          >
                            <i className={actionLoading === run.id + "_retry" ? "ri-loader-4-line animate-spin" : "ri-restart-line"} />
                          </button>
                        )}
                        {canSendGaps && (
                          <button
                            onClick={() => handleSendGaps(run)}
                            disabled={actionLoading === run.id + "_gaps"}
                            className="rounded px-2 py-1 text-[11px] font-semibold text-wk-warning hover:bg-wk-warning-soft transition-colors disabled:opacity-50 whitespace-nowrap"
                            title={`Send ${run.summary.gaps} gaps to review`}
                          >
                            <i className={actionLoading === run.id + "_gaps" ? "ri-loader-4-line animate-spin" : "ri-git-pull-request-line"} />
                          </button>
                        )}
                        {canCancel && (
                          <button
                            onClick={() => setCancelTarget(run)}
                            className="rounded px-2 py-1 text-[11px] font-semibold text-wk-danger hover:bg-wk-danger-soft transition-colors whitespace-nowrap"
                            title="Cancel this run"
                          >
                            <i className="ri-close-line" />
                          </button>
                        )}
                        {isCommitted && (
                          <a
                            href={`/charts/${run.chartSlug}/${run.editionDate}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded px-2 py-1 text-[11px] font-semibold text-wk-success hover:bg-wk-success-soft transition-colors whitespace-nowrap"
                            title="Open public edition"
                          >
                            <i className="ri-external-link-line" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredRuns.length === 0 && (
          <div className="px-4 py-16 text-center">
            {runs.length === 0 ? (
              <AdminChartsEmptyState
                icon="Database"
                title="No ingest runs yet"
                description="Start a new provider-based run in the Ingest Studio. Runs will appear here once created."
                action={{ label: "Open Ingest Studio", onClick: () => navigate("/admin/settings/charts/ingest"), icon: "Plus" }}
              />
            ) : (
              <div>
                <p className="text-[14px] font-semibold text-wk-text-muted">No runs match the current filters.</p>
                <button
                  onClick={() => { setFilter("all"); setSearch(""); setSeriesFilter("all"); setProviderFilter("all"); }}
                  className="mt-2 text-[13px] font-semibold text-wk-brand hover:underline"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </WkSurface>

      {filteredRuns.length > 0 && (
        <div className="text-[12px] text-wk-text-muted text-right">
          Showing {filteredRuns.length} of {runs.length} runs
        </div>
      )}
    </div>
  );
}