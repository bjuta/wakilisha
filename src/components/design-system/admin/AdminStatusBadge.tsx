export type AdminStatusTone =
  | "success"
  | "warning"
  | "info"
  | "brand"
  | "danger"
  | "neutral";

const STATUS_TONES: Record<string, AdminStatusTone> = {
  publish: "success",
  published: "success",
  approved: "success",
  ready_for_review: "info",
  pending: "info",
  in_review: "info",
  draft: "warning",
  changes_requested: "warning",
  future: "brand",
  scheduled: "brand",
  trash: "danger",
  archived: "neutral",
  private: "neutral",
};

const TONE_CLASSES: Record<AdminStatusTone, string> = {
  success: "bg-wk-success-soft text-wk-success",
  warning: "bg-wk-warning-soft text-wk-warning",
  info: "bg-wk-info-soft text-wk-info",
  brand: "bg-wk-brand-soft text-wk-brand",
  danger: "bg-wk-danger-soft text-wk-danger",
  neutral: "bg-wk-surface-raised text-wk-text-muted",
};

export function humanizeAdminStatus(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function adminStatusTone(value: string | null | undefined): AdminStatusTone {
  if (!value) return "neutral";
  return STATUS_TONES[value] ?? "neutral";
}

export function AdminStatusBadge({
  status,
  label,
  tone,
  className = "",
}: {
  status: string | null | undefined;
  label?: string;
  tone?: AdminStatusTone;
  className?: string;
}) {
  const resolvedStatus = status || "draft";
  const resolvedTone = tone ?? adminStatusTone(resolvedStatus);

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${TONE_CLASSES[resolvedTone]} ${className}`.trim()}
    >
      {label ?? humanizeAdminStatus(resolvedStatus)}
    </span>
  );
}
