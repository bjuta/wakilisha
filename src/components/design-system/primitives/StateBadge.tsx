import type { ReactNode } from "react";

type WkStateTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

interface WkStateBadgeProps {
  children: ReactNode;
  tone?: WkStateTone;
  className?: string;
}

const toneClasses: Record<WkStateTone, string> = {
  neutral: "bg-wk-surface-raised text-wk-text-muted",
  info: "bg-wk-brand-soft text-wk-brand",
  success: "bg-wk-brand-soft text-wk-brand",
  warning: "bg-wk-warning/10 text-wk-warning",
  danger: "bg-wk-danger/10 text-wk-danger",
};

export function WkStateBadge({
  children,
  tone = "neutral",
  className = "",
}: WkStateBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${toneClasses[tone]} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
