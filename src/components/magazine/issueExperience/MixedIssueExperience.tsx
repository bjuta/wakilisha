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
      <section className="mag-issue-zone mag-reveal mag-constellation-room" id={`${issue.id}-constellation`}>
        <div className="mag-constellation-lead">
          <div className="magazine-meta">Constellation</div>
          <p>{experience.readerPromise}</p>
        </div>
        {issue.articles.slice(0, 8).map((article) => (
          <a key={article.slug} href={`/magazine/${article.slug}`} className="mag-constellation-card">
            <span>{article.section}</span>
            <strong>{article.title}</strong>
          </a>
        ))}
      </section>
      <IssuePath issue={issue} experience={experience} />
      <IssueSignalBoard issue={issue} experience={experience} />
      <IssueBackMatter {...props} />
    </div>
  );
}
