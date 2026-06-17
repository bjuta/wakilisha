import { IssueOpening } from './IssueOpening';
import { IssuePath } from './IssuePath';
import { IssueSignalBoard } from './IssueSignalBoard';
import { IssueBackMatter } from './IssueBackMatter';
import type { IssueExperienceComponentProps } from './IssueExperienceShell';

export function ArgumentIssueExperience(props: IssueExperienceComponentProps) {
  const { issue, experience } = props;
  return (
    <div className="mag-issue-experience mag-issue-experience-argument">
      <IssueOpening issue={issue} experience={experience} eyebrow="Argument issue" />
      <section className="mag-issue-zone mag-reveal mag-experience-room mag-argument-room" id={`${issue.id}-open-the-argument`}>
        <div className="mag-room-inner">
          <div className="magazine-meta">Open the argument</div>
          <h2>This issue has a raised eyebrow.</h2>
          <p>{experience.readerPromise}</p>
        </div>
      </section>
      <IssuePath issue={issue} experience={experience} />
      <IssueSignalBoard issue={issue} experience={experience} />
      <IssueBackMatter {...props} />
    </div>
  );
}
