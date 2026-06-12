/**
 * Chart Ingestion — rebuilt around the real WAKILISHA chart data structure.
 * Phases:
 *   0 Import Workspace  → 1 CSV Inspector → 2 Edition Assignment
 *   3 Mapping Studio    → 4 Validation & Repair → 5 Normalized Candidates
 *   6 Ranking Integrity → 7 Draft Builder → 8 Snapshot Preview
 */
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
  resetPipeline,
  getSnapshots,
  getEditionsApi,
  getCurrentRole,
  setCurrentRole,
  getRoleLabel,
  ALL_ROLES,
  hasCapability,
  getDisabledReason,
  getDiscoveredCsvSources,
  getCsvImportSessions,
} from "@/services/chartsIngestion/client";
import type { IngestJob, IngestSource, IngestCandidate, IngestMatch, ReviewIssue, DraftEntry, IngestJobLog, Snapshot, ChartEdition, CsvImportSession, DiscoveredCsvSource } from "@/services/chartsIngestion/types";
import type { UserRole } from "@/services/chartsIngestion/client";

import { PhaseNav } from "./components/PhaseNav";
import { ImportWorkspace } from "./components/ImportWorkspace";
import { CsvInspector } from "./components/CsvInspector";
import { EditionAssignment } from "./components/EditionAssignment";
import { MappingStudio } from "./components/MappingStudio";
import { ValidationRepair } from "./components/ValidationRepair";
import { NormalizedCandidates } from "./components/NormalizedCandidates";
import { RankingIntegrity } from "./components/RankingIntegrity";
import { DraftBuilder } from "./components/DraftBuilder";
import { SnapshotPreview } from "./components/SnapshotPreview";
import { Timeline } from "./components/Timeline";
import { ApiContractDrawer } from "./components/ApiContractDrawer";
import { SimulationPanel } from "./components/SimulationPanel";

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

