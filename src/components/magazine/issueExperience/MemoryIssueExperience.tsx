import { IssueOpening } from './IssueOpening';
import { IssuePath } from './IssuePath';
import { IssueSignalBoard } from './IssueSignalBoard';
import { IssueBackMatter } from './IssueBackMatter';
import type { IssueExperienceComponentProps } from './IssueExperienceShell';

export function MemoryIssueExperience(props: IssueExperienceComponentProps) {
  const { issue, experience } = props;
  return (
    <div className="mag-issue-experience mag-issue-experience-memory">
      <IssueOpening issue={issue} experience={experience} eyebrow="Memory issue" />
      <section className="magazine-spread mag-reveal mag-quote-only" id={`${issue.id}-memory-fragments`}>
        <div className="mag-quote-inner">
          <div className="magazine-meta">What refuses to disappear</div>
          <blockquote>{experience.readerPromise}</blockquote>
          <p>{experience.visualPromise}</p>
        </div>
      </section>
      <IssuePath issue={issue} experience={experience} />
      <IssueSignalBoard issue={issue} experience={experience} />
      <IssueBackMatter {...props} />
    </div>
  );
}
