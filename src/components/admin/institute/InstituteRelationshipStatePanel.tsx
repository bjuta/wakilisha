import type { InstituteInsightItem } from "./instituteExperienceTypes";
import { InstituteSectionCard } from "./InstituteSectionCard";
import { InstituteStatusExplainer } from "./InstituteStatusExplainer";

export function InstituteRelationshipStatePanel({
  items = [],
}: {
  items?: InstituteInsightItem[];
}) {
  return (
    <InstituteSectionCard
      eyebrow="Relationships"
      title="What does this connect?"
      description="A relationship needs reason, evidence, confidence, and review before it can carry public meaning."
    >
      {items.length === 0 ? (
        <p className="rounded-2xl border border-wk-border bg-wk-bg p-4 text-[13px] leading-5 text-wk-text-muted">
          No relationships are attached yet. Name the connection only when it helps someone understand the Inquiry.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <InstituteStatusExplainer key={item.label} label={`${item.label}${item.value ? `: ${item.value}` : ""}`} description={item.description} tone={item.tone} />
          ))}
        </div>
      )}
    </InstituteSectionCard>
  );
}
