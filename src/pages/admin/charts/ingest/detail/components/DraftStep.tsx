import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkTag } from "@/components/design-system/primitives/Tag";
import type { IngestJob, DraftEntry } from "@/services/chartsIngestion/types";
import { createDraftEdition, hasCapability, getDisabledReason } from "@/services/chartsIngestion/client";
import type { UserRole } from "@/services/chartsIngestion/client";

interface DraftStepProps {
  jobId: string;
  job: IngestJob;
  draftEntries: DraftEntry[];
  hasBlockingIssues: boolean;
  hasUnresolvedMatches: boolean;
  onUpdate: () => void;
  role?: UserRole;
}

export function DraftStep({ jobId, job, draftEntries, hasBlockingIssues, hasUnresolvedMatches, onUpdate, role = "admin" }: DraftStepProps) {
  const canCreateDraft = hasCapability(role, "create_draft");
  const handleCreateDraft = async () => {
    if (!canCreateDraft) return;
    await createDraftEdition(jobId);
    onUpdate();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Draft Edition</h2>
        <div className="flex items-center gap-2">
          <WkTag variant="brand">{draftEntries.length} entries</WkTag>
          <WkTag>{job.chartSize} target</WkTag>
        </div>
      </div>

      {/* Create Draft Action */}
      {draftEntries.length === 0 && (
        <WkSurface className="p-5">
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
              <i className="ri-draft-line text-xl" />
            </div>
            <div className="text-center">
              <div className="text-[14px] font-bold text-[var(--wk-text)]">No draft edition created yet</div>
              <div className="mt-1 text-[12px] text-[var(--wk-text-muted)]">
                Create a draft from the ranked candidates to continue.
              </div>
            </div>
            <button
              onClick={handleCreateDraft}
              disabled={hasBlockingIssues || hasUnresolvedMatches}
              className={`wk-button whitespace-nowrap ${
                hasBlockingIssues || hasUnresolvedMatches
                  ? "wk-button-danger cursor-not-allowed"
                  : "wk-button-primary"
              }`}
            >
              <i className="ri-add-line" />
              Create Draft Edition
            </button>
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
          <div className="overflow-x-auto">
            <table className="wk-table min-w-full">
              <thead>
                <tr>
                  <th className="whitespace-nowrap">Rank</th>
                  <th className="whitespace-nowrap">Previous</th>
                  <th className="whitespace-nowrap">Movement</th>
                  <th className="whitespace-nowrap">Track</th>
                  <th className="whitespace-nowrap">Peak</th>
                  <th className="whitespace-nowrap">Weeks</th>
                  <th className="whitespace-nowrap">Score</th>
                  <th className="whitespace-nowrap">Locked</th>
                </tr>
              </thead>
              <tbody>
                {draftEntries.map((entry) => (
                  <tr key={entry.id}>
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
                    <td className="font-semibold text-[var(--wk-text)]">Entry #{entry.finalRank}</td>
                    <td className="tabular-nums text-[12px] text-[var(--wk-text-muted)]">{entry.peakPosition ?? "—"}</td>
                    <td className="tabular-nums text-[12px] text-[var(--wk-text-muted)]">{entry.weeksOnChart ?? "—"}</td>
                    <td className="tabular-nums text-[12px] font-semibold text-[var(--wk-brand)]">{entry.score.toFixed(1)}</td>
                    <td>
                      <span className={`text-[10px] ${entry.locked ? "text-[var(--wk-brand)]" : "text-[var(--wk-text-faint)]"}`}>
                        <i className={entry.locked ? "ri-lock-line" : "ri-lock-unlock-line"} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WkSurface>
      )}
    </div>
  );
}