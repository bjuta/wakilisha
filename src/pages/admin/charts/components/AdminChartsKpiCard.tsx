import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkIcon } from "@/components/design-system/Icon";
import type { WkIconName } from "@/components/design-system/Icon";

interface AdminChartsKpiCardProps {
  value: string | number;
  label: string;
  trend?: string;
  positive?: boolean;
  icon?: WkIconName;
  accent?: "brand" | "success" | "warning" | "danger" | "info" | "muted";
  compareDelta?: { text: string; up: boolean } | null;
}

const ACCENT_MAP: Record<string, { text: string; bg: string; trendUp: string; trendDown: string }> = {
  brand: { text: "text-wk-brand", bg: "bg-wk-brand-soft", trendUp: "text-wk-brand", trendDown: "text-wk-text-faint" },
  success: { text: "text-wk-success", bg: "bg-wk-success-soft", trendUp: "text-wk-success", trendDown: "text-wk-text-faint" },
  warning: { text: "text-wk-warning", bg: "bg-wk-warning-soft", trendUp: "text-wk-warning", trendDown: "text-wk-text-faint" },
  danger: { text: "text-wk-danger", bg: "bg-wk-danger-soft", trendUp: "text-wk-danger", trendDown: "text-wk-text-faint" },
  info: { text: "text-wk-info", bg: "bg-wk-info-soft", trendUp: "text-wk-info", trendDown: "text-wk-text-faint" },
  muted: { text: "text-wk-text-soft", bg: "bg-wk-surface-raised", trendUp: "text-wk-success", trendDown: "text-wk-danger" },
};

export function AdminChartsKpiCard({
  value,
  label,
  trend,
  positive = true,
  icon,
  accent = "muted",
  compareDelta,
}: AdminChartsKpiCardProps) {
  const colors = ACCENT_MAP[accent] ?? ACCENT_MAP.muted;
  const trendClass = positive ? colors.trendUp : colors.trendDown;

  return (
    <WkSurface className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-wk-text-faint">{label}</p>
          <p className={`mt-1 text-[24px] font-black tracking-tight ${colors.text}`}>{value}
            {compareDelta && (
              <span className={`ml-2 inline-flex items-center gap-0.5 text-[12px] font-bold align-middle ${
                compareDelta.up ? "text-wk-success" : "text-wk-danger"
              }`}>
                <WkIcon name={compareDelta.up ? "ArrowUp" : "ArrowDown"} size={11} />
                {compareDelta.text}
              </span>
            )}
          </p>
          {trend && (
            <div className={`mt-1 flex items-center gap-1 text-[12px] font-semibold ${trendClass}`}>
              {positive ? <WkIcon name="ArrowUp" size={12} /> : <WkIcon name="ArrowDown" size={12} />}
              {trend}
            </div>
          )}
        </div>
        {icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colors.bg} ${colors.text}`}>
            <WkIcon name={icon} size={20} />
          </div>
        )}
      </div>
    </WkSurface>
  );
}