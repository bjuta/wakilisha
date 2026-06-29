import type { InstituteInsightItem } from "./instituteExperienceTypes";
import { cx, instituteToneClasses } from "./instituteExperienceStyles";
import { InstituteSectionCard } from "./InstituteSectionCard";

export function InstituteUncertaintyPanel({
  items = [],
}: {
  items?: InstituteInsightItem[];
}) {
  return (
    <InstituteSectionCard
      eyebrow="Uncertainty"
      title="What is still uncertain?"
      description="Make gaps visible so the team does not turn guesses into claims."
    >
      {items.length === 0 ? (
        <p className="rounded-2xl border border-wk-border bg-wk-bg p-4 text-[13px] leading-5 text-wk-text-muted">
          No uncertainty has been named yet. Add the missing questions before this Inquiry moves forward.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => {
            const tone = instituteToneClasses(item.tone ?? "neutral");
            return (
              <article key={item.label} className={cx("rounded-2xl border p-4", tone.panel)}>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-wk-text-muted">{item.label}</div>
                {item.value ? <div className="mt-2 text-xl font-black text-wk-text">{item.value}</div> : null}
                {item.description ? <p className="mt-2 text-[13px] leading-5 text-wk-text-muted">{item.description}</p> : null}
              </article>
            );
          })}
        </div>
      )}
    </InstituteSectionCard>
  );
}
