import type { ReactNode } from "react";
import "./Metric.css";

interface WkMetricStripProps {
  children: ReactNode;
  className?: string;
}

interface WkMetricCardProps {
  value: ReactNode;
  label: ReactNode;
  className?: string;
}

function classes(
  base: string,
  className?: string,
): string {
  return className
    ? `${base} ${className}`
    : base;
}

export function WkMetricStrip({
  children,
  className,
}: WkMetricStripProps) {
  return (
    <div
      className={classes(
        "wk-metric-strip",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function WkMetricCard({
  value,
  label,
  className,
}: WkMetricCardProps) {
  return (
    <div
      className={classes(
        "wk-metric-card",
        className,
      )}
    >
      <div className="wk-metric-value">
        {value}
      </div>
      <div className="wk-metric-label">
        {label}
      </div>
    </div>
  );
}
