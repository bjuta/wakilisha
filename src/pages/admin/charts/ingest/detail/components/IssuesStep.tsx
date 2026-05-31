import { useState } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { ReviewIssue } from "@/services/chartsIngestion/types";
import { resolveReviewIssue, reopenIssue, hasCapability, getDisabledReason } from "@/services/chartsIngestion/client";
import type { UserRole } from "@/services/chartsIngestion/client";

interface IssuesStepProps {
  jobId: string;
  issues: ReviewIssue[];
  onUpdate: () => void;
  role?: UserRole;
}

export function IssuesStep({ jobId, issues, onUpdate, role = "admin" }: IssuesStepProps) {
  const [resolutionNote, setResolutionNote] = useState("");
  const [activeIssue, setActiveIssue] = useState<string | null>(null);

  const canResolve = hasCapability(role, "resolve_issues");
  const canOverrideHigh = hasCapability(role, "override_high_issues");

  const grouped = {
    high: issues.filter((i) => i.severity === "high"),
    medium: issues.filter((i) => i.severity === "medium"),
    low: issues.filter((i) => i.severity === "low"),
  };

  const handleResolve = async (issueId: string) => {
    await resolveReviewIssue(jobId, issueId, {
      resolution: "resolve",
      note: resolutionNote || "Resolved by admin",
    });
    setActiveIssue(null);
    setResolutionNote("");
    onUpdate();
  };

  const handleIgnore = async (issueId: string) => {
    await resolveReviewIssue(jobId, issueId, {
      resolution: "ignore",
      note: resolutionNote || "Ignored by admin",
    });
    setActiveIssue(null);
    setResolutionNote("");
    onUpdate();
  };

  const handleOverride = async (issueId: string) => {
    if (!resolutionNote) return;
    await resolveReviewIssue(jobId, issueId, {
      resolution: "override",
      note: resolutionNote,
    });
    setActiveIssue(null);
    setResolutionNote("");
    onUpdate();
  };

  const handleReopen = async (issueId: string) => {
    await reopenIssue(jobId, issueId);
    onUpdate();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Review Issues</h2>
        <div className="flex items-center gap-2">
          {grouped.high.length > 0 && (
            <span className="rounded-full bg-[var(--wk-danger-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-danger)]">
              {grouped.high.length} High
            </span>
          )}
          {grouped.medium.length > 0 && (
            <span className="rounded-full bg-[var(--wk-warning-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-warning)]">
              {grouped.medium.length} Medium
            </span>
          )}
          {grouped.low.length > 0 && (
            <span className="rounded-full bg-[var(--wk-info-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-info)]">
              {grouped.low.length} Low
            </span>
          )}
        </div>
      </div>

      {/* Blocking Banner */}
      {grouped.high.some((i) => i.status === "open") && (
        <div className="rounded-xl border border-[var(--wk-danger)] bg-[var(--wk-danger-soft)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wk-danger)] text-white">
              <i className="ri-lock-line" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-[var(--wk-danger)]">Publishing Blocked</div>
              <div className="text-[12px] text-[var(--wk-text-soft)]">
                {grouped.high.filter((i) => i.status === "open").length} high severity issues must be resolved or overridden before publishing.
              </div>
            </div>
          </div>
        </div>
      )}

      {grouped.high.length > 0 && (
        <div>
          <h3 className="mb-2 text-[12px] font-bold text-[var(--wk-danger)]">High Severity</h3>
          <div className="space-y-2">
            {grouped.high.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                activeIssue={activeIssue}
                setActiveIssue={setActiveIssue}
                resolutionNote={resolutionNote}
                setResolutionNote={setResolutionNote}
                onResolve={handleResolve}
                onIgnore={handleIgnore}
                onOverride={handleOverride}
                onReopen={handleReopen}
                requireOverrideNote
              />
            ))}
          </div>
        </div>
      )}

      {grouped.medium.length > 0 && (
        <div>
          <h3 className="mb-2 text-[12px] font-bold text-[var(--wk-warning)]">Medium Severity</h3>
          <div className="space-y-2">
            {grouped.medium.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                activeIssue={activeIssue}
                setActiveIssue={setActiveIssue}
                resolutionNote={resolutionNote}
                setResolutionNote={setResolutionNote}
                onResolve={handleResolve}
                onIgnore={handleIgnore}
                onOverride={handleOverride}
                onReopen={handleReopen}
              />
            ))}
          </div>
        </div>
      )}

      {grouped.low.length > 0 && (
        <div>
          <h3 className="mb-2 text-[12px] font-bold text-[var(--wk-info)]">Low Severity</h3>
          <div className="space-y-2">
            {grouped.low.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                activeIssue={activeIssue}
                setActiveIssue={setActiveIssue}
                resolutionNote={resolutionNote}
                setResolutionNote={setResolutionNote}
                onResolve={handleResolve}
                onIgnore={handleIgnore}
                onOverride={handleOverride}
                onReopen={handleReopen}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface IssueCardProps {
  issue: ReviewIssue;
  activeIssue: string | null;
  setActiveIssue: (id: string | null) => void;
  resolutionNote: string;
  setResolutionNote: (note: string) => void;
  onResolve: (id: string) => void;
  onIgnore: (id: string) => void;
  onOverride: (id: string) => void;
  onReopen: (id: string) => void;
  requireOverrideNote?: boolean;
}

function IssueCard({
  issue,
  activeIssue,
  setActiveIssue,
  resolutionNote,
  setResolutionNote,
  onResolve,
  onIgnore,
  onOverride,
  onReopen,
  requireOverrideNote,
}: IssueCardProps) {
  const isActive = activeIssue === issue.id;
  const isResolved = issue.status === "resolved" || issue.status === "ignored";
  const isOverridden = issue.status === "resolved" && issue.resolutionNote?.toLowerCase().includes("override");

  const borderColor = issue.severity === "high" ? "var(--wk-danger)" :
    issue.severity === "medium" ? "var(--wk-warning)" : "var(--wk-info)";

  return (
    <div className="wk-panel border-l-2 p-4" style={{ borderLeftColor: borderColor }}>
      <div className="flex items-start gap-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{ background: `${borderColor}20`, color: borderColor }}
        >
          <i className="ri-flag-line text-xs" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold" style={{ color: borderColor }}>{issue.issueType}</span>
            {issue.blocking && issue.status === "open" && (
              <span className="rounded-full bg-[var(--wk-danger-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-danger)]">
                BLOCKING
              </span>
            )}
            {isResolved && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                isOverridden ? "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]" :
                "bg-[var(--wk-success-soft)] text-[var(--wk-success)]"
              }`}>
                {isOverridden ? "OVERRIDDEN" : "RESOLVED"}
              </span>
            )}
          </div>
          <div className="mt-1 text-[12px] text-[var(--wk-text-soft)]">{issue.message}</div>
          {issue.resolutionNote && (
            <div className="mt-2 rounded-lg bg-[var(--wk-bg-subtle)] p-2 text-[11px] text-[var(--wk-text-muted)]">
              {issue.resolutionNote}
            </div>
          )}
          <div className="mt-2 text-[10px] text-[var(--wk-text-faint)]">
            {issue.createdAt}
          </div>
        </div>
        <div className="flex gap-1">
          {isResolved ? (
            <button
              onClick={() => onReopen(issue.id)}
              className="wk-button wk-button-sm wk-button-ghost"
            >
              <i className="ri-restart-line" />
              Reopen
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setActiveIssue(isActive ? null : issue.id);
                  setResolutionNote("");
                }}
                className="wk-button wk-button-sm wk-button-ghost"
              >
                <i className="ri-check-line" />
                Resolve
              </button>
              <button
                onClick={() => onIgnore(issue.id)}
                className="wk-button wk-button-sm wk-button-ghost"
              >
                <i className="ri-eye-off-line" />
                Ignore
              </button>
            </>
          )}
        </div>
      </div>

      {/* Resolution form */}
      {isActive && !isResolved && (
        <div className="mt-3 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-3">
          <div className="text-[12px] font-semibold text-[var(--wk-text)] mb-2">Resolution Note</div>
          <textarea
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            placeholder={requireOverrideNote ? "Override requires a reason..." : "Add notes (optional)..."}
            maxLength={500}
            className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-2 text-[12px] text-[var(--wk-text)] outline-none placeholder:text-[var(--wk-text-faint)]"
            rows={3}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => onResolve(issue.id)}
              className="wk-button wk-button-sm wk-button-primary"
            >
              <i className="ri-check-line" />
              Mark Resolved
            </button>
            {issue.severity === "high" && (
              <button
                onClick={() => onOverride(issue.id)}
                disabled={!resolutionNote}
                className="wk-button wk-button-sm wk-button-ghost"
                title={!resolutionNote ? "Override requires a reason" : ""}
              >
                <i className="ri-shield-check-line" />
                Override
              </button>
            )}
            <button
              onClick={() => {
                setActiveIssue(null);
                setResolutionNote("");
              }}
              className="wk-button wk-button-sm wk-button-ghost"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}