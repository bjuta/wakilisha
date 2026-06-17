import { Link } from 'react-router-dom';
import { IssueOpening } from './IssueOpening';
import { IssuePath } from './IssuePath';
import { IssueSignalBoard } from './IssueSignalBoard';
import { IssueBackMatter } from './IssueBackMatter';
import type { IssueExperienceComponentProps } from './IssueExperienceShell';

export function SystemsIssueExperience(props: IssueExperienceComponentProps) {
  const { issue, experience } = props;
  const claims = issue.articles.slice(0, 3);

  return (
    <div className="mag-issue-experience mag-issue-experience-systems">
      <IssueOpening issue={issue} experience={experience} eyebrow="Systems issue" />
      <section className="mag-issue-zone mag-reveal mag-experience-room mag-systems-room" id={`${issue.id}-under-the-hood`}>
        <div className="mag-room-inner">
          <div className="magazine-meta">Look under the hood</div>
          <h2>Rights, platforms, money, rules and the beautiful work caught inside them.</h2>
          <p>{experience.readerPromise}</p>
          <div className="mag-claim-grid" aria-label="Claims and receipts in this issue">
            {claims.map((article) => {
              const section = article.section || article.canonicalSection || 'culture';
              return (
                <details className="mag-claim-card" key={article.slug}>
                  <summary>
                    <span className="mag-claim-chip">Claim</span>
                    <strong>{article.title}</strong>
                  </summary>
                  <p>{article.dek || `Follow this piece to see how the ${section.toLowerCase()} thread works underneath.`}</p>
                  <Link to={`/magazine/${article.slug}`}>Open the receipt</Link>
                </details>
              );
            })}
          </div>
        </div>
      </section>
      <IssuePath issue={issue} experience={experience} />
      <IssueSignalBoard issue={issue} experience={experience} />
      <IssueBackMatter {...props} />
    </div>
  );
}
