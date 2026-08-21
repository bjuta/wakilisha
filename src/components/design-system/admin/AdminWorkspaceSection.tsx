import type { ReactNode } from "react";
import { WkIcon, type WkIconName } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";

export function AdminWorkspaceSection({
  icon,
  title,
  note,
  actions,
  children,
  className = "",
}: {
  icon: WkIconName;
  title: string;
  note?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <WkSurface className={`p-5 ${className}`.trim()}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wk-brand-soft text-wk-brand">
            <WkIcon name={icon} size={15} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-black text-wk-text">{title}</h2>
            {note ? (
              <p className="mt-0.5 text-xs leading-5 text-wk-text-muted">
                {note}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </WkSurface>
  );
}
