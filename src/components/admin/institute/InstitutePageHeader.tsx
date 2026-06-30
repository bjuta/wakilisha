import type { ReactNode } from "react";
import type { InstituteActionItem, InstituteBadgeItem } from "./instituteExperienceTypes";
import { InstituteStatusExplainer } from "./InstituteStatusExplainer";

export function InstitutePageHeader({
  eyebrow = "WAKILISHA Institute",
  title,
  description,
  question,
  badges = [],
  actions = [],
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string | null;
  question?: string | null;
  badges?: InstituteBadgeItem[];
  actions?: InstituteActionItem[];
  children?: ReactNode;
}) {
  return (
    <header className="rounded-[2rem] border border-wk-border bg-wk-surface p-4 shadow-sm sm:p-6">
      <div className="text-[11px] font-black uppercase tracking-[0.24em] text-wk-brand">{eyebrow}</div>
      <div className="mt-4 grid gap-5 xl:grid-cols-[1fr_auto] xl:items-end">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-wk-text sm:text-3xl lg:text-4xl">{title}</h1>
          {description ? <p className="mt-3 max-w-3xl text-[14px] leading-6 text-wk-text-muted">{description}</p> : null}
          {question ? (
            <div className="mt-4 rounded-2xl border border-wk-border bg-wk-bg p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-wk-text-muted">Question in view</div>
              <p className="mt-2 text-[16px] font-black leading-6 text-wk-text">{question}</p>
            </div>
          ) : null}
        </div>

        {actions.length > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {actions.map((action) => (
              <a
                key={action.label}
                href={action.href ?? "#"}
                className="rounded-full border border-wk-border px-4 py-2 text-center text-[13px] font-bold text-wk-text hover:border-wk-brand/40"
                aria-disabled={action.disabled}
              >
                {action.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>

      {badges.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {badges.map((badge) => (
            <InstituteStatusExplainer key={badge.label} label={badge.label} description={badge.description} tone={badge.tone} />
          ))}
        </div>
      ) : null}

      {children ? <div className="mt-5">{children}</div> : null}
    </header>
  );
}
