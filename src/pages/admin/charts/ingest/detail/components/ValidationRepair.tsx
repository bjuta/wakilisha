/**
 * Validation & Repair — Phase 4
 * Grouped blocking / warnings / metadata-gaps / duplicates / rank-integrity.
 * Inline repair where possible.
 */
import { useState } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestCandidate, ReviewIssue, DiscoveredCsvSource, CsvImportSession } from "@/services/chartsIngestion/types";
import { resolveReviewIssue, normalizeCsvCandidates, hasCapability } from "@/services/chartsIngestion/client";
import type { UserRole } from "@/services/chartsIngestion/client";

interface ValidationRepairProps {
  jobId: string;
  discoveredCsvs: DiscoveredCsvSource[];
  candidates: IngestCandidate[];
  issues: ReviewIssue[];
  importSessions: CsvImportSession[];
  onUpdate: () => void;
  role?: UserRole;
}

type IssueGroup = "blocking" | "warnings" | "metadata_gaps" | "duplicates" | "rank_integrity";

const GROUP_CONFIG: Record<IssueGroup, { label: string; icon: string; color: string; bg: string }> = {
  blocking: { label: "Blocking Issues", icon: "ri-error-warning-line", color: "text-[var(--wk-danger)]", bg: "bg-[var(--wk-danger-soft)]" },
  warnings: { label: "Warnings", icon: "ri-alert-line", color: "text-[var(--wk-warning)]", bg: "bg-[var(--wk-warning-soft)]" },
  metadata_gaps: { label: "Metadata Gaps", icon: "ri-information-line", color: "text-[var(--wk-info)]", bg: "bg-[var(--wk-info-soft)]" },
  duplicates: { label: "Duplicates", icon: "ri-file-copy-line", color: "text-[var(--wk-warning)]", bg: "bg-[var(--wk-warning-soft)]" },
  rank_integrity: { label: "Rank Integrity", icon: "ri-bar-chart-grouped-line", color: "text-[var(--wk-danger)]", bg: "bg-[var(--wk-danger-soft)]" },
};

function classifyIssue(issue: ReviewIssue): IssueGroup {
  if (issue.blocking) return "blocking";
  if (issue.issueType === "duplicate_rank" || issue.issueType === "duplicate_track") return "duplicates";
  if (issue.issueType === "missing_title" || issue.issueType === "missing_artist") return "rank_integrity";
  if (issue.severity === "high") return "blocking";
  if (issue.issueType === "missing_artwork" || issue.issueType === "missing_source_url") return "metadata_gaps";
  return "warnings";
}

