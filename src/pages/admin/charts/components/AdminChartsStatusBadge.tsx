interface AdminChartsStatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-wk-surface-raised", text: "text-wk-text-muted", label: "Draft" },
  fetching: { bg: "bg-wk-info-soft", text: "text-wk-info", label: "Fetching" },
  normalizing: { bg: "bg-wk-info-soft", text: "text-wk-info", label: "Normalizing" },
  matching: { bg: "bg-wk-info-soft", text: "text-wk-info", label: "Matching" },
  scoring: { bg: "bg-wk-warning-soft", text: "text-wk-warning", label: "Scoring" },
  review: { bg: "bg-wk-warning-soft", text: "text-wk-warning", label: "Review" },
  ready_to_draft: { bg: "bg-wk-brand-soft", text: "text-wk-brand", label: "Ready to Draft" },
  drafted: { bg: "bg-wk-brand-soft", text: "text-wk-brand", label: "Drafted" },
  published: { bg: "bg-wk-success-soft", text: "text-wk-success", label: "Published" },
  failed: { bg: "bg-wk-danger-soft", text: "text-wk-danger", label: "Failed" },
  cancelled: { bg: "bg-wk-surface-raised", text: "text-wk-text-muted", label: "Cancelled" },
  running: { bg: "bg-wk-info-soft", text: "text-wk-info", label: "Running" },
  dry_run_complete: { bg: "bg-wk-warning-soft", text: "text-wk-warning", label: "Dry Run" },
  ready_to_commit: { bg: "bg-wk-brand-soft", text: "text-wk-brand", label: "Ready" },
  committing: { bg: "bg-wk-brand-soft", text: "text-wk-brand", label: "Committing" },
  committed: { bg: "bg-wk-success-soft", text: "text-wk-success", label: "Committed" },
  needs_review: { bg: "bg-wk-warning-soft", text: "text-wk-warning", label: "Needs Review" },
  active: { bg: "bg-wk-success-soft", text: "text-wk-success", label: "Active" },
  inactive: { bg: "bg-wk-surface-raised", text: "text-wk-text-muted", label: "Inactive" },
  archived: { bg: "bg-wk-surface-raised", text: "text-wk-text-faint", label: "Archived" },
  pass: { bg: "bg-wk-success-soft", text: "text-wk-success", label: "Pass" },
  fail: { bg: "bg-wk-danger-soft", text: "text-wk-danger", label: "Fail" },
  warning: { bg: "bg-wk-warning-soft", text: "text-wk-warning", label: "Warning" },
  idle: { bg: "bg-wk-surface-raised", text: "text-wk-text-faint", label: "Idle" },
  ok: { bg: "bg-wk-success-soft", text: "text-wk-success", label: "OK" },
  error: { bg: "bg-wk-danger-soft", text: "text-wk-danger", label: "Error" },
  not_implemented: { bg: "bg-wk-warning-soft", text: "text-wk-warning", label: "Not Implemented" },
  untested: { bg: "bg-wk-surface-raised", text: "text-wk-text-faint", label: "Untested" },
  mocked: { bg: "bg-wk-warning-soft", text: "text-wk-warning", label: "Mocked" },
  ready_api: { bg: "bg-wk-success-soft", text: "text-wk-success", label: "Ready" },
  not_configured: { bg: "bg-wk-surface-raised", text: "text-wk-text-faint", label: "Not Configured" },
  canonical: { bg: "bg-wk-success-soft", text: "text-wk-success", label: "Canonical" },
  shell: { bg: "bg-wk-warning-soft", text: "text-wk-warning", label: "Shell" },
  no_match: { bg: "bg-wk-danger-soft", text: "text-wk-danger", label: "No Match" },
  duplicate_candidate: { bg: "bg-wk-info-soft", text: "text-wk-info", label: "Duplicate" },
  resolved: { bg: "bg-wk-success-soft", text: "text-wk-success", label: "Resolved" },
  pending: { bg: "bg-wk-surface-raised", text: "text-wk-text-muted", label: "Pending" },
  shell_created: { bg: "bg-wk-warning-soft", text: "text-wk-warning", label: "Shell Created" },
  ignored: { bg: "bg-wk-surface-raised", text: "text-wk-text-faint", label: "Ignored" },
  sent_to_review: { bg: "bg-wk-info-soft", text: "text-wk-info", label: "In Review" },
  health_ok: { bg: "bg-wk-success-soft", text: "text-wk-success", label: "Healthy" },
  health_warn: { bg: "bg-wk-warning-soft", text: "text-wk-warning", label: "Warning" },
  health_error: { bg: "bg-wk-danger-soft", text: "text-wk-danger", label: "Critical" },
  missing_credentials: { bg: "bg-wk-danger-soft", text: "text-wk-danger", label: "Missing Credentials" },
  rate_limited: { bg: "bg-wk-warning-soft", text: "text-wk-warning", label: "Rate Limited" },
};

export function AdminChartsStatusBadge({ status, size = "md" }: AdminChartsStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    bg: "bg-wk-surface-raised",
    text: "text-wk-text-muted",
    label: status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
  };

  const sizeClasses = size === "sm"
    ? "px-2 py-0.5 text-[10px]"
    : "px-2.5 py-1 text-[11px]";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap ${config.bg} ${config.text} ${sizeClasses}`}>
      {config.label}
    </span>
  );
}