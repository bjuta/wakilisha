import { IssueOpening } from './IssueOpening';
import { IssuePath } from './IssuePath';
import { IssueBackMatter } from './IssueBackMatter';
import type { IssueExperienceComponentProps } from './IssueExperienceShell';

export function ThinIssueExperience(props: IssueExperienceComponentProps) {
  const { issue, experience } = props;
  return (
    <div className="mag-issue-experience mag-issue-experience-thin">
      <IssueOpening issue={issue} experience={experience} eyebrow="Short issue" />
      <section className="magazine-spread mag-reveal" id={`${issue.id}-short-thread`}>
        <div className="mag-note">
          <aside className="mag-note-side">
            <div className="mag-note-label magazine-meta">One clear thread</div>
          </aside>
          <div>
            <p className="mag-note-open">{experience.readerPromise}</p>
            <div className="mag-note-flow">
              <p>{experience.visualPromise}</p>
              <p>{experience.searchSnippet}</p>
            </div>
          </div>
        </div>
      </section>
      <IssuePath issue={issue} experience={experience} />
      <IssueBackMatter {...props} />
    </div>
  );
}
