import { IssueOpening } from './IssueOpening';
import { IssuePath } from './IssuePath';
import { IssueSignalBoard } from './IssueSignalBoard';
import { IssueBackMatter } from './IssueBackMatter';
import type { IssueExperienceComponentProps } from './IssueExperienceShell';

export function FieldGuideIssueExperience(props: IssueExperienceComponentProps) {
  const { issue, experience } = props;
  return (
    <div className="mag-issue-experience mag-issue-experience-field-guide">
      <IssueOpening issue={issue} experience={experience} eyebrow="Field guide issue" />
      <section className="mag-issue-zone mag-reveal mag-experience-room mag-guide-room" id={`${issue.id}-carry-this`}>
        <div className="mag-room-inner">
          <div className="magazine-meta">Carry this one</div>
          <h2>A route through what to notice, where to begin and what to keep close.</h2>
          <p>{experience.readerPromise}</p>
        </div>
      </section>
      <IssuePath issue={issue} experience={experience} />
      <IssueSignalBoard issue={issue} experience={experience} />
      <IssueBackMatter {...props} />
    </div>
  );
}
