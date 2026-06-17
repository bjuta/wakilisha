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
      <section className="magazine-spread mag-reveal" id={`${issue.id}-under-the-hood`}>
        <div className="mag-signal">
          <div className="magazine-meta">Look under the hood</div>
          <div className="mag-signal-head">
            <h2>Rights, platforms, money, rules and the beautiful work caught inside them.</h2>
          </div>
          <p>{experience.readerPromise}</p>
        </div>
      </section>
      <IssuePath issue={issue} experience={experience} />
      <IssueSignalBoard issue={issue} experience={experience} />
      <IssueBackMatter {...props} />
    </div>
  );
}
