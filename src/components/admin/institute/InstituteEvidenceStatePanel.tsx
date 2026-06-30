import type { InstituteInsightItem } from "./instituteExperienceTypes";
import { cx, instituteToneClasses } from "./instituteExperienceStyles";
import { InstituteSectionCard } from "./InstituteSectionCard";

export function InstituteEvidenceStatePanel({
  items = [],
}: {
  items?: InstituteInsightItem[];
}) {
  return (
    <InstituteSectionCard
      eyebrow="Evidence"
      title="What evidence state are we carrying?"
      description="Evidence should make overclaiming harder, not easier."
    >
      {items.length === 0 ? (
        <p className="rounded-2xl border border-wk-border bg-wk-bg p-4 text-[13px] leading-5 text-wk-text-muted">
          No evidence has been attached yet. The next move is to find a source, memory, or test that can be reviewed.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {items.map((item) => {
            const tone = instituteToneClasses(item.tone ?? "neutral");
            return (
              <article key={item.label} className={cx("rounded-2xl border p-3 sm:p-4", tone.panel)}>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-wk-text-muted">{item.label}</div>
                {item.value !== undefined && item.value !== null ? <div className="mt-2 text-2xl font-black text-wk-text">{item.value}</div> : null}
                {item.description ? <p className="mt-2 text-[13px] leading-5 text-wk-text-muted">{item.description}</p> : null}
              </article>
            );
          })}
        </div>
      )}
    </InstituteSectionCard>
  );
}
