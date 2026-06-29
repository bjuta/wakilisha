import type { InstituteInsightItem } from "./instituteExperienceTypes";
import { InstituteSectionCard } from "./InstituteSectionCard";
import { InstituteStatusExplainer } from "./InstituteStatusExplainer";

export function InstituteContributionStatePanel({
  items = [],
}: {
  items?: InstituteInsightItem[];
}) {
  return (
    <InstituteSectionCard
      eyebrow="Contribution"
      title="What memory has someone offered?"
      description="Treat contributors as people helping the Institute remember, not as rows waiting for processing."
    >
      {items.length === 0 ? (
        <p className="rounded-2xl border border-wk-border bg-wk-bg p-4 text-[13px] leading-5 text-wk-text-muted">
          No contributor memory is attached yet. Ask what someone knows, how they know it, and how WAKILISHA may use it.
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