const PHASES = [
  { id: "import", label: "Import Workspace", icon: "ri-folder-upload-line" },
  { id: "inspect", label: "CSV Inspector", icon: "ri-file-search-line" },
  { id: "edition", label: "Edition Assignment", icon: "ri-calendar-todo-line" },
  { id: "mapping", label: "Mapping Studio", icon: "ri-git-merge-line" },
  { id: "validation", label: "Validation & Repair", icon: "ri-shield-check-line" },
  { id: "candidates", label: "Normalized Candidates", icon: "ri-list-check-2" },
  { id: "ranking", label: "Ranking Integrity", icon: "ri-bar-chart-grouped-line" },
  { id: "draft", label: "Draft Builder", icon: "ri-draft-line" },
  { id: "snapshot", label: "Snapshot Preview", icon: "ri-lock-2-line" },
];

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
  const [summary, setSummary] = useState<ReturnType<typeof getJobSummaryApi> | null>(null);
  const [activePhase, setActivePhase] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showPipelineResetConfirm, setShowPipelineResetConfirm] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "warning" | "success" } | null>(null);
  const [discoveredCsvs, setDiscoveredCsvs] = useState<DiscoveredCsvSource[]>([]);
  const [importSessions, setImportSessions] = useState<CsvImportSession[]>([]);
  const [selectedCsv, setSelectedCsv] = useState<DiscoveredCsvSource | null>(null);
  const [selectedEditionId, setSelectedEditionId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!jobId) return;
    const [j, s, c, m, i, d, sum, l, sn, e, csvs, sessions] = await Promise.all([
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
      getDiscoveredCsvSources(),
      getCsvImportSessions(jobId),
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
    setDiscoveredCsvs(csvs);
    setImportSessions(sessions);
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

  const handlePipelineReset = useCallback(async () => {
    if (!jobId) return;
    setShowPipelineResetConfirm(false);
    try {
      await resetPipeline(jobId);
      showToast("Pipeline reset — all stages cleared, run back to draft", "success");
      await loadData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Pipeline reset failed",
        "error"
      );
    }
  }, [jobId, loadData, showToast]);

  const handleRoleChange = (newRole: UserRole) => {
    setCurrentRole(newRole);
    setRole(newRole);
    setShowRoleMenu(false);
    showToast(`Switched to ${getRoleLabel(newRole)} role`, "success");
  };

  const handleSelectCsv = (csv: DiscoveredCsvSource) => {
    setSelectedCsv(csv);
    setActivePhase(1);
  };

  const handleGoToPhase = (phase: number) => {
    setActivePhase(phase);
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

  const csvSources = sources.filter((s) => s.provider === "csv");
  const hasCsvSources = csvSources.length > 0;

  return (
    <div className="space-y-5">
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
              {importSessions.length > 0 && (
                <>
                  <span>·</span>
                  <span className="text-[var(--wk-brand)]">{importSessions.length} CSV import(s)</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 relative flex-wrap">
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
          {job.id !== "demo-job-001" && job.status !== "published" && job.status !== "committed" && job.status !== "committing" && (
            <>
              <button
                onClick={() => setShowPipelineResetConfirm(true)}
                className="wk-button wk-button-sm wk-button-ghost whitespace-nowrap text-[var(--wk-danger)] hover:bg-[var(--wk-danger-soft)]"
                disabled={isReadOnly}
                title={isReadOnly ? "Read-only mode" : "Reset pipeline — clear all stages and return to draft"}
              >
                <i className="ri-rewind-line" />
                Reset Pipeline
              </button>
              {showPipelineResetConfirm && (
                <div className="absolute right-0 top-12 z-50 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 shadow-lg w-80">
                  <div className="flex items-center gap-2">
                    <i className="ri-error-warning-line text-[var(--wk-warning)] text-lg" />
                    <div className="text-[13px] font-bold text-[var(--wk-text)]">Reset Pipeline?</div>
                  </div>
                  <div className="mt-2 text-[11px] text-[var(--wk-text-muted)] leading-relaxed">
                    This will clear <strong>all</strong> stage results — raw rows, normalized rows, candidates, matches, review issues, scores, and exclusions. The run will be reset to <strong>draft</strong> status.
                  </div>
                  <div className="mt-2 text-[11px] text-[var(--wk-warning)] font-semibold">
                    This cannot be undone.
                  </div>
                  <div className="mt-3 flex items-center gap-2 justify-end">
                    <button
                      onClick={() => setShowPipelineResetConfirm(false)}
                      className="wk-button wk-button-sm wk-button-ghost whitespace-nowrap"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePipelineReset}
                      className="wk-button wk-button-sm wk-button-danger whitespace-nowrap"
                    >
                      <i className="ri-rewind-line" />
                      Reset Pipeline
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
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
              onClick={() => setActivePhase(8)}
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

      {/* Phase Navigation */}
      <WkSurface className="p-4">
        <PhaseNav
          phases={PHASES}
          activePhase={activePhase}
          onPhaseChange={setActivePhase}
          job={job}
          summary={summary}
          candidates={candidates}
          issues={issues}
          draftEntries={draftEntries}
          discoveredCsvs={discoveredCsvs}
          importSessions={importSessions}
        />
      </WkSurface>

      {/* Simulation Panel (demo only) */}
      {job.id === "demo-job-001" && hasCapability(role, "simulate_failures") && (
        <SimulationPanel jobId={job.id} onUpdate={handleUpdate} />
      )}

      {/* Timeline (collapsible) */}
      {showTimeline && <Timeline logs={logs} jobId={job.id} />}

      {/* Main Content */}
      <div>
        {activePhase === 0 && (
          <ImportWorkspace
            jobId={job.id}
            discoveredCsvs={discoveredCsvs}
            importSessions={importSessions}
            onSelectCsv={handleSelectCsv}
            onUpdate={handleUpdate}
            role={role}
          />
        )}
        {activePhase === 1 && (
          <CsvInspector
            csv={selectedCsv}
            discoveredCsvs={discoveredCsvs}
            onSelectCsv={handleSelectCsv}
            onGoToPhase={handleGoToPhase}
            onUpdate={handleUpdate}
            role={role}
          />
        )}
        {activePhase === 2 && (
          <EditionAssignment
            job={job}
            discoveredCsvs={discoveredCsvs}
            selectedCsv={selectedCsv}
            onSelectCsv={handleSelectCsv}
            onUpdate={handleUpdate}
            role={role}
          />
        )}
        {activePhase === 3 && (
          <MappingStudio
            csv={selectedCsv}
            discoveredCsvs={discoveredCsvs}
            onSelectCsv={handleSelectCsv}
            onUpdate={handleUpdate}
            role={role}
          />
        )}
        {activePhase === 4 && (
          <ValidationRepair
            jobId={job.id}
            discoveredCsvs={discoveredCsvs}
            candidates={candidates}
            issues={issues}
            importSessions={importSessions}
            onUpdate={handleUpdate}
            role={role}
          />
        )}
        {activePhase === 5 && (
          <NormalizedCandidates
            jobId={job.id}
            candidates={candidates}
            matches={matches}
            issues={issues}
            importSessions={importSessions}
            onUpdate={handleUpdate}
            role={role}
          />
        )}
        {activePhase === 6 && (
          <RankingIntegrity
            jobId={job.id}
            job={job}
            candidates={candidates}
            onUpdate={handleUpdate}
            role={role}
          />
        )}
        {activePhase === 7 && (
          <DraftBuilder
            jobId={job.id}
            job={job}
            draftEntries={draftEntries}
            candidates={candidates}
            importSessions={importSessions}
            hasBlockingIssues={summary.hasBlockingIssues}
            hasUnresolvedMatches={summary.hasUnresolvedMatches}
            onUpdate={handleUpdate}
            role={role}
          />
        )}
        {activePhase === 8 && (
          <SnapshotPreview
            jobId={job.id}
            job={job}
            summary={summary}
            draftEntries={draftEntries}
            importSessions={importSessions}
            candidates={candidates}
            issues={issues}
            sources={sources}
            onUpdate={handleUpdate}
            role={role}
          />
        )}
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