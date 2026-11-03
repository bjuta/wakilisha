import { useState, type ReactNode } from "react";
import { Sheet } from "./Sheet";

interface WkInspectorProps {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  summary: ReactNode;
  children: ReactNode;
  advanced?: ReactNode;
  advancedLabel?: string;
  inline?: boolean;
}

export function WkInspector({
  open,
  onClose,
  title,
  eyebrow,
  summary,
  children,
  advanced,
  advancedLabel = "Advanced detail",
  inline = false,
}: WkInspectorProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  if (!open) return null;

  const content = <div className="space-y-5">
        <section className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
          {eyebrow ? (
            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-wk-brand">
              {eyebrow}
            </div>
          ) : null}
          <div className={eyebrow ? "mt-2" : ""}>{summary}</div>
        </section>

        <section>{children}</section>

        {advanced ? (
          <section className="border-t border-wk-divider pt-4">
            <button
              type="button"
              aria-expanded={advancedOpen}
              onClick={() => setAdvancedOpen((current) => !current)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-wk-border bg-wk-surface px-3.5 py-3 text-left text-[11px] font-black text-wk-text transition-colors hover:bg-wk-surface-raised focus:outline-none focus:ring-2 focus:ring-wk-brand/15"
            >
              <span>{advancedLabel}</span>
              <i
                aria-hidden="true"
                className={`ri-arrow-down-s-line text-[16px] text-wk-text-muted transition-transform ${
                  advancedOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {advancedOpen ? (
              <div className="mt-3 rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
                {advanced}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>;

  const close = () => {
    setAdvancedOpen(false);
    onClose();
  };
  if (inline) return (
    <aside role="region" aria-label="Source incident inspector"
      data-wk-incident-inline
      className="min-w-0 w-full rounded-2xl border border-wk-border bg-wk-surface shadow-sm
        xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto">
      <div className="flex items-center justify-between gap-3 border-b border-wk-border px-4 py-3">
        <h2 className="min-w-0 break-words text-base font-bold text-wk-text">{title}</h2>
        <button type="button" className="wk-button wk-button-secondary wk-button-sm"
          aria-label="Close" onClick={close}>Close</button>
      </div>
      <div className="p-4">{content}</div>
    </aside>
  );
  return <Sheet open={open} onClose={close} title={title} side="right">
    {content}
  </Sheet>;
}
