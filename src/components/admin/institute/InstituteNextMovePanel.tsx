import type { InstituteActionItem } from "./instituteExperienceTypes";
import { InstituteActionRail } from "./InstituteActionRail";
import { InstituteSectionCard } from "./InstituteSectionCard";

export function InstituteNextMovePanel({
  moves = [],
}: {
  moves?: InstituteActionItem[];
}) {
  return (
    <InstituteSectionCard
      eyebrow="Next move"
      title="What is the next honest move?"
      description="Move the Inquiry forward only when the next action is safe, clear, and reviewable."
    >
      <InstituteActionRail actions={moves} emptyText="No next move is ready yet. Name what is missing before the work continues." />
    </InstituteSectionCard>
  );
}
