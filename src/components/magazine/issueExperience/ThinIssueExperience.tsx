import { IssueOpening } from './IssueOpening';
import { IssuePath } from './IssuePath';
import { IssueBackMatter } from './IssueBackMatter';
import type { IssueExperienceComponentProps } from './IssueExperienceShell';

export function ThinIssueExperience(props: IssueExperienceComponentProps) {
  const { issue, experience } = props;
  return (
    <div className="mag-issue-experience mag-issue-experience-thin">
      <IssueOpening issue={issue} experience={experience} eyebrow="Short issue" />
      <section className="mag-issue-zone mag-reveal mag-experience-room mag-short-thread-room" id={`${issue.id}-short-thread`}>
        <div className="mag-room-inner">
          <div className="magazine-meta">One clear thread</div>
          <p className="mag-note-open">{experience.readerPromise}</p>
          <p>{experience.visualPromise}</p>
          <p>{experience.searchSnippet}</p>
        </div>
      </section>
      <IssuePath issue={issue} experience={experience} />
      <IssueBackMatter {...props} />
    </div>
  );
}
