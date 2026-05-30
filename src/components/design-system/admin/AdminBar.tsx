import type { ReactNode } from "react";

interface AdminBarProps {
  breadcrumbs?: { label: string; href?: string }[];
  actions?: ReactNode;
  title?: string;
}

export function AdminBar({ breadcrumbs = [], actions, title }: AdminBarProps) {
  return (
    <div className="border-b border-[var(--wk-border)] bg-[var(--wk-surface)] px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px]">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && (
                <i className="ri-arrow-right-s-line text-[var(--wk-text-faint)]" />
              )}
              {b.href ? (
                <a
                  href={b.href}
                  className="text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
                >
                  {b.label}
                </a>
              ) : (
                <span className="font-semibold text-[var(--wk-text)]">{b.label}</span>
              )}
            </span>
          ))}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {title && (
        <h1 className="mt-2 text-xl font-black tracking-tight text-[var(--wk-text)]">{title}</h1>
      )}
    </div>
  );
}