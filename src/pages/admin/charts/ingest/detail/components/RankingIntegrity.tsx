/**
 * Ranking Integrity — Phase 6
 * Chart-specific rank editor. Duplicate detection, gap detection,
 * out-of-range, duplicate title+artist, overrides, locked rows.
 */
import { useState, useMemo } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestJob, IngestCandidate } from "@/services/chartsIngestion/types";
import { applyRankOverride, clearRankOverride, hasCapability } from "@/services/chartsIngestion/client";
import type { UserRole } from "@/services/chartsIngestion/client";

interface RankingIntegrityProps {
  jobId: string;
  job: IngestJob;
  candidates: IngestCandidate[];
  onUpdate: () => void;
  role?: UserRole;
}

interface IntegrityIssue {
  type: string;
  rank?: number;
  message: string;
  severity: "error" | "warning";
  candidateIds: string[];
}

function analyzeRanks(candidates: IngestCandidate[], chartSize: number): IntegrityIssue[] {
  const active = candidates.filter((c) => c.status !== "excluded");
  const issues: IntegrityIssue[] = [];

  const rankMap = new Map<number, IngestCandidate[]>();
  for (const c of active) {
    const rank = c.finalRank ?? c.calculatedRank;
    if (!rankMap.has(rank)) rankMap.set(rank, []);
    rankMap.get(rank)!.push(c);
  }

  // Duplicate ranks
  for (const [rank, cs] of rankMap.entries()) {
    if (cs.length > 1) {
      issues.push({ type: "duplicate_rank", rank, message: `Rank ${rank} assigned to ${cs.length} tracks: ${cs.map((c) => c.normalizedTitle).join(", ")}`, severity: "error", candidateIds: cs.map((c) => c.id) });
    }
  }

  // Missing ranks (gaps)
  const ranks = Array.from(rankMap.keys()).sort((a, b) => a - b);
  if (ranks.length > 0) {
    const min = ranks[0];
    const max = ranks[ranks.length - 1];
    for (let r = min; r <= max; r++) {
      if (!rankMap.has(r)) {
        issues.push({ type: "rank_gap", rank: r, message: `Rank ${r} is missing (gap in sequence)`, severity: "warning", candidateIds: [] });
      }
    }
  }

  // Rank below 1
  for (const c of active) {
    const rank = c.finalRank ?? c.calculatedRank;
    if (rank < 1) {
      issues.push({ type: "rank_below_1", rank, message: `"${c.normalizedTitle}" has rank ${rank} (below 1)`, severity: "error", candidateIds: [c.id] });
    }
  }

  // Rank above chart size
  for (const c of active) {
    const rank = c.finalRank ?? c.calculatedRank;
    if (rank > chartSize) {
      issues.push({ type: "rank_exceeds_size", rank, message: `"${c.normalizedTitle}" rank ${rank} exceeds chart size ${chartSize}`, severity: "warning", candidateIds: [c.id] });
    }
  }

  // Duplicate title + artist
  const titleArtistMap = new Map<string, IngestCandidate[]>();
  for (const c of active) {
    const key = `${c.normalizedTitle.toLowerCase()}|${c.normalizedArtistLine.toLowerCase()}`;
    if (!titleArtistMap.has(key)) titleArtistMap.set(key, []);
    titleArtistMap.get(key)!.push(c);
  }
  for (const [, cs] of titleArtistMap.entries()) {
    if (cs.length > 1) {
      issues.push({ type: "duplicate_title_artist", message: `"${cs[0].normalizedTitle}" by "${cs[0].normalizedArtistLine}" appears ${cs.length} times`, severity: "error", candidateIds: cs.map((c) => c.id) });
    }
  }

  return issues;
}

