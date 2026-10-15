export interface WkRankedBarItem {
  key: string;
  label: string;
  value: number;
}

export function WkRankedBars({
  items,
  total,
  valueLabel = "items",
  ariaLabel,
}: {
  items: readonly WkRankedBarItem[];
  total: number;
  valueLabel?: string;
  ariaLabel: string;
}) {
  const valid = Number.isSafeInteger(total) && total >= 0 &&
    new Set(items.map((item) => item.key)).size === items.length &&
    items.every((item) => Number.isSafeInteger(item.value) && item.value >= 0) &&
    items.reduce((sum, item) => sum + item.value, 0) <= total;
  if (!valid) {
    return (
      <p role="status" className="text-[13px] text-wk-text-muted">
        This workstream comparison could not be reconciled with its source.
      </p>
    );
  }
  if (items.length === 0 || total === 0) {
    return <p role="status" className="text-[13px] text-wk-text-muted">No recorded work in this snapshot.</p>;
  }
  const sorted = [...items].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const max = Math.max(...sorted.map((item) => item.value));
  return (
    <div role="list" aria-label={ariaLabel} className="divide-y divide-wk-border" data-wk-ranked-bars>
      {sorted.map((item) => (
        <div role="listitem" key={item.key} className="py-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="min-w-0 text-[13px] font-semibold leading-5 text-wk-text">{item.label}</span>
            <span className="shrink-0 text-[18px] font-black tabular-nums text-wk-text">{item.value.toLocaleString()}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-wk-surface-raised" aria-hidden="true">
            <div className="h-full rounded-full bg-wk-brand"
              style={{ width: (max > 0 ? item.value / max * 100 : 0) + "%" }} />
          </div>
          <p className="mt-2 text-[11px] tabular-nums text-wk-text-muted">
            {Math.round(item.value / total * 100)}% of {total.toLocaleString()} {valueLabel}
          </p>
        </div>
      ))}
    </div>
  );
}
