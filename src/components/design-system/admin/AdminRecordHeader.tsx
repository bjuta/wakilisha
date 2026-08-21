import type { ReactNode } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { AdminStatusBadge } from "./AdminStatusBadge";

export function AdminRecordHeader({
  collectionLabel,
  title,
  status,
  statusLabel,
  onBack,
  meta,
  badges,
  actions,
  footer,
  className = "",
}: {
  collectionLabel: string;
  title: string;
  status?: string | null;
  statusLabel?: string;
  onBack?: () => void;
  meta?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={`sticky top-0 z-40 rounded-2xl border border-wk-border bg-wk-surface shadow-sm ${className}`.trim()}
    >
      <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex min-w-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-wk-text-faint">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="shrink-0 text-wk-brand transition-colors hover:text-wk-brand-hover"
              >
                {collectionLabel}
              </button>
            ) : (
              <span className="shrink-0 text-wk-brand">{collectionLabel}</span>
            )}
            <WkIcon name="ChevronRight" size={11} />
            <span className="truncate">{title}</span>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="max-w-full truncate text-[18px] font-black tracking-tight text-wk-text sm:text-[20px] lg:max-w-[560px]">
              {title}
            </h1>
            {status ? (
              <AdminStatusBadge status={status} label={statusLabel} />
            ) : null}
            {badges}
          </div>

          {meta ? (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-wk-text-faint">
              {meta}
            </div>
          ) : null}
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {actions}
          </div>
        ) : null}
      </div>

      {footer ? (
        <div className="border-t border-wk-border px-4 py-2 text-[10px] text-wk-text-faint">
          {footer}
        </div>
      ) : null}
    </header>
  );
}
