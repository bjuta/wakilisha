import { Link } from 'react-router-dom';
import { IssueOpening } from './IssueOpening';
import { IssuePath } from './IssuePath';
import { IssueSignalBoard } from './IssueSignalBoard';
import { IssueBackMatter } from './IssueBackMatter';
import type { IssueExperienceComponentProps } from './IssueExperienceShell';

export function MemoryIssueExperience(props: IssueExperienceComponentProps) {
  const { issue, experience } = props;
  const fragments = issue.articles.slice(0, 4);
  const leadImage = fragments.find((article) => article.heroUrl)?.heroUrl;

  return (
    <div className="mag-issue-experience mag-issue-experience-memory">
      <IssueOpening issue={issue} experience={experience} eyebrow="Memory issue" />
      <section className="mag-issue-zone mag-reveal mag-experience-room mag-memory-room" id={`${issue.id}-memory-fragments`}>
        <div className="mag-room-inner mag-layered-memory">
          {leadImage && <img src={leadImage} alt="" className="mag-memory-layer-image" loading="lazy" />}
          <div className="magazine-meta">What refuses to disappear</div>
          <blockquote>{experience.readerPromise}</blockquote>
          <p>{experience.visualPromise}</p>
          <div className="mag-fragment-grid" aria-label="Memory fragments in this issue">
            {fragments.map((article) => (
              <Link to={`/magazine/${article.slug}`} className="mag-fragment-card" key={article.slug}>
                <span>{article.section}</span>
                <strong>{article.title}</strong>
                <p>{article.dek || 'A fragment worth holding before it disappears into the noise.'}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <IssuePath issue={issue} experience={experience} />
      <IssueSignalBoard issue={issue} experience={experience} />
      <IssueBackMatter {...props} />
    </div>
  );
}
