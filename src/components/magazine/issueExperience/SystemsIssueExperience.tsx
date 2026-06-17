import { IssueOpening } from './IssueOpening';
import { IssuePath } from './IssuePath';
import { IssueSignalBoard } from './IssueSignalBoard';
import { IssueBackMatter } from './IssueBackMatter';
import type { IssueExperienceComponentProps } from './IssueExperienceShell';

export function SystemsIssueExperience(props: IssueExperienceComponentProps) {
  const { issue, experience } = props;
  return (
    <div className="mag-issue-experience mag-issue-experience-systems">
      <IssueOpening issue={issue} experience={experience} eyebrow="Systems issue" />
      <section className="mag-issue-zone mag-reveal mag-experience-room mag-systems-room" id={`${issue.id}-under-the-hood`}>
        <div className="mag-room-inner">
          <div className="magazine-meta">Look under the hood</div>
          <h2>Rights, platforms, money, rules and the beautiful work caught inside them.</h2>
          <p>{experience.readerPromise}</p>
        </div>
      </section>
      <IssuePath issue={issue} experience={experience} />
      <IssueSignalBoard issue={issue} experience={experience} />
      <IssueBackMatter {...props} />
    </div>
  );
}
