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
      <section className="magazine-spread mag-reveal" id={`${issue.id}-carry-this`}>
        <div className="mag-guide">
          <div className="mag-guide-hero">
            <div>
              <div className="magazine-meta">Carry this one</div>
              <h2 className="mag-guide-title">A route through what to notice, where to begin and what to keep close.</h2>
            </div>
          </div>
          <div className="mag-guide-body">
            <p>{experience.readerPromise}</p>
          </div>
        </div>
      </section>
      <IssuePath issue={issue} experience={experience} />
      <IssueSignalBoard issue={issue} experience={experience} />
      <IssueBackMatter {...props} />
    </div>
  );
}