export function RankingIntegrity({
  jobId,
  job,
  candidates,
  onUpdate,
  role = "admin",
}: RankingIntegrityProps) {
  const [overrideInputs, setOverrideInputs] = useState<Record<string, string>>({});
  const [lockedRows, setLockedRows] = useState<Set<string>>(new Set());
  const [detailCandidate, setDetailCandidate] = useState<IngestCandidate | null>(null);
  const canOverride = hasCapability(role, "apply_rank_override");

  const sorted = useMemo(() =>
    [...candidates]
      .filter((c) => c.status !== "excluded")
      .sort((a, b) => {
        const rankA = a.finalRank ?? a.calculatedRank;
        const rankB = b.finalRank ?? b.calculatedRank;
        return rankA - rankB;
      }),
    [candidates]
  );

  const issues = useMemo(() => analyzeRanks(candidates, job.chartSize), [candidates, job.chartSize]);
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  const highlightedIds = new Set(issues.flatMap((i) => i.candidateIds));

  const handleApplyOverride = async (candidateId: string) => {
    const rank = parseInt(overrideInputs[candidateId], 10);
    if (isNaN(rank) || rank < 1) return;
    await applyRankOverride(jobId, candidateId, { rank, reason: "Manual rank override" });
    setOverrideInputs((prev) => ({ ...prev, [candidateId]: "" }));
    onUpdate();
  };

  const handleClearOverride = async (candidateId: string) => {
    await clearRankOverride(jobId, candidateId);
    onUpdate();
  };

  const toggleLock = (id: string) => {
    setLockedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Ranking Integrity</h2>
          <p className="mt-0.5 text-[11px] text-[var(--wk-text-muted)]">
            {sorted.length} active candidates — {sorted.filter((c) => c.sourceType === "csv").length} from CSV — Target: {job.chartSize}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {errors.length > 0 && (
            <span className="rounded-full bg-[var(--wk-danger-soft)] px-3 py-1 text-[11px] font-bold text-[var(--wk-danger)]">
              {errors.length} errors
            </span>
          )}
          {warnings.length > 0 && (
            <span className="rounded-full bg-[var(--wk-warning-soft)] px-3 py-1 text-[11px] font-bold text-[var(--wk-warning)]">
              {warnings.length} warnings
            </span>
          )}
        </div>
      </div>

      {/* Issues summary */}
      {issues.length > 0 && (
        <WkSurface className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <i className="ri-bar-chart-grouped-line text-[var(--wk-text)]" />
            <h3 className="text-[13px] font-bold text-[var(--wk-text)]">Integrity Issues</h3>
          </div>
          <div className="space-y-2">
            {issues.map((issue, i) => (
              <div key={i} className={`flex items-start gap-2 rounded-lg border-l-2 p-2 ${
                issue.severity === "error"
                  ? "border-l-[var(--wk-danger)] bg-[var(--wk-danger-soft)]"
                  : "border-l-[var(--wk-warning)] bg-[var(--wk-warning-soft)]"
              }`}>
                <i className={`mt-0.5 text-sm ${issue.severity === "error" ? "ri-error-warning-line text-[var(--wk-danger)]" : "ri-alert-line text-[var(--wk-warning)]"}`} />
                <div>
                  <div className="text-[11px] font-semibold text-[var(--wk-text)]">{issue.type.replace(/_/g, " ")}</div>
                  <div className="text-[10px] text-[var(--wk-text-soft)]">{issue.message}</div>
                </div>
              </div>
            ))}
          </div>
        </WkSurface>
      )}

      {issues.length === 0 && (
        <div className="rounded-xl border border-[var(--wk-success)] bg-[var(--wk-success-soft)] p-4">
          <div className="flex items-center gap-2">
            <i className="ri-shield-check-line text-[var(--wk-success)]" />
            <span className="text-[13px] font-semibold text-[var(--wk-success)]">Ranking is clean — no integrity issues</span>
          </div>
        </div>
      )}

      {/* Rank sequence table */}
      <WkSurface className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--wk-border)]">
          <h3 className="text-[13px] font-bold text-[var(--wk-text)]">Rank Sequence</h3>
          <div className="flex items-center gap-3 text-[11px] text-[var(--wk-text-muted)]">
            <span>{sorted.filter((c) => c.manualRankOverride !== null).length} manual overrides</span>
            <span>·</span>
            <span>{lockedRows.size} locked rows</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="wk-table min-w-full">
            <thead>
              <tr>
                <th className="whitespace-nowrap">Rank</th>
                <th className="whitespace-nowrap">Calc Rank</th>
                <th className="whitespace-nowrap">Track</th>
                <th className="whitespace-nowrap">Artist</th>
                <th className="whitespace-nowrap">Source</th>
                <th className="whitespace-nowrap">Score</th>
                <th className="whitespace-nowrap">CSV#</th>
                <th className="whitespace-nowrap">Override</th>
                <th className="whitespace-nowrap">Lock</th>
                <th className="whitespace-nowrap">Detail</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const hasOverride = c.manualRankOverride !== null;
                const isLocked = lockedRows.has(c.id);
                const hasCsvSource = c.sourceType === "csv";
                const csvPosition = c.sourcePositions.csv;
                const isHighlighted = highlightedIds.has(c.id);
                return (
                  <tr key={c.id} className={
                    isHighlighted
                      ? "bg-[var(--wk-danger-soft)]/30"
                      : hasOverride
                        ? "bg-[var(--wk-warning-soft)]/30"
                        : hasCsvSource
                          ? "bg-[var(--wk-brand-soft)]/10"
                          : ""
                  }>
                    <td className={`tabular-nums font-bold ${hasOverride ? "text-[var(--wk-warning)]" : isHighlighted ? "text-[var(--wk-danger)]" : "text-[var(--wk-text)]"}`}>
                      {c.finalRank ?? c.calculatedRank}
                      {isHighlighted && <i className="ri-error-warning-line ml-1 text-[10px]" />}
                    </td>
                    <td className="tabular-nums text-[12px] text-[var(--wk-text-muted)]">{c.calculatedRank}</td>
                    <td className="font-semibold text-[var(--wk-text)]">
                      <span className="truncate max-w-[140px] block">{c.normalizedTitle}</span>
                    </td>
                    <td className="text-[12px] text-[var(--wk-text-soft)]">{c.normalizedArtistLine}</td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        c.sourceType === "csv" ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" :
                        "bg-[var(--wk-text-faint)]/10 text-[var(--wk-text-faint)]"
                      }`}>
                        {c.sourceType ?? "gen"}
                      </span>
                    </td>
                    <td className="tabular-nums text-[12px] font-semibold text-[var(--wk-brand)]">{c.score.toFixed(1)}</td>
                    <td className="tabular-nums text-[12px] text-[var(--wk-text-muted)]">
                      {hasCsvSource && csvPosition !== undefined ? (
                        <span className="rounded-full bg-[var(--wk-brand-soft)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--wk-brand)]">
                          #{csvPosition}
                        </span>
                      ) : "—"}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        {hasOverride ? (
                          <>
                            <span className="text-[10px] text-[var(--wk-warning)]">{c.manualRankOverride}</span>
                            <button
                              onClick={() => handleClearOverride(c.id)}
                              className="flex h-6 w-6 items-center justify-center rounded text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
                              title="Clear override"
                            >
                              <i className="ri-close-line text-xs" />
                            </button>
                          </>
                        ) : (
                          <>
                            <input
                              type="number"
                              value={overrideInputs[c.id] ?? ""}
                              onChange={(e) => setOverrideInputs((p) => ({ ...p, [c.id]: e.target.value }))}
                              placeholder="Rank"
                              disabled={isLocked || !canOverride}
                              className="w-12 rounded border border-[var(--wk-border)] bg-[var(--wk-bg)] px-1 py-0.5 text-[10px] text-[var(--wk-text)] text-center"
                            />
                            <button
                              onClick={() => handleApplyOverride(c.id)}
                              disabled={isLocked || !canOverride || !overrideInputs[c.id]}
                              className="flex h-6 w-6 items-center justify-center rounded text-[var(--wk-brand)] hover:bg-[var(--wk-brand-soft)] disabled:opacity-30"
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
                        title={isLocked ? "Unlock row" : "Lock row"}
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

      {/* Detail drawer */}
      {detailCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-[var(--wk-surface)] p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[var(--wk-text)]">Rank Provenance</h3>
              <button onClick={() => setDetailCandidate(null)} className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]">
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="mt-4">
              <div className="text-[13px] font-bold text-[var(--wk-text)]">{detailCandidate.normalizedTitle}</div>
              <div className="text-[12px] text-[var(--wk-text-muted)]">{detailCandidate.normalizedArtistLine}</div>
            </div>
            <div className="mt-4 space-y-1.5">
              {Object.entries(detailCandidate.sourcePositions).map(([src, pos]) => (
                <div key={src} className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] p-2.5">
                  <span className="text-[12px] font-semibold text-[var(--wk-text)]">{src}</span>
                  <span className="text-[12px] text-[var(--wk-text-muted)]">Position {pos}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-2 grid-cols-2">
              {[
                { label: "Calculated Rank", value: detailCandidate.calculatedRank },
                { label: "Final Rank", value: detailCandidate.finalRank ?? detailCandidate.calculatedRank },
                { label: "Manual Override", value: detailCandidate.manualRankOverride ?? "—" },
                { label: "Score", value: detailCandidate.score.toFixed(1) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-[var(--wk-border)] p-3">
                  <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">{label}</div>
                  <div className="mt-1 text-[13px] font-semibold text-[var(--wk-text)]">{String(value)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}