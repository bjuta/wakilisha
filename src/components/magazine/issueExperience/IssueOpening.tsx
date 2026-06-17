import { Link } from 'react-router-dom';
import type { MagazineIssue } from '@/services/magazineIssues';
import type { MagazineIssueExperience } from '@/services/magazineIssueEngine';

type IssueOpeningProps = {
  issue: MagazineIssue;
  experience: MagazineIssueExperience;
  eyebrow?: string;
};

export function IssueOpening({ issue, experience, eyebrow }: IssueOpeningProps) {
  const lead = issue.articles[0];
  const coverImage = issue.articles.find((article) => article.heroUrl)?.heroUrl;

  return (
    <section className="magazine-spread mag-reveal mag-issue-opening" id={`${issue.id}-opening`}>
      {coverImage && <img className="mag-cover-trace" src={coverImage} alt="" loading="eager" />}
      <div className="mag-cover-inner">
        <div className="mag-cover-masthead">
          <div className="magazine-meta">WAKILISHA Magazine</div>
          <div className="magazine-meta">{issue.issueLabel}</div>
        </div>

        <div className="mag-cover-center">
          <div className="mag-cover-eyebrow magazine-meta">
            {eyebrow ?? experience.archetypeLabel}
          </div>
          <h1 className="mag-cover-title">{issue.title}</h1>
          <p className="mag-cover-deck">{experience.coverLine || issue.deck}</p>
          <p className="mag-note-open" style={{ marginTop: 24 }}>
            {experience.readerPromise}
          </p>
        </div>

        <div className="mag-cover-foot">
          <div className="mag-cover-bills">
            {issue.articles.slice(0, 4).map((article, index) => (
              <Link key={article.slug} to={`/magazine/${article.slug}`} className="mag-cover-bill">
                <span className="n magazine-meta">{String(index + 1).padStart(2, '0')}</span>
                <span>{article.title}</span>
              </Link>
            ))}
          </div>
          {lead && (
            <Link to={`/magazine/${lead.slug}`} className="mag-cover-coords magazine-meta">
              {experience.issueCta}
              <br />Start with {lead.title}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
