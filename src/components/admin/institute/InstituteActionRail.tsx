import type { InstituteActionItem } from "./instituteExperienceTypes";
import { cx, instituteToneClasses } from "./instituteExperienceStyles";

export function InstituteActionRail({
  actions = [],
  emptyText = "Nothing needs action right now.",
}: {
  actions?: InstituteActionItem[];
  emptyText?: string;
}) {
  if (actions.length === 0) {
    return <p className="rounded-2xl border border-wk-border bg-wk-bg p-4 text-[13px] leading-5 text-wk-text-muted">{emptyText}</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {actions.map((action) => {
        const tone = instituteToneClasses(action.tone ?? "neutral");
        const className = cx(
          "block rounded-2xl border bg-wk-bg p-3 text-left transition hover:border-wk-brand/40 disabled:cursor-not-allowed disabled:opacity-50 sm:p-4",
          tone.button,
        );

        const content = (
          <>
            <span className="block text-[13px] font-black text-wk-text">{action.label}</span>
            {action.description ? <span className="mt-2 block text-[12px] leading-5 text-wk-text-muted">{action.description}</span> : null}
          </>
        );

        if (action.href && !action.disabled) {
          return (
            <a key={action.label} href={action.href} className={className}>
              {content}
            </a>
          );
        }

        return (
          <button key={action.label} type="button" onClick={action.onClick ?? undefined} disabled={action.disabled} className={className}>
            {content}
          </button>
        );
      })}
    </div>
  );
}
