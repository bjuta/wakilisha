import type { ReactNode } from "react";
import type { InstituteBadgeItem } from "./instituteExperienceTypes";
import { InstituteSectionCard } from "./InstituteSectionCard";
import { InstituteStatusExplainer } from "./InstituteStatusExplainer";

export function InstituteQuestionPanel({
  question,
  whyItMatters,
  shortQuestion,
  badges = [],
  children,
}: {
  question: string;
  whyItMatters?: string | null;
  shortQuestion?: string | null;
  badges?: InstituteBadgeItem[];
  children?: ReactNode;
}) {
  return (
    <InstituteSectionCard
      eyebrow="Question"
      title="What are we trying to understand?"
      description="Begin with the question before adding notes, sources, or relationships."
    >
      {shortQuestion ? <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-wk-brand">{shortQuestion}</div> : null}
      <p className="mt-2 text-2xl font-black leading-tight text-wk-text">{question}</p>
      {whyItMatters ? <p className="mt-3 max-w-3xl text-[14px] leading-6 text-wk-text-muted">{whyItMatters}</p> : null}
      {badges.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {badges.map((badge) => (
            <InstituteStatusExplainer key={badge.label} label={badge.label} description={badge.description} tone={badge.tone} />
          ))}
        </div>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </InstituteSectionCard>
  );
}
