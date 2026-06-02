import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getIngestJobs, getDashboardKpisApi } from "@/services/chartsIngestion/client";
import type { IngestJob, DashboardKpis } from "@/services/chartsIngestion/types";
import { WkSurface } from "@/components/design-system/primitives/Surface";

export default function AdminChartsLegacyIngestJobs() {
  const [jobs, setJobs] = useState<IngestJob[]>([]);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const [j, k] = await Promise.all([getIngestJobs(), getDashboardKpisApi()]);
      setJobs(j);
      setKpis(k);
      setLoading(false);
    }
    load();
  }, []);

  const filteredJobs = filter === "all" ? jobs : jobs.filter((j) => j.status === filter);

  const statusBadge = (status: string) => {
    const classes: Record<string, string> = {
      draft: "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]",
      fetching: "bg-[var(--wk-info-soft)] text-[var(--wk-info)]",
      normalizing: "bg-[var(--wk-info-soft)] text-[var(--wk-info)]",
      matching: "bg-[var(--wk-info-soft)] text-[var(--wk-info)]",
      scoring: "bg-[var(--wk-info-soft)] text-[var(--wk-info)]",
      review: "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]",
      ready_to_draft: "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]",
      drafted: "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]",
      published: "bg-[var(--wk-success-soft)] text-[var(--wk-success)]",
      failed: "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]",
      cancelled: "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]",
    };
    return classes[status] || classes.draft;
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: "Draft", fetching: "Fetching", normalizing: "Normalizing",
      matching: "Matching", scoring: "Scoring", review: "Review",
      ready_to_draft: "Ready to Draft", drafted: "Drafted", published: "Published",
      failed: "Failed", cancelled: "Cancelled",
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[var(--wk-text-muted)]">Loading legacy jobs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--wk-text)]">Legacy Ingest Jobs</h1>
          <p className="text-[13px] text-[var(--wk-text-muted)]">CSV-based and historical ingest jobs (legacy system)</p>
        </div>
        <button
          onClick={() => navigate("/admin/charts/ingest")}
          className="wk-button wk-button-primary whitespace-nowrap"
        >
          <i className="ri-add-line" />
          New Ingest Run
        </button>
      </div>

      {kpis && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <WkSurface className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-faint)]">Active Jobs</p>
            <p className="mt-1 text-[24px] font-black text-[var(--wk-text)]">{kpis.activeJobs}</p>
          </WkSurface>
          <WkSurface className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-faint)]">Failed Jobs</p>
            <p className="mt-1 text-[24px] font-black text-[var(--wk-text)]">{kpis.failedJobs}</p>
          </WkSurface>
          <WkSurface className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-faint)]">Pending Issues</p>
            <p className="mt-1 text-[24px] font-black text-[var(--wk-text)]">{kpis.pendingReviewIssues}</p>
          </WkSurface>
          <WkSurface className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-faint)]">Total Families</p>
            <p className="mt-1 text-[24px] font-black text-[var(--wk-text)]">{kpis.totalFamilies}</p>
          </WkSurface>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {["all", "draft", "fetching", "review", "published", "failed"].map((s) => (
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

      <WkSurface className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--wk-border)]">
                <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]">Job</th>
                <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]">Status</th>
                <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]">Family</th>
                <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]">Sources</th>
                <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]">Candidates</th>
                <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]">Date</th>
                <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]">Actor</th>
                <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]" />
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => (
                <tr
                  key={job.id}
                  className="border-b border-[var(--wk-border)]/50 transition-colors hover:bg-[var(--wk-surface-raised)]/50"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[var(--wk-text)]">{job.chartFamily?.label || job.chartFamilyId}</div>
                    <div className="text-[11px] text-[var(--wk-text-muted)]">{job.id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadge(job.status)}`}>
                      {statusLabel(job.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--wk-text-soft)]">{job.chartFamily?.label || "—"}</td>
                  <td className="px-4 py-3 text-[var(--wk-text-soft)]">{job.sourceSummary.totalSources}</td>
                  <td className="px-4 py-3 text-[var(--wk-text-soft)]">{job.jobSummary.totalCandidates}</td>
                  <td className="px-4 py-3 text-[var(--wk-text-muted)]">{job.editionDate}</td>
                  <td className="px-4 py-3 text-[var(--wk-text-muted)]">{job.createdBy}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/admin/charts/ingest-jobs/${job.id}`)}
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
        {filteredJobs.length === 0 && (
          <div className="px-4 py-12 text-center text-[13px] text-[var(--wk-text-muted)]">
            No jobs match the selected filter.
          </div>
        )}
      </WkSurface>
    </div>
  );
}