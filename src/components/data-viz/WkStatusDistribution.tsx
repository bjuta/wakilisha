import type { ReactNode } from "react";

export type WkOperationalTone = "open" | "resolved" | "blocked" | "neutral";

export interface WkStatusSegment {
  key: string;
  label: string;
  count: number;
  tone: WkOperationalTone;
}

const toneColors: Record<WkOperationalTone, string> = {
  open: "bg-wk-warning",
  resolved: "bg-wk-brand",
  blocked: "bg-wk-danger",
  neutral: "bg-wk-text-muted",
};

const toneText: Record<WkOperationalTone, string> = {
  open: "text-wk-warning",
  resolved: "text-wk-brand",
  blocked: "text-wk-danger",
  neutral: "text-wk-text-muted",
};

/** Reusable, accessible, source-reconciled status composition.
 * Each segment remains text-labelled: colour is never the only meaning.
 * This is a snapshot, not an implied live activity chart.
 */
export function WkStatusDistribution({
  segments,
  expectedTotal,
  ariaLabel,
  footer,
}: {
  segments: readonly WkStatusSegment[];
  expectedTotal?: number;
  ariaLabel: string;
  footer?: ReactNode;
}) {
  const valid = segments.length > 0 &&
    new Set(segments.map((s) => s.key)).size === segments.length &&
    segments.every((s) => Number.isSafeInteger(s.count) && s.count >= 0) &&
    (expectedTotal === undefined || (Number.isSafeInteger(expectedTotal) && expectedTotal >= 0));
  const total = valid ? segments.reduce((sum, item) => sum + item.count, 0) : 0;

  if (!valid || (expectedTotal !== undefined && total !== expectedTotal)) {
    return (
      <p role="status" className="rounded-xl border border-wk-border bg-wk-surface p-4 text-[13px] text-wk-text-muted">
        This status distribution could not be reconciled with its source.
      </p>
    );
  }

  if (total === 0) {
    return (
      <div role="group" aria-label={ariaLabel}>
        <p className="rounded-xl border border-wk-border p-5 text-[13px] text-wk-text-muted">
          No recorded items in this snapshot.
        </p>
        {footer}
      </div>
    );
  }

  return (
    <div role="group" aria-label={ariaLabel} data-wk-status-distribution>
      <div className="grid gap-3 sm:grid-cols-3">
        {segments.map((item) => (
          <div key={item.key} className="rounded-xl border border-wk-border bg-wk-surface p-4">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className={"inline-block h-2.5 w-2.5 shrink-0 rounded-[3px] " + toneColors[item.tone]} />
              <span className="min-w-0 truncate text-[12px] font-semibold text-wk-text-muted">{item.label}</span>
            </div>
            <p className="mt-2 text-[clamp(24px,3vw,36px)] font-black leading-none tabular-nums text-wk-text">
              {item.count.toLocaleString()}
            </p>
            <p className={"mt-2 text-[11px] font-semibold tabular-nums " + toneText[item.tone]}>
              {Math.round(item.count / total * 100)}% of {total.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-wk-surface-raised" aria-hidden="true">
        {segments.filter((item) => item.count > 0).map((item) => (
          <span key={item.key} className={toneColors[item.tone]}
            style={{ width: (item.count / total * 100) + "%" }} />
        ))}
      </div>
      <p className="sr-only">
        {ariaLabel}: {segments.map((item) => item.label + " " + item.count.toLocaleString()).join(", ")}; total {total.toLocaleString()}.
      </p>
      {footer}
    </div>
  );
}
