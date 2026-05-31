import { useState, useEffect } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkTag } from "@/components/design-system/primitives/Tag";
import type { IngestJob, DraftEntry, CsvImportSession } from "@/services/chartsIngestion/types";
import {
  createDraftEdition,
  createDraftFromCsvCandidates,
  validateCsvDraftIntegrity,
  exportDraftJson,
  hasCapability,
  getCsvImportSessions,
  getCandidates,
} from "@/services/chartsIngestion/client";
import type { UserRole, CsvIntegrityViolation } from "@/services/chartsIngestion/client";

interface DraftStepProps {
  jobId: string;
  job: IngestJob;
  draftEntries: DraftEntry[];
  hasBlockingIssues: boolean;
  hasUnresolvedMatches: boolean;
  onUpdate: () => void;
  role?: UserRole;
}

type EditionSetupForm = {
  familyId: string;
  editionLabel: string;
  editionDate: string;
  periodStart: string;
  periodEnd: string;
  chartSize: number;
};

export function DraftStep({ jobId, job, draftEntries, hasBlockingIssues, hasUnresolvedMatches, onUpdate, role = "admin" }: DraftStepProps) {
  const canCreateDraft = hasCapability(role, "create_draft");
  const [csvIntegrityViolations, setCsvIntegrityViolations] = useState<CsvIntegrityViolation[]>([]);
  const [csvCandidateCount, setCsvCandidateCount] = useState(0);
  const [mockCandidateCount, setMockCandidateCount] = useState(0);
  const [manualCandidateCount, setManualCandidateCount] = useState(0);
  const [importSessions, setImportSessions] = useState<CsvImportSession[]>([]);
  const [csvDraftResult, setCsvDraftResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isCreatingCsvDraft, setIsCreatingCsvDraft] = useState(false);
  const [showEditionSetup, setShowEditionSetup] = useState(false);
  const [editionSetup, setEditionSetup] = useState<EditionSetupForm>({
    familyId: job.chartFamilyId,
    editionLabel: "",
    editionDate: job.editionDate,
    periodStart: job.periodStart,
    periodEnd: job.periodEnd,
    chartSize: job.chartSize,
  });
  const [selectedEntry, setSelectedEntry] = useState<DraftEntry | null>(null);
  const [exportCopied, setExportCopied] = useState(false);

  useEffect(() => {
    getCandidates(jobId).then((candidates) => {
      const csvCount = candidates.filter((c) => c.sourceType === "csv").length;
      const mockCount = candidates.filter((c) => !c.sourceType || c.sourceType === "mock").length;
      const manualCount = candidates.filter((c) => c.sourceType === "manual").length;
      setCsvCandidateCount(csvCount);
      setMockCandidateCount(mockCount);
      setManualCandidateCount(manualCount);

      // Run integrity check on CSV candidates
      if (csvCount > 0) {
        const violations = validateCsvDraftIntegrity(jobId, job.chartSize);
        setCsvIntegrityViolations(violations);
      }
    });
    getCsvImportSessions(jobId).then(setImportSessions);
  }, [jobId, job.chartSize]);

  const handleCreateDraft = async () => {
    if (!canCreateDraft) return;
    await createDraftEdition(jobId);
    onUpdate();
  };

  const handleCreateCsvDraft = async () => {
    if (!canCreateDraft) return;
    // Check if edition setup is needed (no CSV chart metadata detected)
    const hasEditionMetadata = importSessions.some((s) => s.mappingUsed.chart_week || s.mappingUsed.chart_date);
    if (!hasEditionMetadata && !editionSetup.editionLabel) {
      setShowEditionSetup(true);
      return;
    }
    setIsCreatingCsvDraft(true);
    const result = await createDraftFromCsvCandidates(jobId, job.chartSize);
    setIsCreatingCsvDraft(false);
    if (result.success) {
      setCsvDraftResult({ success: true, message: `Draft created with ${result.entryCount} CSV entries` });
      onUpdate();
    } else {
      const highViolations = result.violations.filter((v) => v.severity === "high");
      setCsvDraftResult({ success: false, message: `Blocked: ${highViolations.map((v) => v.message).join("; ")}` });
    }
  };

  const handleExportDraft = async () => {
    const json = await exportDraftJson(jobId);
    try {
      await navigator.clipboard.writeText(json);
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2500);
    } catch {
      // Fallback: download as file
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `draft-${jobId}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const hasCsvCandidates = csvCandidateCount > 0;
  const csvHighViolations = csvIntegrityViolations.filter((v) => v.severity === "high");
  const csvBlocked = csvHighViolations.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Draft Edition</h2>
        <div className="flex items-center gap-2">
          <WkTag variant="brand">{draftEntries.length} entries</WkTag>
          <WkTag>{job.chartSize} target</WkTag>
          {draftEntries.length > 0 && (
            <button
              onClick={handleExportDraft}
              className="wk-button wk-button-sm wk-button-ghost whitespace-nowrap"
              title="Export draft JSON to clipboard / download"
            >
              {exportCopied ? <i className="ri-check-line text-[var(--wk-success)]" /> : <i className="ri-download-2-line" />}
              {exportCopied ? "Copied!" : "Export draft JSON"}
            </button>
          )}
        </div>
      </div>

      {/* Candidate Source Summary */}
      {(hasCsvCandidates || mockCandidateCount > 0 || manualCandidateCount > 0) && (
        <WkSurface className="p-4">
          <h3 className="mb-3 text-[13px] font-bold text-[var(--wk-text)]">Candidate Sources</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-[var(--wk-border)] p-3 text-center">
              <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">CSV Imported</div>
              <div className="mt-1 text-[18px] font-black text-[var(--wk-brand)]">{csvCandidateCount}</div>
              <div className="mt-0.5 text-[10px] text-[var(--wk-text-faint)]">from WAKILISHA export</div>
            </div>
            <div className="rounded-lg border border-[var(--wk-border)] p-3 text-center">
              <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Generated</div>
              <div className="mt-1 text-[18px] font-black text-[var(--wk-text)]">{mockCandidateCount}</div>
              <div className="mt-0.5 text-[10px] text-[var(--wk-text-faint)]">scoring + normalization</div>
            </div>
            <div className="rounded-lg border border-[var(--wk-border)] p-3 text-center">
              <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Manual</div>
              <div className="mt-1 text-[18px] font-black text-[var(--wk-text)]">{manualCandidateCount}</div>
              <div className="mt-0.5 text-[10px] text-[var(--wk-text-faint)]">hand-entered</div>
            </div>
          </div>
        </WkSurface>
      )}

      {/* CSV Import Sessions Summary */}
      {importSessions.length > 0 && (
        <WkSurface className="p-4">
          <h3 className="mb-3 text-[13px] font-bold text-[var(--wk-text)]">
            <i className="ri-file-list-3-line text-[var(--wk-brand)] mr-1.5" />
            CSV Import Sessions
          </h3>
          <div className="space-y-2">
            {importSessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] px-3 py-2">
                <div className="flex items-center gap-2">
                  <i className="ri-file-list-line text-[var(--wk-brand)]" />
                  <span className="text-[12px] font-semibold text-[var(--wk-text)]">{session.filename}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-[var(--wk-text-muted)]">{session.rowCount} rows</span>
                  <span className="text-[var(--wk-success)] font-semibold">{session.candidateCount} candidates</span>
                  {session.issueCount > 0 && (
                    <span className="text-[var(--wk-warning)] font-semibold">{session.issueCount} issues</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </WkSurface>
      )}

      {/* CSV Integrity Check */}
      {hasCsvCandidates && csvIntegrityViolations.length > 0 && (
        <WkSurface className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <i className={`${csvBlocked ? "ri-lock-line text-[var(--wk-danger)]" : "ri-alert-line text-[var(--wk-warning)]"}`} />
            <h3 className="text-[13px] font-bold text-[var(--wk-text)]">CSV Ranking Integrity Check</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              csvBlocked ? "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]" : "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]"
            }`}>
              {csvHighViolations.length} blocking / {csvIntegrityViolations.length - csvHighViolations.length} warnings
            </span>
          </div>
          <div className="space-y-2">
            {csvIntegrityViolations.map((v, i) => (
              <div key={i} className={`flex items-start gap-2 rounded-lg border-l-2 p-2 ${
                v.severity === "high" ? "border-l-[var(--wk-danger)] bg-[var(--wk-danger-soft)]" :
                "border-l-[var(--wk-warning)] bg-[var(--wk-warning-soft)]"
              }`}>
                <i className={`mt-0.5 text-sm ${v.severity === "high" ? "ri-error-warning-line text-[var(--wk-danger)]" : "ri-alert-line text-[var(--wk-warning)]"}`} />
                <div>
                  <div className="text-[11px] font-semibold text-[var(--wk-text)]">{v.type.replace(/_/g, " ")}</div>
                  <div className="text-[10px] text-[var(--wk-text-soft)]">{v.message}</div>
                </div>
              </div>
            ))}
          </div>
        </WkSurface>
      )}

      {/* Edition Setup Card */}
      {showEditionSetup && (
        <WkSurface className="p-4 border-2 border-[var(--wk-brand)]">
          <div className="flex items-center gap-2 mb-4">
            <i className="ri-calendar-todo-line text-[var(--wk-brand)]" />
            <h3 className="text-[13px] font-bold text-[var(--wk-text)]">Edition Setup Required</h3>
            <span className="rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">
              CSV does not provide chart metadata
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Edition Label *</label>
              <input
                type="text"
                value={editionSetup.editionLabel}
                onChange={(e) => setEditionSetup((p) => ({ ...p, editionLabel: e.target.value }))}
                placeholder="Week 22, 2026"
                className="mt-1 w-full rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[12px] text-[var(--wk-text)]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Edition Date *</label>
              <input
                type="date"
                value={editionSetup.editionDate}
                onChange={(e) => setEditionSetup((p) => ({ ...p, editionDate: e.target.value }))}
                className="mt-1 w-full rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[12px] text-[var(--wk-text)]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Chart Size</label>
              <input
                type="number"
                value={editionSetup.chartSize}
                onChange={(e) => setEditionSetup((p) => ({ ...p, chartSize: parseInt(e.target.value) || 40 }))}
                min={1}
                max={200}
                className="mt-1 w-full rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[12px] text-[var(--wk-text)]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Period Start</label>
              <input
                type="date"
                value={editionSetup.periodStart}
                onChange={(e) => setEditionSetup((p) => ({ ...p, periodStart: e.target.value }))}
                className="mt-1 w-full rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[12px] text-[var(--wk-text)]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Period End</label>
              <input
                type="date"
                value={editionSetup.periodEnd}
                onChange={(e) => setEditionSetup((p) => ({ ...p, periodEnd: e.target.value }))}
                className="mt-1 w-full rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[12px] text-[var(--wk-text)]"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={async () => {
                if (!editionSetup.editionLabel) return;
                setShowEditionSetup(false);
                setIsCreatingCsvDraft(true);
                const result = await createDraftFromCsvCandidates(jobId, editionSetup.chartSize);
                setIsCreatingCsvDraft(false);
                if (result.success) {
                  setCsvDraftResult({ success: true, message: `Draft created with ${result.entryCount} CSV entries` });
                  onUpdate();
                } else {
                  const highV = result.violations.filter((v) => v.severity === "high");
                  setCsvDraftResult({ success: false, message: `Blocked: ${highV.map((v) => v.message).join("; ")}` });
                }
              }}
              disabled={!editionSetup.editionLabel}
              className={`wk-button wk-button-primary whitespace-nowrap ${!editionSetup.editionLabel ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <i className="ri-check-line" />
              Confirm & Create Draft
            </button>
            <button
              onClick={() => setShowEditionSetup(false)}
              className="wk-button wk-button-ghost whitespace-nowrap"
            >
              Cancel
            </button>
          </div>
        </WkSurface>
      )}

      {/* CSV Draft Result */}
      {csvDraftResult && (
        <div className={`rounded-xl border p-4 ${
          csvDraftResult.success
            ? "border-[var(--wk-success)] bg-[var(--wk-success-soft)]"
            : "border-[var(--wk-danger)] bg-[var(--wk-danger-soft)]"
        }`}>
          <div className="flex items-center gap-2">
            <i className={csvDraftResult.success ? "ri-check-double-line text-[var(--wk-success)]" : "ri-close-circle-line text-[var(--wk-danger)]"} />
            <span className={`text-[13px] font-semibold ${csvDraftResult.success ? "text-[var(--wk-success)]" : "text-[var(--wk-danger)]"}`}>
              {csvDraftResult.message}
            </span>
          </div>
        </div>
      )}

      {/* Create Draft Actions */}
      {draftEntries.length === 0 && (
        <WkSurface className="p-5">
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
              <i className="ri-draft-line text-xl" />
            </div>
            <div className="text-center">
              <div className="text-[14px] font-bold text-[var(--wk-text)]">No draft edition created yet</div>
              <div className="mt-1 text-[12px] text-[var(--wk-text-muted)]">
                Create a draft from the ranked candidates to continue.
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {hasCsvCandidates && (
                <button
                  onClick={handleCreateCsvDraft}
                  disabled={csvBlocked || !canCreateDraft || isCreatingCsvDraft}
                  className={`wk-button whitespace-nowrap ${
                    csvBlocked || !canCreateDraft
                      ? "wk-button-danger cursor-not-allowed"
                      : "wk-button-primary"
                  }`}
                  title={csvBlocked ? "CSV integrity violations must be fixed first" : ""}
                >
                  {isCreatingCsvDraft ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-file-list-3-line" />}
                  Create draft from CSV candidates
                </button>
              )}
              <button
                onClick={handleCreateDraft}
                disabled={hasBlockingIssues || hasUnresolvedMatches || !canCreateDraft}
                className={`wk-button whitespace-nowrap ${
                  hasBlockingIssues || hasUnresolvedMatches || !canCreateDraft
                    ? "wk-button-ghost opacity-60 cursor-not-allowed"
                    : "wk-button-ghost"
                }`}
              >
                <i className="ri-add-line" />
                Create from all candidates
              </button>
            </div>
            {(hasBlockingIssues || hasUnresolvedMatches) && (
              <div className="text-[12px] text-[var(--wk-danger)]">
                {hasBlockingIssues && "Cannot create draft: blocking issues exist. "}
                {hasUnresolvedMatches && "Cannot create draft: unresolved matches exist."}
              </div>
            )}
          </div>
        </WkSurface>
      )}

      {/* Draft Table */}
      {draftEntries.length > 0 && (
        <WkSurface className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--wk-border)]">
            <h3 className="text-[13px] font-bold text-[var(--wk-text)]">Draft Entries</h3>
            <div className="flex items-center gap-2">
              {/* Source type breakdown */}
              {(() => {
                const csvEntries = draftEntries.filter((e) => e.sourceType === "csv").length;
                const mockEntries = draftEntries.filter((e) => !e.sourceType || e.sourceType === "mock").length;
                const manualEntries = draftEntries.filter((e) => e.sourceType === "manual").length;
                return (
                  <>
                    {csvEntries > 0 && (
                      <span className="rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-brand)]">
                        {csvEntries} CSV
                      </span>
                    )}
                    {mockEntries > 0 && (
                      <span className="rounded-full bg-[var(--wk-text-faint)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-text-faint)]">
                        {mockEntries} Generated
                      </span>
                    )}
                    {manualEntries > 0 && (
                      <span className="rounded-full bg-[var(--wk-info-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-info)]">
                        {manualEntries} Manual
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="wk-table min-w-full">
              <thead>
                <tr>
                  <th className="whitespace-nowrap">Rank</th>
                  <th className="whitespace-nowrap">Previous</th>
                  <th className="whitespace-nowrap">Movement</th>
                  <th className="whitespace-nowrap">Track</th>
                  <th className="whitespace-nowrap">Source</th>
                  <th className="whitespace-nowrap">Peak</th>
                  <th className="whitespace-nowrap">Weeks</th>
                  <th className="whitespace-nowrap">Score</th>
                  <th className="whitespace-nowrap">Detail</th>
                </tr>
              </thead>
              <tbody>
                {draftEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className={entry.sourceType === "csv" ? "bg-[var(--wk-brand-soft)]/10" : ""}
                  >
                    <td className="tabular-nums font-bold text-[var(--wk-text)]">{entry.finalRank}</td>
                    <td className="tabular-nums text-[12px] text-[var(--wk-text-muted)]">{entry.previousRank ?? "—"}</td>
                    <td>
                      <span className={`text-[12px] font-semibold ${
                        entry.movement === "up" ? "text-[var(--wk-success)]" :
                        entry.movement === "down" ? "text-[var(--wk-danger)]" :
                        entry.movement === "new" ? "text-[var(--wk-brand)]" :
                        entry.movement === "same" ? "text-[var(--wk-text-muted)]" :
                        "text-[var(--wk-warning)]"
                      }`}>
                        {entry.movement === "up" && "↑"}
                        {entry.movement === "down" && "↓"}
                        {entry.movement === "new" && "NEW"}
                        {entry.movement === "same" && "—"}
                        {entry.movement === "re_entry" && "RE"}
                      </span>
                    </td>
                    <td className="font-semibold text-[var(--wk-text)]">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[140px]">
                          {(entry.entryPayload?.track as Record<string, unknown>)?.normalizedTitle as string ?? `Entry #${entry.finalRank}`}
                        </span>
                      </div>
                    </td>
                    <td>
                      {entry.sourceType === "csv" ? (
                        <span className="rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[9px] font-semibold text-[var(--wk-brand)]">
                          CSV
                        </span>
                      ) : entry.sourceType === "manual" ? (
                        <span className="rounded-full bg-[var(--wk-info-soft)] px-2 py-0.5 text-[9px] font-semibold text-[var(--wk-info)]">
                          Manual
                        </span>
                      ) : (
                        <span className="rounded-full bg-[var(--wk-text-faint)]/10 px-2 py-0.5 text-[9px] font-semibold text-[var(--wk-text-faint)]">
                          Gen
                        </span>
                      )}
                    </td>
                    <td className="tabular-nums text-[12px] text-[var(--wk-text-muted)]">{entry.peakPosition ?? "—"}</td>
                    <td className="tabular-nums text-[12px] text-[var(--wk-text-muted)]">{entry.weeksOnChart ?? "—"}</td>
                    <td className="tabular-nums text-[12px] font-semibold text-[var(--wk-brand)]">{entry.score.toFixed(1)}</td>
                    <td>
                      <button
                        onClick={() => setSelectedEntry(entry)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
                      >
                        <i className="ri-eye-line text-xs" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WkSurface>
      )}

      {/* Draft Entry Detail Drawer */}
      {selectedEntry && (
        <DraftEntryDrawer entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      )}
    </div>
  );
}

