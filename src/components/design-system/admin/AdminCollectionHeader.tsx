import type { ReactNode } from "react";

export function AdminCollectionHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">
          {eyebrow}
        </div>
        <h1 className="text-[22px] font-black tracking-tight text-wk-text">
          {title}
        </h1>
        {description ? (
          <div className="mt-1 max-w-2xl text-[13px] text-wk-text-muted">
            {description}
          </div>
        ) : null}
        {meta ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-wk-text-faint">
            {meta}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
