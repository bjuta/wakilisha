import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkTag } from "@/components/design-system/primitives/Tag";
import { getIngestJobs } from "@/services/chartsIngestion/client";
import type { IngestJob } from "@/services/chartsIngestion/types";

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

export default function AdminChartsIngest() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<IngestJob[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const j = await getIngestJobs();
      setJobs(j);
      setLoading(false);
    }
    load();
  }, []);

  const filteredJobs = jobs.filter((j) => {
    if (filter === "all") return true;
    if (filter === "active") return ["draft", "fetching", "normalizing", "matching", "scoring", "review", "ready_to_draft"].includes(j.status);
    if (filter === "published") return j.status === "published";
    if (filter === "failed") return j.status === "failed";
    if (filter === "drafted") return j.status === "drafted";
    return j.status === filter;
  });

  const filterTabs = [
    { key: "all", label: "All", count: jobs.length },
    { key: "active", label: "Active", count: jobs.filter((j) => ["draft", "fetching", "normalizing", "matching", "scoring", "review", "ready_to_draft"].includes(j.status)).length },
    { key: "drafted", label: "Drafted", count: jobs.filter((j) => j.status === "drafted").length },
    { key: "published", label: "Published", count: jobs.filter((j) => j.status === "published").length },
    { key: "failed", label: "Failed", count: jobs.filter((j) => j.status === "failed").length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="wk-eyebrow mb-2">Ingest Pipeline</div>
          <h1 className="wk-h-page">Ingest Jobs</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/admin/charts/ingest/demo-job-001")}
            className="wk-button wk-button-ghost whitespace-nowrap"
          >
            <i className="ri-eye-line" />
            View Demo Job
          </button>
          <button
            onClick={() => {
              const newJob = {
                chartFamilyId: "fam-001",
                editionDate: "2026-06-06",
                periodStart: "2026-05-30",
                periodEnd: "2026-06-06",
                chartSize: 40,
                rulesetKey: "standard_weekly",
                scoringModelKey: "weighted_multi_source_v1",
              };
              import("@/services/chartsIngestion/api").then((api) =>
                api.createIngestJob(newJob).then((j) => navigate(`/admin/charts/ingest/${j.id}`))
              );
            }}
            className="wk-button wk-button-primary whitespace-nowrap"
          >
            <i className="ri-add-line" />
            New Job
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all ${
              filter === tab.key
                ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                : "border border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
            }`}
          >
            {tab.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                filter === tab.key ? "bg-[var(--wk-brand-on)]/20" : "bg-[var(--wk-surface-raised)]"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Jobs Table */}
      <WkSurface className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="wk-table min-w-full">
            <thead>
              <tr>
                <th className="whitespace-nowrap">Chart Family</th>
                <th className="whitespace-nowrap">Edition</th>
                <th className="whitespace-nowrap">Status</th>
                <th className="whitespace-nowrap">Sources</th>
                <th className="whitespace-nowrap">Candidates</th>
                <th className="whitespace-nowrap">Issues</th>
                <th className="whitespace-nowrap">Created By</th>
                <th className="whitespace-nowrap">Date</th>
                <th className="whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[var(--wk-text-muted)]">
                    Loading jobs...
                  </td>
                </tr>
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[var(--wk-text-muted)]">
                    No jobs match this filter.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="group cursor-pointer hover:bg-[var(--wk-surface-raised)]" onClick={() => navigate(`/admin/charts/ingest/${job.id}`)}>
                    <td className="font-semibold text-[var(--wk-text)]">
                      {job.chartFamily?.label ?? "Unknown"}
                    </td>
                    <td>
                      <span className="text-[12px] text-[var(--wk-text-soft)]">
                        {job.editionSlug ?? job.editionDate}
                      </span>
                    </td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[job.status] ?? ""}`}>
                        {formatStatus(job.status)}
                      </span>
                    </td>
                    <td className="text-[12px] tabular-nums text-[var(--wk-text-soft)]">
                      {job.sourceSummary.totalSources}
                    </td>
                    <td className="text-[12px] tabular-nums text-[var(--wk-text-soft)]">
                      {job.jobSummary.totalCandidates}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {job.jobSummary.highIssues > 0 && (
                          <span className="rounded-full bg-[var(--wk-danger-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--wk-danger)]">
                            {job.jobSummary.highIssues}H
                          </span>
                        )}
                        {job.jobSummary.mediumIssues > 0 && (
                          <span className="rounded-full bg-[var(--wk-warning-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--wk-warning)]">
                            {job.jobSummary.mediumIssues}M
                          </span>
                        )}
                        {job.jobSummary.lowIssues > 0 && (
                          <span className="rounded-full bg-[var(--wk-info-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--wk-info)]">
                            {job.jobSummary.lowIssues}L
                          </span>
                        )}
                        {job.jobSummary.highIssues === 0 && job.jobSummary.mediumIssues === 0 && job.jobSummary.lowIssues === 0 && (
                          <span className="text-[10px] text-[var(--wk-text-faint)]">—</span>
                        )}
                      </div>
                    </td>
                    <td className="text-[12px] text-[var(--wk-text-soft)]">{job.createdBy}</td>
                    <td className="text-[11px] text-[var(--wk-text-muted)]">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/admin/charts/ingest/${job.id}`)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
                          title="View"
                        >
                          <i className="ri-eye-line text-sm" />
                        </button>
                        {job.status === "failed" && (
                          <button
                            onClick={() => {
                              import("@/services/chartsIngestion/api").then((api) =>
                                api.retryJob(job.id).then(() => window.location.reload())
                              );
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-brand)]"
                            title="Retry"
                          >
                            <i className="ri-restart-line text-sm" />
                          </button>
                        )}
                        {job.status === "draft" && (
                          <button
                            onClick={() => {
                              import("@/services/chartsIngestion/api").then((api) =>
                                api.cancelJob(job.id).then(() => window.location.reload())
                              );
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-danger)]"
                            title="Cancel"
                          >
                            <i className="ri-close-circle-line text-sm" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </WkSurface>

      {/* Summary Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Jobs" value={jobs.length} color="var(--wk-text)" />
        <StatCard label="Active Jobs" value={jobs.filter((j) => ["draft", "fetching", "normalizing", "matching", "scoring", "review", "ready_to_draft"].includes(j.status)).length} color="var(--wk-info)" />
        <StatCard label="Published Jobs" value={jobs.filter((j) => j.status === "published").length} color="var(--wk-success)" />
        <StatCard label="Failed Jobs" value={jobs.filter((j) => j.status === "failed").length} color="var(--wk-danger)" />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <WkSurface className="flex items-center justify-between p-4">
      <div className="text-[12px] text-[var(--wk-text-muted)]">{label}</div>
      <div className="text-[20px] font-black tabular-nums" style={{ color }}>
        {value}
      </div>
    </WkSurface>
  );
}