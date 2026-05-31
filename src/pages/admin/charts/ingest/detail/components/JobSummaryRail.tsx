import { useState } from "react";
import type { IngestJob } from "@/services/chartsIngestion/types";

interface JobSummaryRailProps {
  job: IngestJob;
  summary: {
    totalSources: number;
    totalRawItems: number;
    totalCandidates: number;
    approvedMatches: number;
    unresolvedMatches: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    finalChartSize: number;
    isPublishable: boolean;
    hasBlockingIssues: boolean;
    hasUnresolvedMatches: boolean;
    hasDraft: boolean;
  };
  onToggle?: () => void;
  collapsed?: boolean;
}

export function JobSummaryRail({ job, summary, collapsed }: JobSummaryRailProps) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed ?? false);

  if (isCollapsed) {
    return (
      <div className="lg:hidden">
        <button
          onClick={() => setIsCollapsed(false)}
          className="wk-button wk-button-sm wk-button-ghost w-full"
        >
          <i className="ri-bar-chart-box-line" />
          Show Job Summary
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Mobile close button */}
      <div className="flex items-center justify-between lg:hidden">
        <span className="text-[12px] font-bold text-[var(--wk-text)]">Job Summary</span>
        <button
          onClick={() => setIsCollapsed(true)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
        >
          <i className="ri-close-line" />
        </button>
      </div>

      {/* Status */}
      <div className="rounded-lg border border-[var(--wk-border)] p-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Status</div>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              job.status === "published"
                ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]"
                : job.status === "failed"
                  ? "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]"
                  : job.status === "drafted"
                    ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                    : "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]"
            }`}
          >
            {job.status.replace(/_/g, " ")}
          </span>
          {summary.isPublishable && (
            <span className="rounded-full bg-[var(--wk-success-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-success)]">
              READY
            </span>
          )}
          {summary.hasBlockingIssues && (
            <span className="rounded-full bg-[var(--wk-danger-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-danger)]">
              BLOCKED
            </span>
          )}
        </div>
      </div>

      {/* Family + Date */}
      <div className="rounded-lg border border-[var(--wk-border)] p-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Chart Family</div>
        <div className="mt-1 text-[12px] font-semibold text-[var(--wk-text)]">{job.chartFamily?.label}</div>
        <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Edition Date</div>
        <div className="mt-1 text-[12px] font-semibold text-[var(--wk-text)]">{job.editionDate}</div>
      </div>

      {/* Source Counts */}
      <div className="rounded-lg border border-[var(--wk-border)] p-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Sources</div>
        <div className="mt-2 space-y-1.5">
          <SummaryRow label="Total Sources" value={summary.totalSources} />
          <SummaryRow label="Raw Items" value={summary.totalRawItems} color="var(--wk-info)" />
          <SummaryRow label="Candidates" value={summary.totalCandidates} />
        </div>
      </div>

      {/* Match Counts */}
      <div className="rounded-lg border border-[var(--wk-border)] p-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Matching</div>
        <div className="mt-2 space-y-1.5">
          <SummaryRow label="Approved" value={summary.approvedMatches} color="var(--wk-success)" />
          <SummaryRow
            label="Unresolved"
            value={summary.unresolvedMatches}
            color={summary.unresolvedMatches > 0 ? "var(--wk-warning)" : "var(--wk-text-muted)"}
          />
        </div>
      </div>

      {/* Issue Counts */}
      <div className="rounded-lg border border-[var(--wk-border)] p-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Issues</div>
        <div className="mt-2 space-y-1.5">
          <SummaryRow
            label="High"
            value={summary.highIssues}
            color={summary.highIssues > 0 ? "var(--wk-danger)" : "var(--wk-text-muted)"}
          />
          <SummaryRow
            label="Medium"
            value={summary.mediumIssues}
            color={summary.mediumIssues > 0 ? "var(--wk-warning)" : "var(--wk-text-muted)"}
          />
          <SummaryRow
            label="Low"
            value={summary.lowIssues}
            color={summary.lowIssues > 0 ? "var(--wk-info)" : "var(--wk-text-muted)"}
          />
        </div>
      </div>

      {/* Final */}
      <div className="rounded-lg border border-[var(--wk-border)] p-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Final Chart</div>
        <div className="mt-2 space-y-1.5">
          <SummaryRow label="Draft Size" value={summary.finalChartSize} />
          <SummaryRow label="Target Size" value={job.chartSize} />
          <SummaryRow label="Publish Ready" value={summary.isPublishable ? "Yes" : "No"} color={summary.isPublishable ? "var(--wk-success)" : "var(--wk-text-muted)"} />
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: number | string; color?: string }) {
  const isString = typeof value === "string";
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-[var(--wk-text-muted)]">{label}</span>
      <span className={`font-semibold tabular-nums ${isString ? "" : "text-[var(--wk-text)]"}`} style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}