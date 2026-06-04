/**
 * Draft Builder — Phase 7
 * Final chart order, entry count vs chart size, issue summary,
 * source summary, mapping summary, validation summary.
 * Create draft edition + Export draft JSON.
 */
import { useState } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestJob, DraftEntry, IngestCandidate, CsvImportSession } from "@/services/chartsIngestion/types";
import {
  createDraftEdition,
  createDraftFromCsvCandidates,
  validateCsvDraftIntegrity,
  exportDraftJson,
  hasCapability,
} from "@/services/chartsIngestion/client";
import type { UserRole, CsvIntegrityViolation } from "@/services/chartsIngestion/client";
import { useDraftMovement } from "./useDraftMovement";
import type { EnrichedDraftEntry } from "./useDraftMovement";

interface DraftBuilderProps {
  jobId: string;
  job: IngestJob;
  draftEntries: DraftEntry[];
  candidates: IngestCandidate[];
  importSessions: CsvImportSession[];
  hasBlockingIssues: boolean;
  hasUnresolvedMatches: boolean;
  onUpdate: () => void;
  role?: UserRole;
}

export function DraftBuilder({
  jobId,
  job,
  draftEntries,
  candidates,
  importSessions,
  hasBlockingIssues,
  hasUnresolvedMatches,
  onUpdate,
  role = "admin",
}: DraftBuilderProps) {
  const canCreateDraft = hasCapability(role, "create_draft");
  const [creating, setCreating] = useState(false);
  const [draftResult, setDraftResult] = useState<{ success: boolean; message: string } | null>(null);
  const [exportCopied, setExportCopied] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<EnrichedDraftEntry | null>(null);

  // Compute real movement by comparing against the prior published edition
  const enrichedEntries = useDraftMovement(job, draftEntries);

  const csvCandidates = candidates.filter((c) => c.sourceType === "csv");
  const violations: CsvIntegrityViolation[] = csvCandidates.length > 0
    ? validateCsvDraftIntegrity(jobId, job.chartSize)
    : [];
  const highViolations = violations.filter((v) => v.severity === "high");
  const csvBlocked = highViolations.length > 0;

  const csvEntries = draftEntries.filter((e) => e.sourceType === "csv");
  const genEntries = draftEntries.filter((e) => !e.sourceType || e.sourceType === "mock");
  const manualEntries = draftEntries.filter((e) => e.sourceType === "manual");

  const handleCreateFromCsv = async () => {
    if (!canCreateDraft || csvBlocked) return;
    setCreating(true);
    const result = await createDraftFromCsvCandidates(jobId, job.chartSize);
    setCreating(false);
    if (result.success) {
      setDraftResult({ success: true, message: `Draft created — ${result.entryCount} CSV entries` });
    } else {
      setDraftResult({ success: false, message: `Blocked: ${result.violations.filter((v) => v.severity === "high").map((v) => v.message).join("; ")}` });
    }
    onUpdate();
  };

  const handleCreateFromAll = async () => {
    if (!canCreateDraft || hasBlockingIssues || hasUnresolvedMatches) return;
    setCreating(true);
    await createDraftEdition(jobId);
    setCreating(false);
    setDraftResult({ success: true, message: "Draft created from all candidates" });
    onUpdate();
  };

  const handleExportJson = async () => {
    const json = await exportDraftJson(jobId);
    try {
      await navigator.clipboard.writeText(json);
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2500);
    } catch {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `draft-${jobId}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Draft Builder</h2>
          <p className="mt-0.5 text-[11px] text-[var(--wk-text-muted)]">
            Finalize the chart order and create a draft edition before publish.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {draftEntries.length > 0 && (
            <button onClick={handleExportJson} className="wk-button wk-button-sm wk-button-ghost whitespace-nowrap">
              {exportCopied ? <i className="ri-check-line text-[var(--wk-success)]" /> : <i className="ri-download-2-line" />}
              {exportCopied ? "Copied!" : "Export Draft JSON"}
            </button>
          )}
        </div>
      </div>

      {/* Summary panels */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <WkSurface className="p-3 text-center">
          <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Draft Entries</div>
          <div className={`mt-1 text-[20px] font-black ${draftEntries.length > 0 ? "text-[var(--wk-brand)]" : "text-[var(--wk-text-faint)]"}`}>{draftEntries.length}</div>
          <div className="text-[10px] text-[var(--wk-text-faint)]">of {job.chartSize} target</div>
        </WkSurface>
        <WkSurface className="p-3 text-center">
          <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">CSV Entries</div>
          <div className="mt-1 text-[20px] font-black text-[var(--wk-brand)]">{csvEntries.length}</div>
          <div className="text-[10px] text-[var(--wk-text-faint)]">{importSessions.length} sessions</div>
        </WkSurface>
        <WkSurface className="p-3 text-center">
          <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Candidates</div>
          <div className="mt-1 text-[20px] font-black text-[var(--wk-text)]">{candidates.length}</div>
          <div className="text-[10px] text-[var(--wk-text-faint)]">{csvCandidates.length} from CSV</div>
        </WkSurface>
        <WkSurface className="p-3 text-center">
          <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Status</div>
          <div className={`mt-1 text-[12px] font-black ${hasBlockingIssues ? "text-[var(--wk-danger)]" : draftEntries.length > 0 ? "text-[var(--wk-success)]" : "text-[var(--wk-text-faint)]"}`}>
            {hasBlockingIssues ? "Blocked" : draftEntries.length > 0 ? "Drafted" : "Pending"}
          </div>
        </WkSurface>
      </div>

      {/* CSV Integrity Violations */}
      {violations.length > 0 && (
        <WkSurface className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <i className={csvBlocked ? "ri-lock-line text-[var(--wk-danger)]" : "ri-alert-line text-[var(--wk-warning)]"} />
            <h3 className="text-[13px] font-bold text-[var(--wk-text)]">CSV Ranking Integrity</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${csvBlocked ? "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]" : "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]"}`}>
              {highViolations.length} blocking / {violations.length - highViolations.length} warnings
            </span>
          </div>
          <div className="space-y-2">
            {violations.map((v, i) => (
              <div key={i} className={`flex items-start gap-2 rounded-lg border-l-2 p-2 ${v.severity === "high" ? "border-l-[var(--wk-danger)] bg-[var(--wk-danger-soft)]" : "border-l-[var(--wk-warning)] bg-[var(--wk-warning-soft)]"}`}>
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

      {/* Import sessions summary */}
      {importSessions.length > 0 && (
        <WkSurface className="p-4">
          <h3 className="mb-3 text-[13px] font-bold text-[var(--wk-text)]">
            <i className="ri-file-list-3-line text-[var(--wk-brand)] mr-1.5" />
            CSV Import Sessions
          </h3>
          <div className="space-y-2">
            {importSessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] px-3 py-2">
                <div className="flex items-center gap-2">
                  <i className="ri-file-list-line text-[var(--wk-brand)]" />
                  <span className="text-[12px] font-semibold text-[var(--wk-text)]">{s.filename}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-[var(--wk-text-muted)]">{s.rowCount} rows</span>
                  <span className="text-[var(--wk-success)] font-semibold">{s.candidateCount} candidates</span>
                  {s.issueCount > 0 && <span className="text-[var(--wk-warning)] font-semibold">{s.issueCount} issues</span>}
                </div>
              </div>
            ))}
          </div>
        </WkSurface>
      )}

      {/* Draft result */}
      {draftResult && (
        <div className={`rounded-xl border p-4 ${draftResult.success ? "border-[var(--wk-success)] bg-[var(--wk-success-soft)]" : "border-[var(--wk-danger)] bg-[var(--wk-danger-soft)]"}`}>
          <div className="flex items-center gap-2">
            <i className={draftResult.success ? "ri-check-double-line text-[var(--wk-success)]" : "ri-close-circle-line text-[var(--wk-danger)]"} />
            <span className={`text-[13px] font-semibold ${draftResult.success ? "text-[var(--wk-success)]" : "text-[var(--wk-danger)]"}`}>
              {draftResult.message}
            </span>
          </div>
        </div>
      )}

      {/* Create Draft Actions */}
      {draftEntries.length === 0 && (
        <WkSurface className="p-5">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
              <i className="ri-draft-line text-xl" />
            </div>
            <div className="text-center">
              <div className="text-[14px] font-bold text-[var(--wk-text)]">No draft edition created yet</div>
              <div className="mt-1 text-[12px] text-[var(--wk-text-muted)]">Choose a creation method below.</div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {csvCandidates.length > 0 && (
                <button
                  onClick={handleCreateFromCsv}
                  disabled={csvBlocked || !canCreateDraft || creating}
                  className={`wk-button whitespace-nowrap ${csvBlocked || !canCreateDraft ? "wk-button-danger cursor-not-allowed" : "wk-button-primary"}`}
                  title={csvBlocked ? "CSV integrity violations must be fixed first" : ""}
                >
                  {creating ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-file-list-3-line" />}
                  Create Draft from CSV Candidates
                </button>
              )}
              <button
                onClick={handleCreateFromAll}
                disabled={hasBlockingIssues || hasUnresolvedMatches || !canCreateDraft || creating}
                className={`wk-button whitespace-nowrap ${hasBlockingIssues || hasUnresolvedMatches ? "wk-button-ghost opacity-60 cursor-not-allowed" : "wk-button-ghost"}`}
              >
                <i className="ri-add-line" />
                Create from All Candidates
              </button>
            </div>
            {(hasBlockingIssues || hasUnresolvedMatches) && (
              <div className="text-[12px] text-[var(--wk-danger)] text-center">
                {hasBlockingIssues && "Blocking issues must be resolved first. "}
                {hasUnresolvedMatches && "Unresolved matches must be cleared first."}
              </div>
            )}
          </div>
        </WkSurface>
      )}

      {/* Draft entries table */}
      {draftEntries.length > 0 && (
        <WkSurface className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--wk-border)]">
            <h3 className="text-[13px] font-bold text-[var(--wk-text)]">Draft Entries</h3>
            <div className="flex items-center gap-2">
              {csvEntries.length > 0 && <span className="rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-brand)]">{csvEntries.length} CSV</span>}
              {genEntries.length > 0 && <span className="rounded-full bg-[var(--wk-text-faint)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-text-faint)]">{genEntries.length} Generated</span>}
              {manualEntries.length > 0 && <span className="rounded-full bg-[var(--wk-info-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-info)]">{manualEntries.length} Manual</span>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="wk-table min-w-full">
              <thead>
                <tr>
                  <th className="whitespace-nowrap">Rank</th>
                  <th className="whitespace-nowrap">Prev</th>
                  <th className="whitespace-nowrap">Move</th>
                  <th className="whitespace-nowrap">Track</th>
                  <th className="whitespace-nowrap">Source</th>
                  <th className="whitespace-nowrap">Peak</th>
                  <th className="whitespace-nowrap">Wks</th>
                  <th className="whitespace-nowrap">Score</th>
                  <th className="whitespace-nowrap">Detail</th>
                </tr>
              </thead>
              <tbody>
                {enrichedEntries.map((entry) => {
                  const track = entry.entryPayload?.track as Record<string, unknown> | undefined;
                  const prevRank = entry.displayPreviousRank;
                  const movement = entry.displayMovement;
                  const movementAmount = entry.displayMovementAmount;
                  const isNewByRelease = entry.displayMovement === "new" && entry.displayPreviousRank === null;

                  return (
                    <tr key={entry.id} className={entry.sourceType === "csv" ? "bg-[var(--wk-brand-soft)]/10" : ""}>
                      <td className="tabular-nums font-bold text-[var(--wk-text)]">{entry.finalRank}</td>
                      <td className="tabular-nums text-[12px] text-[var(--wk-text-muted)]">
                        {prevRank !== null ? `#${prevRank}` : "—"}
                      </td>
                      <td>
                        <span className={`inline-flex items-center gap-0.5 text-[12px] font-semibold ${
                          movement === "up" ? "text-[var(--wk-success)]" :
                          movement === "down" ? "text-[var(--wk-danger)]" :
                          movement === "new" ? "text-[var(--wk-brand)]" :
                          movement === "re_entry" ? "text-[var(--wk-info)]" :
                          "text-[var(--wk-text-muted)]"
                        }`}>
                          {movement === "up" && (
                            <><i className="ri-arrow-up-line" />{movementAmount && movementAmount > 0 ? ` ${movementAmount}` : ""}</>
                          )}
                          {movement === "down" && (
                            <><i className="ri-arrow-down-line" />{movementAmount && movementAmount > 0 ? ` ${movementAmount}` : ""}</>
                          )}
                          {movement === "new" && "NEW"}
                          {movement === "re_entry" && "RE"}
                          {movement === "same" && (
                            <><i className="ri-subtract-line" />{movementAmount === 0 ? " 0" : ""}</>
                          )}
                        </span>
                      </td>
                      <td className="font-semibold text-[var(--wk-text)]">
                        <span className="truncate max-w-[140px] block">
                          {(track?.normalizedTitle as string) ?? `Entry #${entry.finalRank}`}
                        </span>
                        <span className="text-[11px] text-[var(--wk-text-muted)]">
                          {(track?.normalizedArtistLine as string) ?? ""}
                        </span>
                      </td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                          entry.sourceType === "csv" ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" :
                          entry.sourceType === "manual" ? "bg-[var(--wk-info-soft)] text-[var(--wk-info)]" :
                          "bg-[var(--wk-text-faint)]/10 text-[var(--wk-text-faint)]"
                        }`}>
                          {entry.sourceType === "csv" ? "CSV" : entry.sourceType === "manual" ? "Manual" : "Gen"}
                        </span>
                      </td>
                      <td className="tabular-nums text-[12px] text-[var(--wk-text-muted)]">{entry.peakPosition ?? "—"}</td>
                      <td className="tabular-nums text-[12px] text-[var(--wk-text-muted)]">{entry.weeksOnChart ?? "—"}</td>
                      <td className="tabular-nums text-[12px] font-semibold text-[var(--wk-brand)]">{entry.score.toFixed(1)}</td>
                      <td>
                        <button onClick={() => setSelectedEntry(entry)} className="flex h-6 w-6 items-center justify-center rounded text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]">
                          <i className="ri-eye-line text-xs" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </WkSurface>
      )}

      {/* Entry detail drawer */}
      {selectedEntry && (
        <DraftEntryDrawer entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      )}
    </div>
  );
}

function DraftEntryDrawer({ entry, onClose }: { entry: EnrichedDraftEntry; onClose: () => void }) {
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
          {(track?.artworkUrl as string) && <img src={track!.artworkUrl as string} alt="" className="h-14 w-14 rounded-lg object-cover" />}
          <div>
            <div className="text-[13px] font-bold text-[var(--wk-text)]">{String(track?.normalizedTitle ?? "Unknown")}</div>
            <div className="text-[12px] text-[var(--wk-text-muted)]">{String(track?.normalizedArtistLine ?? "Unknown")}</div>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[
            { label: "Final Rank", value: String(entry.finalRank), color: "text-[var(--wk-brand)]" },
            { label: "Previous Rank", value: entry.displayPreviousRank !== null ? `#${entry.displayPreviousRank}` : "—" },
            { label: "Movement", value: `${entry.displayMovement}${entry.displayMovementAmount && entry.displayMovementAmount > 0 && entry.displayMovement !== "new" ? ` (${entry.displayMovementAmount})` : ""}` },
            { label: "Peak Position", value: String(entry.peakPosition ?? "—") },
            { label: "Weeks on Chart", value: String(entry.weeksOnChart ?? "—") },
            { label: "Score", value: entry.score.toFixed(1) },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border border-[var(--wk-border)] p-3">
              <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">{label}</div>
              <div className={`mt-1 text-[13px] font-semibold ${color ?? "text-[var(--wk-text)]"}`}>{value}</div>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
            entry.sourceType === "csv" ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" :
            entry.sourceType === "manual" ? "bg-[var(--wk-info-soft)] text-[var(--wk-info)]" :
            "bg-[var(--wk-text-faint)]/10 text-[var(--wk-text-faint)]"
          }`}>
            {entry.sourceType === "csv" ? "CSV Import" : entry.sourceType === "manual" ? "Manual Entry" : "Generated"}
          </span>
        </div>
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
      </div>
    </div>
  );
}