function DraftEntryDrawer({ entry, onClose }: { entry: DraftEntry; onClose: () => void }) {
  const track = entry.entryPayload?.track as Record<string, unknown> | undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-[var(--wk-surface)] p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-[var(--wk-text)]">Draft Entry Detail</h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]">
            <i className="ri-close-line" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          {track?.artworkUrl && (
            <img src={String(track.artworkUrl)} alt="" className="h-14 w-14 rounded-lg object-cover" />
          )}
          <div>
            <div className="text-[13px] font-bold text-[var(--wk-text)]">{String(track?.normalizedTitle ?? "Unknown")}</div>
            <div className="text-[12px] text-[var(--wk-text-muted)]">{String(track?.normalizedArtistLine ?? "Unknown")}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { label: "Final Rank", value: String(entry.finalRank), color: "text-[var(--wk-brand)]" },
            { label: "Previous Rank", value: String(entry.previousRank ?? "—") },
            { label: "Movement", value: entry.movement },
            { label: "Peak Position", value: String(entry.peakPosition ?? "—") },
            { label: "Weeks on Chart", value: String(entry.weeksOnChart ?? "—") },
            { label: "Score", value: entry.score.toFixed(1) },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border border-[var(--wk-border)] p-3">
              <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">{label}</div>
              <div className={`mt-1 text-[14px] font-black ${color ?? "text-[var(--wk-text)]"}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Source type badge */}
        <div className="mt-4">
          <h4 className="mb-2 text-[12px] font-bold text-[var(--wk-text)]">Candidate Source</h4>
          <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
            entry.sourceType === "csv" ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" :
            entry.sourceType === "manual" ? "bg-[var(--wk-info-soft)] text-[var(--wk-info)]" :
            "bg-[var(--wk-text-faint)]/10 text-[var(--wk-text-faint)]"
          }`}>
            {entry.sourceType === "csv" ? "CSV Import" : entry.sourceType === "manual" ? "Manual Entry" : "Generated / Streaming"}
          </span>
        </div>

        {/* CSV Provenance */}
        {entry.csvProvenance && (
          <div className="mt-4 rounded-lg border border-[var(--wk-brand)] bg-[var(--wk-brand-soft)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <i className="ri-file-list-line text-[var(--wk-brand)]" />
              <span className="text-[12px] font-bold text-[var(--wk-brand)]">CSV Provenance</span>
            </div>
            <div className="space-y-2">
              {[
                { label: "Source File", value: entry.csvProvenance.sourceFilename },
                { label: "Row Number", value: String(entry.csvProvenance.sourceRowNumber) },
                { label: "Raw Hash", value: entry.csvProvenance.rawRowHash },
                { label: "Rank Field", value: entry.csvProvenance.mappedRankField },
                { label: "Title Field", value: entry.csvProvenance.mappedTitleField },
                { label: "Artist Field", value: entry.csvProvenance.mappedArtistField },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--wk-text-muted)]">{label}</span>
                  <span className="font-mono text-[var(--wk-text)] truncate max-w-[180px]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ISRC */}
        {track?.isrc && (
          <div className="mt-4">
            <h4 className="mb-1 text-[12px] font-bold text-[var(--wk-text)]">ISRC</h4>
            <span className="font-mono text-[12px] text-[var(--wk-text-muted)]">{String(track.isrc)}</span>
          </div>
        )}
      </div>
    </div>
  );
}