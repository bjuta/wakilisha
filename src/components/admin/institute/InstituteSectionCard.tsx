import type { InstitutePanelBaseProps } from "./instituteExperienceTypes";
import { cx, instituteToneClasses } from "./instituteExperienceStyles";

export function InstituteSectionCard({
  eyebrow,
  title,
  description,
  children,
  footer,
  actions = [],
  tone = "neutral",
  className,
}: InstitutePanelBaseProps) {
  const toneClass = instituteToneClasses(tone);

  return (
    <section className={cx("rounded-3xl border border-wk-border bg-wk-surface p-4 shadow-sm sm:p-5", className)}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <div className={cx("text-[11px] font-black uppercase tracking-[0.2em]", toneClass.text)}>{eyebrow}</div>
          ) : null}
          <h2 className="mt-1 text-lg font-black tracking-tight text-wk-text sm:text-xl">{title}</h2>
          {description ? <p className="mt-2 max-w-3xl text-[13px] leading-6 text-wk-text-muted">{description}</p> : null}
        </div>
        {actions.length > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {actions.map((action) => {
              const actionTone = instituteToneClasses(action.tone ?? "neutral");
              const className = cx(
                "rounded-full border px-3 py-2 text-[12px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50",
                actionTone.button,
              );

              if (action.href && !action.disabled) {
                return (
                  <a key={action.label} href={action.href} className={className}>
                    {action.label}
                  </a>
                );
              }

              return (
                <button key={action.label} type="button" onClick={action.onClick ?? undefined} disabled={action.disabled} className={className}>
                  {action.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {children ? <div className="mt-5">{children}</div> : null}
      {footer ? <div className="mt-5 border-t border-wk-border pt-4">{footer}</div> : null}
    </section>
  );
}
