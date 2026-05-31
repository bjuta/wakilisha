import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkTag } from "@/components/design-system/primitives/Tag";
import { getDashboardKpisApi, getIngestJobs } from "@/services/chartsIngestion/client";
import type { DashboardKpis, IngestJob } from "@/services/chartsIngestion/types";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-[var(--wk-text-faint)]/10 text-[var(--wk-text-faint)]",
  fetching: "bg-[var(--wk-info-soft)] text-[var(--wk-info)]",
  normalizing: "bg-[var(--wk-info-soft)] text-[var(--wk-info)]",
  matching: "bg-[var(--wk-info-soft)] text-[var(--wk-info)]",
  scoring: "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]",
  review: "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]",
  ready_to_draft: "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]",
  drafted: "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]",
  published: "bg-[var(--wk-success-soft)] text-[var(--wk-success)]",
  failed: "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]",
  cancelled: "bg-[var(--wk-text-faint)]/10 text-[var(--wk-text-faint)]",
};

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function AdminChartsDashboard() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [jobs, setJobs] = useState<IngestJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [k, j] = await Promise.all([getDashboardKpisApi(), getIngestJobs()]);
      setKpis(k);
      setJobs(j);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[var(--wk-text-muted)]">Loading dashboard...</div>
      </div>
    );
  }

  if (!kpis) return null;

  const activeJobs = jobs.filter((j) =>
    ["draft", "fetching", "normalizing", "matching", "scoring", "review", "ready_to_draft"].includes(j.status)
  );
  const failedJobs = jobs.filter((j) => j.status === "failed");
  const recentJobs = jobs.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="wk-eyebrow mb-2">Charts Ingestion</div>
          <h1 className="wk-h-page">Dashboard</h1>
        </div>
        <button
          onClick={() => navigate("/admin/charts/ingest")}
          className="wk-button wk-button-primary whitespace-nowrap"
        >
          <i className="ri-add-line" />
          New Ingest Job
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          value={kpis.activeJobs}
          label="Active Jobs"
          icon="ri-database-2-line"
          color="var(--wk-info)"
        />
        <KpiCard
          value={kpis.failedJobs}
          label="Failed Jobs"
          icon="ri-error-warning-line"
          color="var(--wk-danger)"
        />
        <KpiCard
          value={kpis.pendingReviewIssues}
          label="Pending Issues"
          icon="ri-flag-line"
          color="var(--wk-warning)"
        />
        <KpiCard
          value={kpis.totalFamilies}
          label="Chart Families"
          icon="ri-folder-chart-line"
          color="var(--wk-brand)"
        />
        <KpiCard
          value={kpis.totalPublishedEditions}
          label="Published Editions"
          icon="ri-stack-line"
          color="var(--wk-success)"
        />
        <KpiCard
          value={kpis.latestPublishedEdition?.label ?? "—"}
          label="Latest Edition"
          icon="ri-calendar-line"
          color="var(--wk-text-soft)"
          isString
        />
      </div>

      {/* Main Grid */}
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        {/* Active Jobs */}
        <div className="space-y-4">
          <WkSurface className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="ri-database-2-line text-[var(--wk-brand)]" />
                <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Active Ingest Jobs</h2>
              </div>
              <WkTag variant="brand">{activeJobs.length} active</WkTag>
            </div>
            {activeJobs.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-[var(--wk-text-muted)]">
                No active jobs. Start a new ingest job to begin.
              </div>
            ) : (
              <div className="space-y-2">
                {activeJobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => navigate(`/admin/charts/ingest/${job.id}`)}
                    className="flex w-full items-center gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-4 text-left transition-all hover:border-[var(--wk-border-2)] hover:bg-[var(--wk-surface-raised)]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                      <i className="ri-bar-chart-grouped-line" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-bold text-[var(--wk-text)]">
                          {job.chartFamily?.label ?? "Unknown Family"}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[job.status] ?? ""}`}>
                          {formatStatus(job.status)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-[11px] text-[var(--wk-text-muted)]">
                        <span>{job.editionSlug ?? job.editionDate}</span>
                        <span>·</span>
                        <span>{job.sourceSummary.totalSources} sources</span>
                        <span>·</span>
                        <span>{job.jobSummary.totalCandidates} candidates</span>
                        <span>·</span>
                        <span>{job.createdBy}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-[var(--wk-text-faint)]">
                      <i className="ri-arrow-right-line" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </WkSurface>

          {/* Recent Jobs */}
          <WkSurface className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="ri-time-line text-[var(--wk-text-soft)]" />
                <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Recent Jobs</h2>
              </div>
              <button
                onClick={() => navigate("/admin/charts/ingest")}
                className="text-[11px] font-semibold text-[var(--wk-brand)] hover:underline"
              >
                View all
              </button>
            </div>
            <div className="space-y-2">
              {recentJobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => navigate(`/admin/charts/ingest/${job.id}`)}
                  className="flex w-full items-center gap-3 rounded-lg border border-[var(--wk-border)] p-3 text-left transition-all hover:bg-[var(--wk-surface-raised)]"
                >
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[job.status] ?? ""}`}>
                    {formatStatus(job.status)}
                  </span>
                  <span className="truncate text-[12px] font-semibold text-[var(--wk-text)]">
                    {job.chartFamily?.label ?? "Unknown"}
                  </span>
                  <span className="text-[11px] text-[var(--wk-text-muted)]">{job.editionSlug ?? job.editionDate}</span>
                  <span className="ml-auto text-[11px] text-[var(--wk-text-faint)]">{job.createdBy}</span>
                </button>
              ))}
            </div>
          </WkSurface>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Failed Jobs */}
          <WkSurface className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <i className="ri-error-warning-line text-[var(--wk-danger)]" />
              <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Failed Jobs</h2>
              {failedJobs.length > 0 && (
                <span className="rounded-full bg-[var(--wk-danger-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-danger)]">
                  {failedJobs.length}
                </span>
              )}
            </div>
            {failedJobs.length === 0 ? (
              <div className="py-4 text-center text-[12px] text-[var(--wk-text-muted)]">
                No failed jobs. All systems operational.
              </div>
            ) : (
              <div className="space-y-2">
                {failedJobs.map((job) => (
                  <div
                    key={job.id}
                    className="rounded-lg border border-[var(--wk-danger)]/20 bg-[var(--wk-danger-soft)] p-3"
                  >
                    <div className="text-[12px] font-bold text-[var(--wk-danger)]">
                      {job.chartFamily?.label ?? "Unknown"}
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--wk-text)]">
                      {job.errorMessage}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => navigate(`/admin/charts/ingest/${job.id}`)}
                        className="wk-button wk-button-sm wk-button-ghost"
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </WkSurface>

          {/* Latest Published Edition */}
          {kpis.latestPublishedEdition && (
            <WkSurface className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <i className="ri-check-double-line text-[var(--wk-success)]" />
                <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Latest Published</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[var(--wk-text-muted)]">Edition</span>
                  <span className="text-[12px] font-semibold text-[var(--wk-text)]">
                    {kpis.latestPublishedEdition.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[var(--wk-text-muted)]">Date</span>
                  <span className="text-[12px] font-semibold text-[var(--wk-text)]">
                    {kpis.latestPublishedEdition.date}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[var(--wk-text-muted)]">Entries</span>
                  <span className="text-[12px] font-semibold text-[var(--wk-text)]">
                    {kpis.latestPublishedEdition.entryCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[var(--wk-text-muted)]">New Entries</span>
                  <span className="text-[12px] font-semibold text-[var(--wk-brand)]">
                    {kpis.latestPublishedEdition.newEntries}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[var(--wk-text-muted)]">Re-entries</span>
                  <span className="text-[12px] font-semibold text-[var(--wk-text)]">
                    {kpis.latestPublishedEdition.reEntries}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[var(--wk-text-muted)]">Published By</span>
                  <span className="text-[12px] font-semibold text-[var(--wk-text)]">
                    {kpis.latestPublishedEdition.publishedBy}
                  </span>
                </div>
                <div className="border-t border-[var(--wk-divider)] pt-3">
                  <span className="text-[10px] text-[var(--wk-text-faint)]">
                    Published {kpis.latestPublishedEdition.publishedAt}
                  </span>
                </div>
              </div>
            </WkSurface>
          )}

          {/* Quick Actions */}
          <WkSurface className="p-5">
            <h2 className="mb-3 text-[14px] font-bold text-[var(--wk-text)]">Quick Actions</h2>
            <div className="space-y-2">
              <button
                onClick={() => navigate("/admin/charts/ingest")}
                className="flex w-full items-center gap-2 rounded-lg border border-[var(--wk-border)] p-3 text-left transition-all hover:bg-[var(--wk-surface-raised)]"
              >
                <i className="ri-add-circle-line text-[var(--wk-brand)]" />
                <span className="text-[12px] font-semibold text-[var(--wk-text)]">Start New Ingest</span>
              </button>
              <button
                onClick={() => navigate("/admin/charts/families")}
                className="flex w-full items-center gap-2 rounded-lg border border-[var(--wk-border)] p-3 text-left transition-all hover:bg-[var(--wk-surface-raised)]"
              >
                <i className="ri-folder-chart-line text-[var(--wk-text-soft)]" />
                <span className="text-[12px] font-semibold text-[var(--wk-text)]">Manage Families</span>
              </button>
              <button
                onClick={() => navigate("/admin/charts/editions")}
                className="flex w-full items-center gap-2 rounded-lg border border-[var(--wk-border)] p-3 text-left transition-all hover:bg-[var(--wk-surface-raised)]"
              >
                <i className="ri-stack-line text-[var(--wk-text-soft)]" />
                <span className="text-[12px] font-semibold text-[var(--wk-text)]">View Editions</span>
              </button>
            </div>
          </WkSurface>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  value,
  label,
  icon,
  color,
  isString,
}: {
  value: number | string;
  label: string;
  icon: string;
  color: string;
  isString?: boolean;
}) {
  return (
    <WkSurface className="flex items-center gap-3 p-4">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${color}15`, color }}
      >
        <i className={icon} />
      </div>
      <div className="min-w-0">
        <div
          className={`font-black leading-none tracking-[-0.02em] ${isString ? "text-[13px]" : "text-[22px]"}`}
          style={{ color: isString ? "var(--wk-text-soft)" : "var(--wk-text)" }}
        >
          {value}
        </div>
        <div className="mt-1 text-[11px] font-medium text-[var(--wk-text-muted)]">{label}</div>
      </div>
    </WkSurface>
  );
}