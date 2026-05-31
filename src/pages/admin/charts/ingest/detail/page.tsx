import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  getIngestJob,
  getSources,
  getCandidates,
  getMatches,
  getReviewIssues,
  getDraftEntries,
  getJobSummaryApi,
  getJobLogs,
  resetDemo,
  getSnapshots,
  getEditionsApi,
  getCurrentRole,
  setCurrentRole,
  getRoleLabel,
  ALL_ROLES,
  hasCapability,
  getDisabledReason,
} from "@/services/chartsIngestion/client";
import { getJobSummary } from "@/services/chartsIngestion/client";
import type { IngestJob, IngestSource, IngestCandidate, IngestMatch, ReviewIssue, DraftEntry, IngestJobLog, Snapshot, ChartEdition } from "@/services/chartsIngestion/types";

import { Stepper } from "./components/Stepper";
import { JobSummaryRail } from "./components/JobSummaryRail";
import { SetupStep } from "./components/SetupStep";
import { SourcesStep } from "./components/SourcesStep";
import { FetchStep } from "./components/FetchStep";
import { CandidatesStep } from "./components/CandidatesStep";
import { MatchingStep } from "./components/MatchingStep";
import { IssuesStep } from "./components/IssuesStep";
import { RankingStep } from "./components/RankingStep";
import { DraftStep } from "./components/DraftStep";
import { PublishStep } from "./components/PublishStep";
import { Timeline } from "./components/Timeline";
import { ApiContractDrawer } from "./components/ApiContractDrawer";
import { SimulationPanel } from "./components/SimulationPanel";
import type { UserRole } from "@/services/chartsIngestion/client";

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
  return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function AdminChartsIngestDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>(getCurrentRole());
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [job, setJob] = useState<IngestJob | null>(null);
  const [sources, setSources] = useState<IngestSource[]>([]);
  const [candidates, setCandidates] = useState<IngestCandidate[]>([]);
  const [matches, setMatches] = useState<IngestMatch[]>([]);
  const [issues, setIssues] = useState<ReviewIssue[]>([]);
  const [draftEntries, setDraftEntries] = useState<DraftEntry[]>([]);
  const [logs, setLogs] = useState<IngestJobLog[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [editions, setEditions] = useState<ChartEdition[]>([]);
  const [summary, setSummary] = useState<ReturnType<typeof getJobSummary> | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "warning" | "success" } | null>(null);

  const loadData = useCallback(async () => {
    if (!jobId) return;
    const [j, s, c, m, i, d, sum, l, sn, e] = await Promise.all([
      getIngestJob(jobId),
      getSources(jobId),
      getCandidates(jobId),
      getMatches(jobId),
      getReviewIssues(jobId),
      getDraftEntries(jobId),
      getJobSummaryApi(jobId),
      getJobLogs(jobId),
      getSnapshots(),
      getEditionsApi(),
    ]);
    setJob(j);
    setSources(s);
    setCandidates(c);
    setMatches(m);
    setIssues(i);
    setDraftEntries(d);
    setSummary(sum);
    setLogs(l);
    setSnapshots(sn);
    setEditions(e);
    if (j) {
      const statusStepMap: Record<string, number> = {
        draft: 0,
        fetching: 2,
        normalizing: 3,
        matching: 4,
        scoring: 6,
        review: 5,
        ready_to_draft: 7,
        drafted: 7,
        published: 8,
        failed: -1,
        cancelled: -1,
      };
      setActiveStep(statusStepMap[j.status] ?? 0);
    }
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdate = useCallback(() => {
    loadData();
  }, [loadData]);

  const handleReset = useCallback(() => {
    resetDemo();
    window.location.reload();
  }, []);

  const showToast = useCallback((message: string, type: "error" | "warning" | "success" = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleRoleChange = (newRole: UserRole) => {
    setCurrentRole(newRole);
    setRole(newRole);
    setShowRoleMenu(false);
    showToast(`Switched to ${getRoleLabel(newRole)} role`, "success");
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[var(--wk-text-muted)]">Loading job details...</div>
      </div>
    );
  }

  if (!job || !summary) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/admin/charts/ingest")} className="text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]">
            <i className="ri-arrow-left-line" />
          </button>
          <h1 className="text-[20px] font-bold text-[var(--wk-text)]">Job not found</h1>
        </div>
      </div>
    );
  }

  const highIssues = issues.filter((i) => i.severity === "high" && i.status === "open");
  const isPublishable = job.status === "ready_to_draft" || job.status === "drafted" || job.status === "published";
  const hasBlockingIssues = highIssues.length > 0;
  const isViewer = role === "viewer";
  const isReadOnly = isViewer;

  const jobEdition = editions.find((e) => e.ingestJobId === jobId) ?? null;
  const jobSnapshot = snapshots.find((s) => s.editionId === jobEdition?.id) ?? null;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-xl px-4 py-3 shadow-lg ${
          toast.type === "error" ? "bg-[var(--wk-danger)] text-white" :
          toast.type === "warning" ? "bg-[var(--wk-warning)] text-white" :
          "bg-[var(--wk-success)] text-white"
        }`}>
          <div className="flex items-center gap-2">
            <i className={toast.type === "error" ? "ri-close-circle-line" : toast.type === "warning" ? "ri-error-warning-line" : "ri-check-line"} />
            <span className="text-[12px] font-semibold">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/admin/charts/ingest")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
          >
            <i className="ri-arrow-left-line" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[18px] font-bold text-[var(--wk-text)]">
                {job.chartFamily?.label ?? "Unknown Family"}
              </h1>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[job.status] ?? ""}`}>
                {formatStatus(job.status)}
              </span>
              {isReadOnly && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[var(--wk-info-soft)] text-[var(--wk-info)]">
                  <i className="ri-eye-line mr-1" />
                  Read-Only
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[var(--wk-text-muted)]">
              <span>{job.editionSlug ?? job.editionDate}</span>
              <span>·</span>
              <span>{job.chartSize} entries</span>
              <span>·</span>
              <span>{job.rulesetKey}</span>
              <span>·</span>
              <span>by {job.createdBy}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 relative flex-wrap">
          {/* Role Selector */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)] transition-all"
            >
              <i className="ri-user-settings-line" />
              <span className="text-[11px]">{getRoleLabel(role)}</span>
              <i className={showRoleMenu ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} />
            </button>
            {showRoleMenu && (
              <div className="absolute right-0 top-10 z-50 w-52 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-lg p-1">
                {ALL_ROLES.map((r) => (
                  <button
                    key={r}
                    onClick={() => handleRoleChange(r)}
                    className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold text-left transition-all ${
                      r === role
                        ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                        : "text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]"
                    }`}
                  >
                    <i className={r === role ? "ri-check-line" : "ri-circle-line text-[var(--wk-text-faint)]"} />
                    {getRoleLabel(r)}
                  </button>
                ))}
                <div className="mt-1 border-t border-[var(--wk-border)] pt-2 px-3">
                  <div className="text-[10px] text-[var(--wk-text-muted)]">
                    {role === "viewer" ? "All actions are read-only" :
                     role === "contributor" ? "Can add manual/CSV sources only" :
                     role === "chart_editor" ? "Cannot publish or override high issues" :
                     role === "editor_in_chief" ? "Full editorial control" :
                     "Full system access"}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className="wk-button wk-button-sm wk-button-ghost whitespace-nowrap"
          >
            <i className={showTimeline ? "ri-eye-off-line" : "ri-time-line"} />
            {showTimeline ? "Hide Timeline" : "Timeline"}
          </button>
          <button
            onClick={() => setShowContract(true)}
            className="wk-button wk-button-sm wk-button-ghost whitespace-nowrap"
          >
            <i className="ri-code-box-line" />
            API Contract
          </button>
          {job.id === "demo-job-001" && (
            <>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="wk-button wk-button-ghost whitespace-nowrap"
                disabled={isReadOnly}
                title={isReadOnly ? "Read-only mode" : ""}
              >
                <i className="ri-restart-line" />
                Reset Demo
              </button>
              {showResetConfirm && (
                <div className="absolute right-0 top-12 z-50 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 shadow-lg">
                  <div className="text-[13px] font-bold text-[var(--wk-text)]">Reset Demo Job?</div>
                  <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">All changes will be reverted.</div>
                  <div className="mt-3 flex items-center gap-2">
                    <button onClick={handleReset} className="wk-button wk-button-sm wk-button-danger">
                      Reset
                    </button>
                    <button onClick={() => setShowResetConfirm(false)} className="wk-button wk-button-sm wk-button-ghost">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {isPublishable && !hasBlockingIssues && (
            <button
              onClick={() => setActiveStep(8)}
              className="wk-button wk-button-primary whitespace-nowrap"
            >
              <i className="ri-check-double-line" />
              Publish Edition
            </button>
          )}
          {isPublishable && hasBlockingIssues && (
            <button className="wk-button wk-button-danger whitespace-nowrap" disabled>
              <i className="ri-lock-line" />
              {highIssues.length} Blocking Issues
            </button>
          )}
        </div>
      </div>

      {/* Stepper */}
      <WkSurface className="p-4">
        <Stepper
          jobId={job.id}
          jobStatus={job.status}
          activeStep={activeStep}
          onStepChange={setActiveStep}
        />
      </WkSurface>

      {/* Simulation Panel (demo only) */}
      {job.id === "demo-job-001" && hasCapability(role, "simulate_failures") && (
        <SimulationPanel jobId={job.id} onUpdate={handleUpdate} />
      )}

      {/* Timeline (collapsible) */}
      {showTimeline && (
        <Timeline logs={logs} jobId={job.id} />
      )}

      {/* Main Content + Rail */}
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        {/* Step Content */}
        <div>
          {activeStep === 0 && <SetupStep job={job} />}
          {activeStep === 1 && <SourcesStep jobId={job.id} sources={sources} onUpdate={handleUpdate} role={role} />}
          {activeStep === 2 && <FetchStep sources={sources} />}
          {activeStep === 3 && <CandidatesStep jobId={job.id} candidates={candidates} matches={matches} issues={issues} onUpdate={handleUpdate} role={role} />}
          {activeStep === 4 && <MatchingStep jobId={job.id} candidates={candidates} matches={matches} onUpdate={handleUpdate} role={role} />}
          {activeStep === 5 && <IssuesStep jobId={job.id} issues={issues} onUpdate={handleUpdate} role={role} />}
          {activeStep === 6 && <RankingStep jobId={job.id} candidates={candidates} onUpdate={handleUpdate} role={role} />}
          {activeStep === 7 && <DraftStep jobId={job.id} job={job} draftEntries={draftEntries} hasBlockingIssues={summary.hasBlockingIssues} hasUnresolvedMatches={summary.hasUnresolvedMatches} onUpdate={handleUpdate} role={role} />}
          {activeStep === 8 && <PublishStep jobId={job.id} job={job} summary={summary} onUpdate={handleUpdate} role={role} />}
        </div>

        {/* Summary Rail */}
        <div className="hidden lg:block">
          <JobSummaryRail job={job} summary={summary} />
        </div>
      </div>

      {/* Mobile Summary Rail */}
      <div className="lg:hidden">
        <JobSummaryRail job={job} summary={summary} collapsed />
      </div>

      {/* API Contract Drawer */}
      <ApiContractDrawer
        job={job}
        sources={sources}
        candidates={candidates}
        issues={issues}
        draftEntries={draftEntries}
        snapshot={jobSnapshot}
        edition={jobEdition}
        open={showContract}
        onClose={() => setShowContract(false)}
      />
    </div>
  );
}