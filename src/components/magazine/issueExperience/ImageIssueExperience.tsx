import { IssueOpening } from './IssueOpening';
import { IssuePath } from './IssuePath';
import { IssueSignalBoard } from './IssueSignalBoard';
import { IssueBackMatter } from './IssueBackMatter';
import type { IssueExperienceComponentProps } from './IssueExperienceShell';

export function ImageIssueExperience(props: IssueExperienceComponentProps) {
  const { issue, experience } = props;
  const images = issue.articles.filter((article) => article.heroUrl).slice(0, 4);

  return (
    <div className="mag-issue-experience mag-issue-experience-image">
      <IssueOpening issue={issue} experience={experience} eyebrow="Image issue" />
      <section className="magazine-spread mag-reveal mag-spread-photo-essay" id={`${issue.id}-look-first`}>
        {images.map((article) => (
          <a key={article.slug} href={`/magazine/${article.slug}`} className="relative overflow-hidden block" style={{ minHeight: '50vh' }}>
            <img src={article.heroUrl} alt={article.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 28, background: 'linear-gradient(transparent, rgba(0,0,0,.75))', color: '#fff' }}>
              <div className="magazine-meta">Look first</div>
              <h4 style={{ fontFamily: 'var(--mag-display)', fontSize: 24, lineHeight: 1.1 }}>{article.title}</h4>
            </div>
          </a>
        ))}
      </section>
      <IssuePath issue={issue} experience={experience} />
      <IssueSignalBoard issue={issue} experience={experience} />
      <IssueBackMatter {...props} />
    </div>
  );
}
