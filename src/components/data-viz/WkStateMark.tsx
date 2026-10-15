import { WkIcon, type WkIconName } from "@/components/design-system/Icon";

export type WkSemanticState = "open" | "resolved" | "verified" | "blocked" | "pending" | "unverified" | "unknown";

const STATE: Record<WkSemanticState, {
  defaultLabel: string;
  icon: WkIconName;
  className: string;
}> = {
  open: { defaultLabel: "Open", icon: "Circle", className: "border-wk-warning/30 bg-wk-warning-soft text-wk-warning" },
  resolved: { defaultLabel: "Resolved", icon: "CheckCircle2", className: "border-wk-brand/25 bg-wk-brand-soft text-wk-brand" },
  verified: { defaultLabel: "Verified complete", icon: "BadgeCheck", className: "border-wk-brand/25 bg-wk-brand-soft text-wk-brand" },
  blocked: { defaultLabel: "Blocked", icon: "AlertTriangle", className: "border-wk-danger/25 bg-wk-danger-soft text-wk-danger" },
  pending: { defaultLabel: "Pending", icon: "Clock", className: "border-wk-warning/30 bg-wk-warning-soft text-wk-warning" },
  unverified: { defaultLabel: "Not independently verified", icon: "HelpCircle", className: "border-wk-border bg-wk-surface-raised text-wk-text-muted" },
  unknown: { defaultLabel: "Unknown state", icon: "HelpCircle", className: "border-wk-border bg-wk-surface-raised text-wk-text-muted" },
};

/** Reusable state marker. Domain services determine the state; graphics do not infer it.
 * Hue is redundant with explicit icon geometry and the spoken/written state label.
 */
export function WkStateMark({
  state, label, compact = false,
}: {
  state: WkSemanticState;
  label?: string;
  compact?: boolean;
}) {
  const fact = STATE[state];
  return (
    <span data-wk-state-mark={state} className={
      "inline-flex max-w-full items-center gap-1.5 rounded-full border font-semibold " +
      (compact ? "px-2 py-0.5 text-[10px] " : "px-2.5 py-1 text-[11px] ") + fact.className
    }>
      <WkIcon name={fact.icon} size={compact ? 12 : 14} aria-hidden="true" />
      <span className="min-w-0 leading-4">{label || fact.defaultLabel}</span>
    </span>
  );
}
