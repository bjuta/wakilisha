import { IssueOpening } from './IssueOpening';
import { IssuePath } from './IssuePath';
import { IssueSignalBoard } from './IssueSignalBoard';
import { IssueBackMatter } from './IssueBackMatter';
import type { IssueExperienceComponentProps } from './IssueExperienceShell';

export function RecordReviewIssueExperience(props: IssueExperienceComponentProps) {
  const { issue, experience } = props;
  const records = issue.articles.slice(0, 5);

  return (
    <div className="mag-issue-experience mag-issue-experience-record-review">
      <IssueOpening issue={issue} experience={experience} eyebrow="Record issue" />
      <section className="mag-issue-zone mag-reveal mag-record-room" id={`${issue.id}-record-stack`}>
        {records.map((article) => (
          <a className="mag-record-card" key={article.slug} href={`/magazine/${article.slug}`}>
            {article.heroUrl && <img src={article.heroUrl} alt="" loading="lazy" />}
            <span>
              <small>{article.author}</small>
              <strong>{article.title}</strong>
            </span>
            <em>Open record</em>
          </a>
        ))}
      </section>
      <IssuePath issue={issue} experience={experience} />
      <IssueSignalBoard issue={issue} experience={experience} />
      <IssueBackMatter {...props} />
    </div>
  );
}
