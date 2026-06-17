import { IssueOpening } from './IssueOpening';
import { IssuePath } from './IssuePath';
import { IssueSignalBoard } from './IssueSignalBoard';
import { IssueBackMatter } from './IssueBackMatter';
import type { IssueExperienceComponentProps } from './IssueExperienceShell';

export function MixedIssueExperience(props: IssueExperienceComponentProps) {
  const { issue, experience } = props;
  return (
    <div className="mag-issue-experience mag-issue-experience-mixed">
      <IssueOpening issue={issue} experience={experience} eyebrow="Mixed culture issue" />
      <section className="magazine-spread mag-reveal mag-spread-grid-manifesto" id={`${issue.id}-constellation`}>
        <div className="mag-grid-manifesto-cell featured">
          <div>
            <div className="magazine-meta">Constellation</div>
            <div style={{ fontFamily: 'var(--mag-display)' }}>{experience.readerPromise}</div>
          </div>
        </div>
        {issue.articles.slice(0, 8).map((article) => (
          <a key={article.slug} href={`/magazine/${article.slug}`} className="mag-grid-manifesto-cell">
            <span>{article.title}</span>
          </a>
        ))}
      </section>
      <IssuePath issue={issue} experience={experience} />
      <IssueSignalBoard issue={issue} experience={experience} />
      <IssueBackMatter {...props} />
    </div>
  );
}
