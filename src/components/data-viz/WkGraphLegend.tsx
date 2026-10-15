import type { ReactNode } from "react";

export type WkGraphLegendItem = Readonly<{
  id: string;
  label: string;
  shape: "ring" | "square" | "line";
  tone?: "brand" | "warning" | "muted" | "info";
  count?: number;
  visible?: boolean;
  toggleable?: boolean;
}>;

const toneClass = {
  brand: "text-wk-brand",
  warning: "text-wk-warning",
  muted: "text-wk-text-muted",
  info: "text-wk-info",
} as const;

function WkLegendShape({ shape }: { shape: WkGraphLegendItem["shape"] }) {
  if (shape === "ring") return <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-full border-2 border-current" />;
  if (shape === "line") return <span aria-hidden="true" className="inline-block h-px w-3 shrink-0 bg-current" />;
  return <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px] bg-current" />;
}

/** Accessible, token-mapped legend for authenticated relationship and temporal graphs.
 * It supplies no source facts. Callers project authorized categories and counts.
 * Button toggles are optional, and never imply backend write authority.
 */
export function WkGraphLegend({ items, title = "Graph key", footer, onToggle }: {
  items: readonly WkGraphLegendItem[];
  title?: string;
  footer?: ReactNode;
  onToggle?: (id: string) => void;
}) {
  return (
    <div data-wk-graph-legend role="group" aria-label={title}>
      <h3 className="mb-2 text-[12px] font-bold text-wk-text">{title}</h3>
      <ul className="space-y-2">
        {items.map(item => (
          <li key={item.id}>
            {onToggle && item.toggleable ? (
              <button type="button" aria-pressed={item.visible !== false}
                onClick={() => onToggle(item.id)}
                className={"flex min-h-8 w-full items-center gap-2 rounded-md p-1 text-left text-[12px] focus-visible:outline-2 focus-visible:outline-wk-brand " +
                  (item.visible === false ? "opacity-50 " : "") + toneClass[item.tone ?? "muted"]}>
                <WkLegendShape shape={item.shape} />
                <span className="min-w-0 flex-1 text-wk-text">{item.label}</span>
                {item.count !== undefined ? <b className="shrink-0 tabular-nums">{item.count.toLocaleString()}</b> : null}
              </button>
            ) : (
              <div className={"flex items-center gap-2 text-[12px] " + toneClass[item.tone ?? "muted"]}>
                <WkLegendShape shape={item.shape} />
                <span className="text-wk-text">{item.label}</span>
                {item.count !== undefined ? <b className="ml-auto tabular-nums">{item.count.toLocaleString()}</b> : null}
              </div>
            )}
          </li>
        ))}
      </ul>
      {footer ? <p className="mt-3 border-t border-wk-border pt-2 text-[11px] leading-4 text-wk-text-muted">{footer}</p> : null}
    </div>
  );
}
