/**
 * PhaseNav — horizontal navigation bar for the 9 ingestion phases.
 * Dense, serious, color-coded: red=blockers, amber=review, green=ready, blue=info.
 */

import type { IngestJob, IngestCandidate, ReviewIssue, DraftEntry, DiscoveredCsvSource, CsvImportSession } from "@/services/chartsIngestion/types";

interface PhaseNavProps {
  phases: { id: string; label: string; icon: string }[];
  activePhase: number;
  onPhaseChange: (phase: number) => void;
  job: IngestJob;
  summary: {
    totalSources: number;
    totalCandidates: number;
    hasBlockingIssues: boolean;
    hasUnresolvedMatches: boolean;
    hasDraft: boolean;
  };
  candidates: IngestCandidate[];
  issues: ReviewIssue[];
  draftEntries: DraftEntry[];
  discoveredCsvs: DiscoveredCsvSource[];
  importSessions: CsvImportSession[];
}

export function PhaseNav({
  phases,
  activePhase,
  onPhaseChange,
  job,
  summary,
  candidates,
  issues,
  draftEntries,
  discoveredCsvs,
  importSessions,
}: PhaseNavProps) {
  const csvCandidates = candidates.filter((c) => c.sourceType === "csv");

  const getPhaseStatus = (index: number): { status: "ready" | "active" | "blocked" | "warning" | "empty"; count?: number } => {
    switch (index) {
      case 0: {
        const ready = discoveredCsvs.length > 0;
        return { status: activePhase === 0 ? "active" : ready ? "ready" : "empty", count: discoveredCsvs.length };
      }
      case 1: {
        const hasCsv = importSessions.length > 0 || discoveredCsvs.some((d) => d.usedAsSource);
        return { status: activePhase === 1 ? "active" : hasCsv ? "ready" : "empty", count: importSessions.length };
      }
      case 2: {
        const hasEdition = job.editionId !== null && job.editionSlug !== null;
        return { status: activePhase === 2 ? "active" : hasEdition ? "ready" : "empty" };
      }
      case 3: {
        const hasMapped = discoveredCsvs.some((d) => d.mappingStatus === "mapped" || d.mappingStatus === "partial");
        return { status: activePhase === 3 ? "active" : hasMapped ? "ready" : "empty" };
      }
      case 4: {
        const csvIssues = issues.filter((i) => i.message.startsWith("CSV") && i.status === "open");
        const hasWarnings = csvIssues.length > 0 || discoveredCsvs.some((d) => d.validationStatus === "warnings");
        const hasErrors = discoveredCsvs.some((d) => d.validationStatus === "errors");
        return {
          status: activePhase === 4 ? "active" : hasErrors ? "blocked" : hasWarnings ? "warning" : "ready",
          count: csvIssues.length,
        };
      }
      case 5: {
        return {
          status: activePhase === 5 ? "active" : csvCandidates.length > 0 ? "ready" : summary.totalCandidates > 0 ? "ready" : "empty",
          count: csvCandidates.length,
        };
      }
      case 6: {
        const hasDuplicates = (() => {
          const ranks = csvCandidates.map((c) => c.finalRank ?? c.calculatedRank).filter((r) => r > 0);
          const set = new Set(ranks);
          return set.size !== ranks.length;
        })();
        return {
          status: activePhase === 6 ? "active" : hasDuplicates ? "warning" : csvCandidates.length > 0 ? "ready" : "empty",
        };
      }
      case 7: {
        return {
          status: activePhase === 7 ? "active" : draftEntries.length > 0 ? "ready" : summary.hasBlockingIssues ? "blocked" : "empty",
          count: draftEntries.length,
        };
      }
      case 8: {
        return {
          status: activePhase === 8 ? "active" : draftEntries.length > 0 && !summary.hasBlockingIssues ? "ready" : summary.hasBlockingIssues ? "blocked" : "empty",
        };
      }
      default:
        return { status: "empty" };
    }
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {phases.map((phase, index) => {
        const { status, count } = getPhaseStatus(index);
        const isActive = index === activePhase;

        const bgColor = isActive
          ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
          : status === "ready"
            ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]"
            : status === "blocked"
              ? "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]"
              : status === "warning"
                ? "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]"
                : "text-[var(--wk-text-faint)]";

        return (
          <button
            key={phase.id}
            onClick={() => onPhaseChange(index)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition-all ${bgColor}`}
            title={phase.label}
          >
            <i className={phase.icon} />
            <span className="hidden sm:inline">{phase.label}</span>
            {count !== undefined && count > 0 && (
              <span className={`ml-1 rounded-full px-1.5 py-0 text-[9px] font-bold ${
                isActive ? "bg-white/20 text-white" : "bg-[var(--wk-text)]/10 text-[var(--wk-text)]"
              }`}>
                {count}
              </span>
            )}
            {status === "blocked" && <i className="ri-lock-line text-[10px]" />}
            {status === "warning" && <i className="ri-error-warning-line text-[10px]" />}
            {status === "ready" && !isActive && <i className="ri-check-line text-[10px]" />}
          </button>
        );
      })}
    </div>
  );
}