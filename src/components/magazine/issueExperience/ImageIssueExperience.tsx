import { IssueOpening } from './IssueOpening';
import { IssuePath } from './IssuePath';
import { IssueSignalBoard } from './IssueSignalBoard';
import { IssueBackMatter } from './IssueBackMatter';
import type { IssueExperienceComponentProps } from './IssueExperienceShell';

type ImageArticle = IssueExperienceComponentProps['issue']['articles'][number] & { heroUrl: string };

function hasHeroImage(article: IssueExperienceComponentProps['issue']['articles'][number]): article is ImageArticle {
  return Boolean(article.heroUrl);
}

export function ImageIssueExperience(props: IssueExperienceComponentProps) {
  const { issue, experience } = props;
  const images = issue.articles.filter(hasHeroImage).slice(0, 4);

  return (
    <div className="mag-issue-experience mag-issue-experience-image">
      <IssueOpening issue={issue} experience={experience} eyebrow="Image issue" />
      <section className="mag-issue-zone mag-reveal mag-image-room" id={`${issue.id}-look-first`}>
        {images.map((article) => (
          <a key={article.slug} href={`/magazine/${article.slug}`} className="mag-image-room-card">
            <img src={article.heroUrl} alt={article.title} loading="lazy" />
            <span>
              <small>Look first</small>
              <strong>{article.title}</strong>
            </span>
          </a>
        ))}
      </section>
      <IssuePath issue={issue} experience={experience} />
      <IssueSignalBoard issue={issue} experience={experience} />
      <IssueBackMatter {...props} />
    </div>
  );
}
