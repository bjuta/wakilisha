import type { ReactNode } from "react";

interface AdminChartsPageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}

export function AdminChartsPageHeader({
  eyebrow,
  title,
  description,
  children,
}: AdminChartsPageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {eyebrow && (
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[22px] font-black tracking-tight text-wk-text">{title}</h1>
        {description && (
          <p className="mt-1 text-[13px] text-wk-text-muted">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}