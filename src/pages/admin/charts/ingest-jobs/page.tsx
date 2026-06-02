import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getIngestJobs, getIngestJob } from "@/services/chartsIngestion/client";
import type { IngestJob } from "@/services/chartsIngestion/types";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminChartsPageHeader } from "../components/AdminChartsPageHeader";
import { AdminChartsKpiCard } from "../components/AdminChartsKpiCard";
import { AdminChartsStatusBadge } from "../components/AdminChartsStatusBadge";
import { AdminChartsEmptyState } from "../components/AdminChartsEmptyState";
import { AdminChartsLoadingState } from "../components/AdminChartsLoadingState";

export default function AdminChartsLegacyIngestJobs() {
  const [jobs, setJobs] = useState<IngestJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedJob, setSelectedJob] = useState<IngestJob | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { jobId } = useParams<{ jobId: string }>();

  useEffect(() => {
    async function load() {
      const j = await getIngestJobs();
      setJobs(j);
      if (jobId) {
        const job = await getIngestJob(jobId);
        setSelectedJob(job);
      }
      setLoading(false);
    }
    load();
  }, [jobId]);

  const filteredJobs = jobs.filter((j) => {
    const matchStatus = filter === "all" || j.status === filter;
    const matchSearch =
      !search ||
      (j.chartFamily?.label ?? "").toLowerCase().includes(search.toLowerCase()) ||
      j.id.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) return <AdminChartsLoadingState message="Loading legacy jobs…" />;

  const activeCount = jobs.filter((j) => ["draft", "fetching", "normalizing", "matching", "scoring", "review"].includes(j.status)).length;
  const failedCount = jobs.filter((j) => j.status === "failed").length;
  const publishedCount = jobs.filter((j) => j.status === "published").length;

  return (
    <div className="space-y-6">
      {/* Legacy banner — always visible */}
      <div className="rounded-lg border border-wk-warning/30 bg-wk-warning-soft p-4 flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wk-warning/20 text-wk-warning">
          <i className="ri-history-line" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-wk-warning">Legacy CSV Ingest Jobs</p>
          <p className="text-[12px] text-wk-text mt-0.5">
            These are Sprint 1 CSV-based jobs retained for historical visibility.
            New provider-based runs live under{" "}
            <button
              onClick={() => navigate("/admin/charts/ingest-runs")}
              className="font-semibold text-wk-brand underline hover:no-underline"
            >
              Ingest Runs
            </button>
            {" "}and{" "}
            <button
              onClick={() => navigate("/admin/charts/ingest")}
              className="font-semibold text-wk-brand underline hover:no-underline"
            >
              Ingest Studio
            </button>
            . Do not use legacy jobs as the operational baseline.
          </p>
        </div>
      </div>

      <AdminChartsPageHeader
        title="Legacy Ingest Jobs"
        description="CSV-based ingestion jobs from the Sprint 1 pipeline. Historical reference only."
      >
        <button
          onClick={() => navigate("/admin/charts/ingest")}
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
        >
          <i className="ri-add-line" />
          Start New Provider Run
        </button>
      </AdminChartsPageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminChartsKpiCard value={jobs.length} label="Total Jobs" icon="ri-file-list-3-line" accent="muted" />
        <AdminChartsKpiCard value={activeCount} label="Active" icon="ri-database-2-line" accent={activeCount > 0 ? "info" : "muted"} />
        <AdminChartsKpiCard value={failedCount} label="Failed" icon="ri-error-warning-line" accent={failedCount > 0 ? "danger" : "muted"} />
        <AdminChartsKpiCard value={publishedCount} label="Published" icon="ri-check-double-line" accent="success" />
      </div>

      {/* Detail panel for specific job */}
      {selectedJob && (
        <WkSurface className="p-5 border-l-4 border-l-wk-warning">
          <div className="flex items-start justify-between gap-2 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-bold text-wk-text">{selectedJob.chartFamily?.label ?? selectedJob.chartFamilyId}</h2>
                <AdminChartsStatusBadge status={selectedJob.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[12px] text-wk-text-muted">
                <span>ID: <span className="font-mono">{selectedJob.id}</span></span>
                <span>{selectedJob.editionDate}</span>
                <span>by {selectedJob.createdBy}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopyId(selectedJob.id)}
                className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
              >
                <i className={copiedId === selectedJob.id ? "ri-check-line" : "ri-file-copy-line"} />
                {copiedId === selectedJob.id ? "Copied" : "Copy ID"}
              </button>
              <button
                onClick={() => navigate("/admin/charts/ingest")}
                className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
              >
                <i className="ri-add-line" />
                New Provider Run
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-wk-surface-raised p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint">Sources</p>
              <p className="mt-1 text-[20px] font-black text-wk-text">{selectedJob.sourceSummary.totalSources}</p>
            </div>
            <div className="rounded-lg bg-wk-surface-raised p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint">Candidates</p>
              <p className="mt-1 text-[20px] font-black text-wk-text">{selectedJob.jobSummary.totalCandidates}</p>
            </div>
            <div className="rounded-lg bg-wk-surface-raised p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint">Matched</p>
              <p className="mt-1 text-[20px] font-black text-wk-success">{selectedJob.jobSummary.matchedCandidates}</p>
            </div>
            <div className="rounded-lg bg-wk-surface-raised p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint">Unmatched</p>
              <p className="mt-1 text-[20px] font-black text-wk-danger">{selectedJob.jobSummary.unmatchedCandidates}</p>
            </div>
          </div>
          {selectedJob.errorMessage && (
            <div className="mt-4 rounded-lg border border-wk-danger/20 bg-wk-danger-soft p-3">
              <p className="text-[12px] font-semibold text-wk-danger">Error: {selectedJob.errorMessage}</p>
            </div>
          )}
          <div className="mt-4 rounded-lg bg-wk-surface-raised p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-wk-text-faint mb-2">Legacy job detail</p>
            <p className="text-[12px] text-wk-text-muted">
              For a full legacy CSV inspection workflow, open the job wizard below. This shows source mapping, CSV validation,
              and the original ingest steps.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => navigate(`/admin/charts/ingest-jobs/${selectedJob.id}`)}
                className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
              >
                <i className="ri-external-link-line" /> Open Job Wizard
              </button>
            </div>
          </div>
        </WkSurface>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-wk-text-faint text-[13px]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs by family or ID…"
            className="w-full rounded-lg border border-wk-border bg-wk-surface py-2 pl-9 pr-3 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-border-strong"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {["all", "draft", "fetching", "review", "ready_to_draft", "published", "failed", "cancelled"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all ${
                filter === s ? "bg-wk-brand text-wk-brand-on" : "bg-wk-surface text-wk-text-soft border border-wk-border hover:bg-wk-surface-raised"
              }`}
            >
              {s === "all" ? "All" : s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <WkSurface className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-wk-border">
                {["Job ID", "Family", "Status", "Sources", "Candidates", "Date", "By", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => (
                <tr
                  key={job.id}
                  className="border-b border-wk-border/50 transition-colors hover:bg-wk-surface-raised/50"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-[11px] text-wk-text-muted">{job.id}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-wk-text">
                    {job.chartFamily?.label ?? job.chartFamilyId}
                  </td>
                  <td className="px-4 py-3">
                    <AdminChartsStatusBadge status={job.status} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-wk-text-soft">{job.sourceSummary.totalSources}</td>
                  <td className="px-4 py-3 text-wk-text-soft">{job.jobSummary.totalCandidates}</td>
                  <td className="px-4 py-3 text-wk-text-muted">{job.editionDate}</td>
                  <td className="px-4 py-3 text-wk-text-muted">{job.createdBy}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => navigate(`/admin/charts/ingest-jobs/${job.id}`)}
                        className="rounded px-2 py-1 text-[11px] font-semibold text-wk-brand hover:bg-wk-brand-soft transition-colors whitespace-nowrap"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => handleCopyId(job.id)}
                        className="rounded px-2 py-1 text-[11px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised transition-colors"
                        title="Copy job ID"
                      >
                        <i className={copiedId === job.id ? "ri-check-line text-wk-success" : "ri-file-copy-line"} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredJobs.length === 0 && (
          <div className="px-4 py-14 text-center">
            <AdminChartsEmptyState
              icon="ri-history-line"
              title="No legacy jobs match"
              description="Try adjusting your filters. Legacy jobs are created via the CSV ingestion pipeline."
            />
          </div>
        )}
      </WkSurface>
    </div>
  );
}