export function ValidationRepair({
  jobId,
  discoveredCsvs,
  candidates,
  issues,
  importSessions,
  onUpdate,
  role = "admin",
}: ValidationRepairProps) {
  const [normalizingId, setNormalizingId] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const canResolve = hasCapability(role, "resolve_issues");

  const csvCandidates = candidates.filter((c) => c.sourceType === "csv");
  const csvIssues = issues.filter((i) => i.message.startsWith("CSV") || i.candidateId === null);
  const allGroupedIssues: Record<IssueGroup, ReviewIssue[]> = {
    blocking: [],
    warnings: [],
    metadata_gaps: [],
    duplicates: [],
    rank_integrity: [],
  };
  for (const issue of issues.filter((i) => i.status === "open")) {
    allGroupedIssues[classifyIssue(issue)].push(issue);
  }

  const blockingFromCsvs: { label: string; value: string; severity: "error" | "warning" }[] = [];
  for (const csv of discoveredCsvs) {
    for (const v of csv.validationIssues) {
      blockingFromCsvs.push({ label: csv.filename, value: v, severity: csv.validationStatus === "errors" ? "error" : "warning" });
    }
  }

  const handleResolve = async (issueId: string) => {
    await resolveReviewIssue(jobId, issueId, { resolution: "resolve", note: resolutionNote || "Resolved during validation" });
    setResolving(null);
    setResolutionNote("");
    onUpdate();
  };

  const handleIgnore = async (issueId: string) => {
    await resolveReviewIssue(jobId, issueId, { resolution: "ignore", note: "Ignored during validation" });
    onUpdate();
  };

  const handleReNormalize = async (csv: DiscoveredCsvSource) => {
    if (!hasCapability(role, "fetch_sources")) return;
    setNormalizingId(csv.id);
    await normalizeCsvCandidates(jobId, csv.id);
    setNormalizingId(null);
    onUpdate();
  };

  const totalBlockers = allGroupedIssues.blocking.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Validation & Repair</h2>
          <p className="mt-0.5 text-[11px] text-[var(--wk-text-muted)]">
            Inspect and fix validation issues before candidate creation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalBlockers > 0 && (
            <span className="rounded-full bg-[var(--wk-danger-soft)] px-3 py-1 text-[11px] font-bold text-[var(--wk-danger)]">
              {totalBlockers} Blocking
            </span>
          )}
        </div>
      </div>

      {/* CSV-level Validation Issues */}
      {blockingFromCsvs.length > 0 && (
        <WkSurface className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <i className="ri-file-list-line text-[var(--wk-brand)]" />
            <h3 className="text-[13px] font-bold text-[var(--wk-text)]">CSV Source Validation Issues</h3>
            <span className="rounded-full bg-[var(--wk-warning-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-warning)]">
              {blockingFromCsvs.length}
            </span>
          </div>
          <div className="space-y-2">
            {blockingFromCsvs.map((item, i) => (
              <div key={i} className={`flex items-start gap-2 rounded-lg border-l-2 p-2 ${
                item.severity === "error"
                  ? "border-l-[var(--wk-danger)] bg-[var(--wk-danger-soft)]"
                  : "border-l-[var(--wk-warning)] bg-[var(--wk-warning-soft)]"
              }`}>
                <i className={`mt-0.5 text-sm ${item.severity === "error" ? "ri-error-warning-line text-[var(--wk-danger)]" : "ri-alert-line text-[var(--wk-warning)]"}`} />
                <div>
                  <div className="text-[11px] font-semibold text-[var(--wk-text)]">{item.label}</div>
                  <div className="text-[10px] text-[var(--wk-text-soft)]">{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </WkSurface>
      )}

      {/* Per-group issues */}
      {(["blocking", "duplicates", "rank_integrity", "warnings", "metadata_gaps"] as IssueGroup[]).map((group) => {
        const groupIssues = allGroupedIssues[group];
        if (groupIssues.length === 0) return null;
        const cfg = GROUP_CONFIG[group];
        return (
          <WkSurface key={group} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <i className={`${cfg.icon} ${cfg.color}`} />
              <h3 className="text-[13px] font-bold text-[var(--wk-text)]">{cfg.label}</h3>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
                {groupIssues.length}
              </span>
            </div>
            <div className="space-y-2">
              {groupIssues.map((issue) => (
                <div key={issue.id} className={`rounded-lg border-l-2 p-3 ${
                  group === "blocking" || group === "rank_integrity"
                    ? "border-l-[var(--wk-danger)] bg-[var(--wk-danger-soft)]"
                    : group === "warnings" || group === "duplicates"
                      ? "border-l-[var(--wk-warning)] bg-[var(--wk-warning-soft)]"
                      : "border-l-[var(--wk-info)] bg-[var(--wk-info-soft)]"
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="text-[12px] font-semibold text-[var(--wk-text)]">{issue.issueType.replace(/_/g, " ")}</div>
                      <div className="text-[11px] text-[var(--wk-text-soft)]">{issue.message}</div>
                    </div>
                    <div className="flex gap-1">
                      {resolving === issue.id ? (
                        <div className="mt-1 flex flex-col gap-1">
                          <textarea
                            value={resolutionNote}
                            onChange={(e) => setResolutionNote(e.target.value)}
                            placeholder="Resolution note..."
                            maxLength={500}
                            rows={2}
                            className="rounded border border-[var(--wk-border)] bg-[var(--wk-bg)] p-1.5 text-[11px] text-[var(--wk-text)] outline-none"
                          />
                          <div className="flex gap-1">
                            <button onClick={() => handleResolve(issue.id)} className="wk-button wk-button-sm wk-button-primary text-[10px]">
                              <i className="ri-check-line" /> Resolve
                            </button>
                            <button onClick={() => setResolving(null)} className="wk-button wk-button-sm wk-button-ghost text-[10px]">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {canResolve && (
                            <button
                              onClick={() => setResolving(issue.id)}
                              className="flex h-6 items-center justify-center rounded-md px-2 text-[10px] text-[var(--wk-success)] hover:bg-[var(--wk-success-soft)]"
                              title="Resolve"
                            >
                              <i className="ri-check-line mr-1" />Resolve
                            </button>
                          )}
                          <button
                            onClick={() => handleIgnore(issue.id)}
                            className="flex h-6 items-center justify-center rounded-md px-2 text-[10px] text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
                            title="Ignore"
                          >
                            <i className="ri-eye-off-line mr-1" />Ignore
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </WkSurface>
        );
      })}

      {/* Re-normalize CSVs */}
      {discoveredCsvs.length > 0 && (
        <WkSurface className="p-4">
          <h3 className="mb-3 text-[13px] font-bold text-[var(--wk-text)]">Re-run Normalization</h3>
          <p className="mb-3 text-[11px] text-[var(--wk-text-muted)]">
            After fixing mapping issues, re-normalize the CSV to refresh candidates.
          </p>
          <div className="flex flex-wrap gap-2">
            {discoveredCsvs.map((csv) => (
              <button
                key={csv.id}
                onClick={() => handleReNormalize(csv)}
                disabled={normalizingId === csv.id}
                className={`wk-button wk-button-sm wk-button-ghost whitespace-nowrap ${normalizingId === csv.id ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {normalizingId === csv.id ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-sparkling-line" />}
                {normalizingId === csv.id ? "Normalizing..." : `Re-normalize ${csv.filename}`}
              </button>
            ))}
          </div>
        </WkSurface>
      )}

      {/* No issues state */}
      {Object.values(allGroupedIssues).every((g) => g.length === 0) && blockingFromCsvs.length === 0 && (
        <WkSurface className="p-8 text-center">
          <div className="flex justify-center mb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-success-soft)] text-[var(--wk-success)]">
              <i className="ri-shield-check-line text-xl" />
            </div>
          </div>
          <div className="text-[13px] font-bold text-[var(--wk-success)]">No validation issues found</div>
          <div className="mt-1 text-[12px] text-[var(--wk-text-muted)]">
            {csvCandidates.length > 0
              ? `${csvCandidates.length} CSV candidates are ready for ranking.`
              : "No candidates normalized yet. Return to Import Workspace to normalize a CSV."}
          </div>
        </WkSurface>
      )}
    </div>
  );
}