import type { InstituteDecisionItem } from "./instituteExperienceTypes";
import { cx, instituteToneClasses } from "./instituteExperienceStyles";
import { InstituteSectionCard } from "./InstituteSectionCard";

export function InstituteDecisionLog({
  decisions = [],
}: {
  decisions?: InstituteDecisionItem[];
}) {
  return (
    <InstituteSectionCard
      eyebrow="Decision log"
      title="What did we decide, and why?"
      description="Review decisions need reasons so future editors can understand the path."
    >
      {decisions.length === 0 ? (
        <p className="rounded-2xl border border-wk-border bg-wk-bg p-4 text-[13px] leading-5 text-wk-text-muted">
          No decisions have been recorded yet. When someone approves, rejects, or pauses work, the reason belongs here.
        </p>
      ) : (
        <div className="space-y-3">
          {decisions.map((decision) => {
            const tone = instituteToneClasses(decision.tone ?? "neutral");
            return (
              <article key={`${decision.label}-${decision.reason}`} className={cx("rounded-2xl border p-4", tone.panel)}>
                <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                  <h3 className="text-[14px] font-black text-wk-text">{decision.label}</h3>
                  {decision.meta ? <span className="text-[12px] font-bold text-wk-text-muted">{decision.meta}</span> : null}
                </div>
                <p className="mt-2 text-[13px] leading-5 text-wk-text-muted">{decision.reason}</p>
              </article>
            );
          })}
        </div>
      )}
    </InstituteSectionCard>
  );
}
