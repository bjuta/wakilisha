import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminChartsPageHeader } from "../components/AdminChartsPageHeader";
import { AdminChartsKpiCard } from "../components/AdminChartsKpiCard";
import { AdminChartsStatusBadge } from "../components/AdminChartsStatusBadge";
import { AdminChartsEmptyState } from "../components/AdminChartsEmptyState";
import { AdminChartsLoadingState } from "../components/AdminChartsLoadingState";
import {
  getDashboardKpisApi,
  getIngestJobs,
  getIngestRuns,
  getIngestKpis,
  getIngestionMode,
} from "@/services/chartsIngestion/client";
import type { DashboardKpis, IngestJob } from "@/services/chartsIngestion/types";
import type { IngestRun } from "@/services/chartsIngestion/ingestStudioTypes";

export default function AdminChartsDashboard() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [studioKpis, setStudioKpis] = useState<ReturnType<typeof getIngestKpis> extends Promise<infer T> ? T : never | null>(null);
  const [jobs, setJobs] = useState<IngestJob[]>([]);
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<string>("mock");

  useEffect(() => {
    async function load() {
      const [k, j, r, sk] = await Promise.all([
        getDashboardKpisApi(),
        getIngestJobs(),
        getIngestRuns(),
        getIngestKpis(),
      ]);
      setKpis(k);
      setJobs(j);
      setRuns(r);
      setStudioKpis(sk);
      setMode(getIngestionMode());
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <AdminChartsLoadingState message="Loading dashboard..." />;
  if (!kpis) return null;

  const activeJobs = jobs.filter((j) =>
    ["draft", "fetching", "normalizing", "matching", "scoring", "review", "ready_to_draft"].includes(j.status)
  );
  const failedJobs = jobs.filter((j) => j.status === "failed");
  const recentJobs = jobs.slice(0, 5);
  const activeRuns = runs.filter((r) => r.status === "running" || r.status === "draft" || r.status === "dry_run_complete");
  const needsReviewRuns = runs.filter((r) => r.status === "needs_review" || r.summary.gaps > 0);
  const committedRuns = runs.filter((r) => r.status === "committed").slice(0, 3);

  const needsAttention = failedJobs.length > 0 || needsReviewRuns.length > 0 || activeRuns.length > 0;

  return (
    <div className="space-y-6">
      <AdminChartsPageHeader
        title="Dashboard"
        description="Command center for chart operations. What needs attention today."
      >
        <button
          onClick={() => navigate("/admin/charts/ingest")}
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
        >
          <WkIcon name="Plus" size={14} />
          New Ingest
        </button>
        <button
          onClick={() => navigate("/admin/charts/ingest-health")}
          className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
        >
          <WkIcon name="HeartPulse" size={14} />
          Health
        </button>
      </AdminChartsPageHeader>

      {/* Mode indicator */}
      {mode === "mock" && (
        <div className="rounded-lg border border-wk-warning/20 bg-wk-warning-soft p-3 flex items-start gap-2">
          <WkIcon name="FlaskConical" size={16} className="text-wk-warning mt-0.5" />
          <div className="text-[12px] text-wk-warning">
            <strong>Mock mode active.</strong> All data is local. Switch to WordPress mode for live backend connectivity.
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <AdminChartsKpiCard
          value={activeRuns.length}
          label="Active Runs"
          icon="Database"
          accent={activeRuns.length > 0 ? "brand" : "muted"}
        />
        <AdminChartsKpiCard
          value={failedJobs.length}
          label="Failed Jobs"
          icon="AlertCircle"
          accent={failedJobs.length > 0 ? "danger" : "muted"}
        />
        <AdminChartsKpiCard
          value={needsReviewRuns.length}
          label="Needs Review"
          icon="Flag"
          accent={needsReviewRuns.length > 0 ? "warning" : "muted"}
        />
        <AdminChartsKpiCard
          value={kpis.totalFamilies}
          label="Chart Families"
          icon="FolderTree"
          accent="brand"
        />
        <AdminChartsKpiCard
          value={kpis.totalPublishedEditions}
          label="Published Editions"
          icon="Layers"
          accent="success"
        />
        <AdminChartsKpiCard
          value={studioKpis ? `${studioKpis.canonicalMatchRate.toFixed(1)}%` : "—"}
          label="Match Rate"
          icon="BarChart3"
          accent={studioKpis && studioKpis.canonicalMatchRate >= 85 ? "success" : "warning"}
        />
      </div>

      {/* Attention bar */}
      {needsAttention && (
        <div className="rounded-lg border border-wk-border bg-wk-surface p-4">
          <div className="flex items-center gap-2 mb-3">
            <WkIcon name="AlertTriangle" size={16} className="text-wk-warning" />
            <h2 className="text-[14px] font-bold text-wk-text">Needs Attention</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {failedJobs.length > 0 && (
              <button
                onClick={() => navigate("/admin/charts/ingest-jobs")}
                className="inline-flex items-center gap-1.5 rounded-md border border-wk-danger/20 bg-wk-danger-soft px-3 py-1.5 text-[12px] font-semibold text-wk-danger transition-colors hover:bg-wk-danger/20 whitespace-nowrap"
              >
                <WkIcon name="AlertCircle" size={14} />
                {failedJobs.length} failed job{failedJobs.length !== 1 ? "s" : ""}
              </button>
            )}
            {needsReviewRuns.length > 0 && (
              <button
                onClick={() => navigate("/admin/charts/review-queue")}
                className="inline-flex items-center gap-1.5 rounded-md border border-wk-warning/20 bg-wk-warning-soft px-3 py-1.5 text-[12px] font-semibold text-wk-warning transition-colors hover:bg-wk-warning/20 whitespace-nowrap"
              >
                <WkIcon name="GitPullRequest" size={14} />
                {needsReviewRuns.length} run{needsReviewRuns.length !== 1 ? "s" : ""} need review
              </button>
            )}
            {activeRuns.length > 0 && (
              <button
                onClick={() => navigate("/admin/charts/ingest-runs")}
                className="inline-flex items-center gap-1.5 rounded-md border border-wk-info/20 bg-wk-info-soft px-3 py-1.5 text-[12px] font-semibold text-wk-info transition-colors hover:bg-wk-info/20 whitespace-nowrap"
              >
                <WkIcon name="Loader" size={14} className="animate-spin" />
                {activeRuns.length} active run{activeRuns.length !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Left column */}
        <div className="space-y-4">
          {/* Active Provider Runs */}
          <WkSurface className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <WkIcon name="Database" size={16} className="text-wk-brand" />
                <h2 className="text-[14px] font-bold text-wk-text">Active Ingest Runs</h2>
              </div>
              <button
                onClick={() => navigate("/admin/charts/ingest-runs")}
                className="text-[11px] font-semibold text-wk-brand hover:underline"
              >
                View all
              </button>
            </div>
            {activeRuns.length === 0 ? (
              <AdminChartsEmptyState
                icon="Database"
                title="No active runs"
                description="Start a new ingest run from the Ingest Studio to populate this section."
                action={{ label: "New Ingest", onClick: () => navigate("/admin/charts/ingest"), icon: "Plus" }}
              />
            ) : (
              <div className="space-y-2">
                {activeRuns.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => navigate(`/admin/charts/ingest-runs/${run.id}`)}
                    className="flex w-full items-center gap-4 rounded-xl border border-wk-border bg-wk-bg-subtle p-4 text-left transition-all hover:border-wk-border-2 hover:bg-wk-surface-raised"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-wk-brand-soft text-wk-brand">
                      <WkIcon name="BarChart3" size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-bold text-wk-text">{run.chartTitle}</span>
                        <AdminChartsStatusBadge status={run.status} size="sm" />
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-wk-text-muted">
                        <span>{run.editionDate}</span>
                        <span>{run.detectedProviders.length} providers</span>
                        <span>{run.summary.totalRows} rows</span>
                        <span>{run.summary.matchRate.toFixed(1)}% match</span>
                        <span>by {run.createdBy}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-wk-text-faint">
                      <WkIcon name="ArrowRight" size={16} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </WkSurface>

          {/* Recent Committed Editions */}
          <WkSurface className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <WkIcon name="CheckCircle2" size={16} className="text-wk-success" />
                <h2 className="text-[14px] font-bold text-wk-text">Recent Editions</h2>
              </div>
              <button
                onClick={() => navigate("/admin/charts/editions")}
                className="text-[11px] font-semibold text-wk-brand hover:underline"
              >
                View all
              </button>
            </div>
            {committedRuns.length === 0 ? (
              <div className="py-4 text-center text-[12px] text-wk-text-muted">
                No committed editions yet. Run a dry run and commit to publish.
              </div>
            ) : (
              <div className="space-y-2">
                {committedRuns.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center gap-3 rounded-lg border border-wk-border p-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wk-success-soft text-wk-success">
                      <WkIcon name="Check" size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-wk-text truncate">{run.chartTitle}</div>
                      <div className="text-[11px] text-wk-text-muted">{run.editionDate} · {run.summary.totalRows} entries</div>
                    </div>
                    <button
                      onClick={() => navigate(`/admin/charts/ingest-runs/${run.id}`)}
                      className="shrink-0 text-[12px] font-semibold text-wk-brand hover:underline whitespace-nowrap"
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </WkSurface>

          {/* Legacy Active Jobs */}
          <WkSurface className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <WkIcon name="History" size={16} className="text-wk-text-muted" />
                <h2 className="text-[14px] font-bold text-wk-text">Legacy Active Jobs</h2>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-wk-text-faint">Legacy</span>
            </div>
            {activeJobs.length === 0 ? (
              <div className="py-4 text-center text-[12px] text-wk-text-muted">
                No active legacy jobs. Provider-based runs are the new standard.
              </div>
            ) : (
              <div className="space-y-2">
                {activeJobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => navigate(`/admin/charts/ingest-jobs/${job.id}`)}
                    className="flex w-full items-center gap-3 rounded-lg border border-wk-border p-3 text-left transition-all hover:bg-wk-surface-raised"
                  >
                    <AdminChartsStatusBadge status={job.status} size="sm" />
                    <span className="truncate text-[12px] font-semibold text-wk-text">
                      {job.chartFamily?.label ?? job.chartFamilyId}
                    </span>
                    <span className="text-[11px] text-wk-text-muted">{job.editionDate}</span>
                    <span className="ml-auto text-[11px] text-wk-text-faint">{job.createdBy}</span>
                  </button>
                ))}
              </div>
            )}
          </WkSurface>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Failed Jobs */}
          <WkSurface className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <WkIcon name="AlertCircle" size={16} className="text-wk-danger" />
              <h2 className="text-[14px] font-bold text-wk-text">Failed Jobs</h2>
              {failedJobs.length > 0 && (
                <span className="rounded-full bg-wk-danger-soft px-2 py-0.5 text-[10px] font-bold text-wk-danger">
                  {failedJobs.length}
                </span>
              )}
            </div>
            {failedJobs.length === 0 ? (
              <div className="py-4 text-center text-[12px] text-wk-text-muted">
                No failures. All systems operational.
              </div>
            ) : (
              <div className="space-y-2">
                {failedJobs.map((job) => (
                  <div
                    key={job.id}
                    className="rounded-lg border border-wk-danger/20 bg-wk-danger-soft p-3"
                  >
                    <div className="text-[12px] font-bold text-wk-danger">
                      {job.chartFamily?.label ?? job.chartFamilyId}
                    </div>
                    <div className="mt-1 text-[11px] text-wk-text">{job.errorMessage}</div>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => navigate(`/admin/charts/ingest-jobs/${job.id}`)}
                        className="wk-button wk-button-sm wk-button-ghost"
                      >
                        View
                      </button>
                      <button
                        onClick={() => navigate(`/admin/charts/ingest`)}
                        className="wk-button wk-button-sm wk-button-primary"
                      >
                        Retry as New Run
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </WkSurface>

          {/* Latest Published */}
          {kpis.latestPublishedEdition && (
            <WkSurface className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <WkIcon name="CheckCircle2" size={16} className="text-wk-success" />
                <h2 className="text-[14px] font-bold text-wk-text">Latest Published</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-wk-text-muted">Edition</span>
                  <span className="text-[12px] font-semibold text-wk-text">{kpis.latestPublishedEdition.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-wk-text-muted">Date</span>
                  <span className="text-[12px] font-semibold text-wk-text">{kpis.latestPublishedEdition.date}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-wk-text-muted">Entries</span>
                  <span className="text-[12px] font-semibold text-wk-text">{kpis.latestPublishedEdition.entryCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-wk-text-muted">New Entries</span>
                  <span className="text-[12px] font-semibold text-wk-brand">{kpis.latestPublishedEdition.newEntries}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-wk-text-muted">Re-entries</span>
                  <span className="text-[12px] font-semibold text-wk-text">{kpis.latestPublishedEdition.reEntries}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-wk-text-muted">Published By</span>
                  <span className="text-[12px] font-semibold text-wk-text">{kpis.latestPublishedEdition.publishedBy}</span>
                </div>
                <div className="border-t border-wk-divider pt-3">
                  <span className="text-[10px] text-wk-text-faint">
                    Published {kpis.latestPublishedEdition.publishedAt}
                  </span>
                </div>
                <button
                  onClick={() => navigate(`/admin/charts/editions`)}
                  className="mt-1 w-full rounded-md bg-wk-brand-soft px-3 py-2 text-[12px] font-semibold text-wk-brand transition-colors hover:bg-wk-brand/20"
                >
                  <WkIcon name="Eye" size={14} className="inline mr-1" /> View in Editions
                </button>
              </div>
            </WkSurface>
          )}

          {/* Quick Actions */}
          <WkSurface className="p-5">
            <h2 className="mb-3 text-[14px] font-bold text-wk-text">Quick Actions</h2>
            <div className="space-y-2">
              <QuickActionButton
                icon="CirclePlus"
                label="Start New Ingest"
                description="Create a new provider-based run"
                onClick={() => navigate("/admin/charts/ingest")}
                accent="brand"
              />
              <QuickActionButton
                icon="FolderTree"
                label="Manage Families"
                description="Configure chart series and rulesets"
                onClick={() => navigate("/admin/charts/families")}
              />
              <QuickActionButton
                icon="Layers"
                label="View Editions"
                description="Browse published and draft editions"
                onClick={() => navigate("/admin/charts/editions")}
              />
              <QuickActionButton
                icon="GitPullRequest"
                label="Open Review Queue"
                description={needsReviewRuns.length > 0 ? `${needsReviewRuns.length} runs need review` : "Queue is clear"}
                onClick={() => navigate("/admin/charts/review-queue")}
                disabled={needsReviewRuns.length === 0}
                disabledReason="No items in review queue"
              />
              <QuickActionButton
                icon="HeartPulse"
                label="API Health"
                description="Check provider and backend status"
                onClick={() => navigate("/admin/charts/ingest-health")}
              />
            </div>
          </WkSurface>
        </div>
      </div>
    </div>
  );
}

function QuickActionButton({
  icon,
  label,
  description,
  onClick,
  accent,
  disabled,
  disabledReason,
}: {
  icon: string;
  label: string;
  description: string;
  onClick: () => void;
  accent?: "brand";
  disabled?: boolean;
  disabledReason?: string;
}) {
  const iconColor = accent === "brand" ? "text-wk-brand" : "text-wk-text-muted";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      className={`flex w-full items-center gap-3 rounded-lg border border-wk-border p-3 text-left transition-all ${
        disabled
          ? "opacity-40 cursor-not-allowed"
          : "hover:bg-wk-surface-raised hover:border-wk-border-2"
      }`}
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wk-surface-raised ${iconColor}`}>
        <WkIcon name={icon as never} size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-wk-text">{label}</div>
        <div className="text-[11px] text-wk-text-muted">{description}</div>
      </div>
      <WkIcon name="ChevronRight" size={16} className="text-wk-text-faint" />
    </button>
  );
}