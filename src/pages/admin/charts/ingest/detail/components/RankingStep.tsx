import { useState } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkTag } from "@/components/design-system/primitives/Tag";
import type { IngestCandidate } from "@/services/chartsIngestion/types";
import { applyRankOverride, clearRankOverride, hasCapability, getDisabledReason } from "@/services/chartsIngestion/client";
import type { UserRole } from "@/services/chartsIngestion/client";

interface RankingStepProps {
  jobId: string;
  candidates: IngestCandidate[];
  onUpdate: () => void;
  role?: UserRole;
}

export function RankingStep({ jobId, candidates, onUpdate, role = "admin" }: RankingStepProps) {
  const [overrideRank, setOverrideRank] = useState<Record<string, string>>();
  const [lockedRows, setLockedRows] = useState<Set<string>>(new Set());
  const [detailCandidate, setDetailCandidate] = useState<IngestCandidate | null>(null);

  const canOverride = hasCapability(role, "apply_rank_override");

  const sorted = [...candidates]
    .filter((c) => c.status !== "excluded")
    .sort((a, b) => {
      const rankA = a.manualRankOverride ?? a.calculatedRank;
      const rankB = b.manualRankOverride ?? b.calculatedRank;
      return rankA - rankB;
    });

  const handleApplyOverride = async (candidateId: string) => {
    const rank = parseInt(overrideRank[candidateId], 10);
    if (isNaN(rank) || rank < 1) return;
    await applyRankOverride(jobId, candidateId, { rank, reason: "Manual admin override" });
    setOverrideRank((prev) => ({ ...prev, [candidateId]: "" }));
    onUpdate();
  };

  const handleClearOverride = async (candidateId: string) => {
    await clearRankOverride(jobId, candidateId);
    onUpdate();
  };

  const toggleLock = (candidateId: string) => {
    setLockedRows((prev) => {
      const next = new Set(prev);
      if (next.has(candidateId)) {
        next.delete(candidateId);
      } else {
        next.add(candidateId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Ranking Preview</h2>
        <div className="flex items-center gap-2">
          <WkTag variant="brand">{sorted.length} candidates</WkTag>
          <WkTag>{sorted.filter((c) => c.manualRankOverride !== null).length} overrides</WkTag>
        </div>
      </div>

      <WkSurface className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="wk-table min-w-full">
            <thead>
              <tr>
                <th className="whitespace-nowrap">Calc Rank</th>
                <th className="whitespace-nowrap">Final Rank</th>
                <th className="whitespace-nowrap">Track</th>
                <th className="whitespace-nowrap">Artist</th>
                <th className="whitespace-nowrap">Spotify</th>
                <th className="whitespace-nowrap">Apple</th>
                <th className="whitespace-nowrap">YouTube</th>
                <th className="whitespace-nowrap">Airplay</th>
                <th className="whitespace-nowrap">Total</th>
                <th className="whitespace-nowrap">Override</th>
                <th className="whitespace-nowrap">Lock</th>
                <th className="whitespace-nowrap">Detail</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 40).map((c) => {
                const hasOverride = c.manualRankOverride !== null;
                const isLocked = lockedRows.has(c.id);
                const csvPosition = c.sourcePositions.csv;
                const hasCsvSource = csvPosition !== undefined;
                return (
                  <tr key={c.id} className={hasOverride ? "bg-[var(--wk-warning-soft)]/30" : hasCsvSource ? "bg-[var(--wk-brand-soft)]/10" : ""}>
                    <td className="tabular-nums text-[12px] text-[var(--wk-text-muted)]">{c.calculatedRank}</td>
                    <td className={`tabular-nums font-bold ${hasOverride ? "text-[var(--wk-warning)]" : "text-[var(--wk-text)]"}`}>
                      {c.finalRank ?? c.calculatedRank}
                    </td>
                    <td className="font-semibold text-[var(--wk-text)]">
                      <span>{c.normalizedTitle}</span>
                      {hasCsvSource && (
                        <span className="ml-1.5 rounded-full bg-[var(--wk-brand-soft)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--wk-brand)]">
                          CSV#{csvPosition}
                        </span>
                      )}
                    </td>
                    <td className="text-[12px] text-[var(--wk-text-soft)]">{c.normalizedArtistLine}</td>
                    <td className="tabular-nums text-[12px] text-[var(--wk-text-soft)]">{(c.sourceMetrics.spotify ?? 0).toLocaleString()}</td>
                    <td className="tabular-nums text-[12px] text-[var(--wk-text-soft)]">{(c.sourceMetrics.apple ?? 0).toLocaleString()}</td>
                    <td className="tabular-nums text-[12px] text-[var(--wk-text-soft)]">{(c.sourceMetrics.youtube ?? 0).toLocaleString()}</td>
                    <td className="tabular-nums text-[12px] text-[var(--wk-text-soft)]">{(c.sourceMetrics.airplay ?? 0).toLocaleString()}</td>
                    <td className="tabular-nums text-[12px] font-bold text-[var(--wk-brand)]">{c.score.toFixed(1)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        {hasOverride ? (
                          <>
                            <span className="text-[10px] text-[var(--wk-warning)]">{c.manualRankOverride}</span>
                            <button
                              onClick={() => handleClearOverride(c.id)}
                              className="flex h-6 w-6 items-center justify-center rounded text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
                            >
                              <i className="ri-close-line text-xs" />
                            </button>
                          </>
                        ) : (
                          <>
                            <input
                              type="number"
                              value={overrideRank[c.id] ?? ""}
                              onChange={(e) => setOverrideRank((prev) => ({ ...prev, [c.id]: e.target.value }))}
                              placeholder="Rank"
                              className="w-12 rounded border border-[var(--wk-border)] bg-[var(--wk-bg)] px-1 py-0.5 text-[10px] text-[var(--wk-text)] text-center"
                            />
                            <button
                              onClick={() => handleApplyOverride(c.id)}
                              className="flex h-6 w-6 items-center justify-center rounded text-[var(--wk-brand)] hover:bg-[var(--wk-brand-soft)]"
                            >
                              <i className="ri-check-line text-xs" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={() => toggleLock(c.id)}
                        className={`flex h-6 w-6 items-center justify-center rounded ${isLocked ? "text-[var(--wk-brand)] bg-[var(--wk-brand-soft)]" : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"}`}
                      >
                        <i className={`${isLocked ? "ri-lock-line" : "ri-lock-unlock-line"} text-xs`} />
                      </button>
                    </td>
                    <td>
                      <button
                        onClick={() => setDetailCandidate(c)}
                        className="flex h-6 w-6 items-center justify-center rounded text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
                      >
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

      {/* Provenance Detail Drawer */}
      {detailCandidate && (
        <RankingProvenanceDrawer
          candidate={detailCandidate}
          onClose={() => setDetailCandidate(null)}
        />
      )}
    </div>
  );
}

function RankingProvenanceDrawer({ candidate, onClose }: {
  candidate: IngestCandidate;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-[var(--wk-surface)] p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-[var(--wk-text)]">Rank Provenance</h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]">
            <i className="ri-close-line" />
          </button>
        </div>

        <div className="mt-4">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">{candidate.normalizedTitle}</div>
          <div className="text-[12px] text-[var(--wk-text-muted)]">{candidate.normalizedArtistLine}</div>
        </div>

        {/* Source Appearances */}
        <div className="mt-4">
          <h4 className="mb-2 text-[12px] font-bold text-[var(--wk-text)]">Source Appearances</h4>
          <div className="space-y-1.5">
            {Object.entries(candidate.sourcePositions).map(([source, position]) => (
              <div key={source} className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] p-2.5">
                <div className="flex items-center gap-2">
                  <i className="ri-database-2-line text-[var(--wk-brand)]" />
                  <span className="text-[12px] font-semibold text-[var(--wk-text)]">{source.charAt(0).toUpperCase() + source.slice(1)}</span>
                </div>
                <span className="text-[12px] text-[var(--wk-text-muted)]">Position {position}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="mt-4">
          <h4 className="mb-2 text-[12px] font-bold text-[var(--wk-text)]">Score Breakdown</h4>
          <div className="space-y-1.5">
            <ScoreRow label="Spotify" value={candidate.sourceMetrics.spotify ?? 0} total={candidate.score} />
            <ScoreRow label="Apple" value={candidate.sourceMetrics.apple ?? 0} total={candidate.score} />
            <ScoreRow label="YouTube" value={candidate.sourceMetrics.youtube ?? 0} total={candidate.score} />
            <ScoreRow label="Airplay" value={candidate.sourceMetrics.airplay ?? 0} total={candidate.score} />
            <div className="border-t border-[var(--wk-border)] pt-1.5">
              <div className="flex items-center justify-between text-[12px] font-bold text-[var(--wk-brand)]">
                <span>Total Score</span>
                <span className="tabular-nums">{candidate.score.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Raw References */}
        <div className="mt-4">
          <h4 className="mb-2 text-[12px] font-bold text-[var(--wk-text)]">Raw References</h4>
          <div className="space-y-1 text-[11px] text-[var(--wk-text-muted)]">
            <div className="flex items-center justify-between">
              <span>Raw Item IDs</span>
              <span className="font-mono text-[var(--wk-text)]">{candidate.rawItemIds.length} items</span>
            </div>
            <div className="flex items-center justify-between">
              <span>ISRC</span>
              <span className="font-mono text-[var(--wk-text)]">{candidate.isrc ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Candidate Hash</span>
              <span className="font-mono text-[var(--wk-text-faint)]">{candidate.candidateHash.slice(0, 16)}...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreRow({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-[11px] text-[var(--wk-text-muted)]">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-[var(--wk-bg-subtle)] overflow-hidden">
        <div className="h-full rounded-full bg-[var(--wk-brand)]" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 text-right text-[11px] font-semibold tabular-nums text-[var(--wk-text)]">{value.toLocaleString()}</span>
    </div>
  );
}