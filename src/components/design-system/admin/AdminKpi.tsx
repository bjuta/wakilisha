import type { ReactNode } from "react";

interface AdminKpiProps {
  label: string;
  value: string | number;
  change?: number;
  icon?: string;
  accentVar?: string;
}

export function AdminKpi({
  label,
  value,
  change,
  icon,
  accentVar = "--wk-brand",
}: AdminKpiProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <div className="wk-panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">
          {label}
        </span>
        {icon && (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: `rgba(var(--wk-brand-rgb),.12)` }}
          >
            <i className={`${icon} text-sm`} style={{ color: `var(${accentVar})` }} />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-2xl font-black text-[var(--wk-text)]">{value}</span>
        {change !== undefined && (
          <span
            className="mb-0.5 flex items-center text-[12px] font-bold"
            style={{
              color: isPositive
                ? "var(--wk-success)"
                : isNegative
                ? "var(--wk-danger)"
                : "var(--wk-text-faint)",
            }}
          >
            <i
              className={
                isPositive
                  ? "ri-arrow-up-line"
                  : isNegative
                  ? "ri-arrow-down-line"
                  : "ri-subtract-line"
              }
            />
            {Math.abs(change)}%
          </span>
        )}
      </div>
    </div>
  );
}