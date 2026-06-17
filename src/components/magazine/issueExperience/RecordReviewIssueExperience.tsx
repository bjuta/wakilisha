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
      <section className="magazine-spread mag-reveal" id={`${issue.id}-record-stack`}>
        <div className="mag-reviews">
          {records.map((article, index) => (
            <a className="mag-review-row" key={article.slug} href={`/magazine/${article.slug}`}>
              {article.heroUrl && <img src={article.heroUrl} alt="" loading="lazy" />}
              <span>
                <b>{article.title}</b>
                <br />
                <small>{article.author}</small>
              </span>
              <span className="magazine-meta" style={{ color: 'var(--mag-accent)' }}>
                {String(index + 1).padStart(2, '0')}
              </span>
            </a>
          ))}
        </div>
      </section>
      <IssuePath issue={issue} experience={experience} />
      <IssueSignalBoard issue={issue} experience={experience} />
      <IssueBackMatter {...props} />
    </div>
  );
}
