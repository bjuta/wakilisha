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
  const entryPoints = issue.articles.slice(0, 4);

  return (
    <section className="mag-issue-zone mag-reveal mag-issue-opening" id={`${issue.id}-opening`}>
      {coverImage && <img className="mag-cover-trace" src={coverImage} alt="" loading="eager" />}
      <div className="mag-entry-inner">
        <div className="mag-entry-kicker">
          <span>{eyebrow ?? experience.archetypeLabel}</span>
          <span>{issue.issueLabel}</span>
        </div>

        <div className="mag-entry-center">
          <div className="mag-entry-eyebrow magazine-meta">{experience.issueCta}</div>
          <h1 className="mag-cover-title">{issue.title}</h1>
          <p className="mag-cover-deck">{experience.coverLine || issue.deck}</p>
          <p className="mag-note-open" style={{ marginTop: 24 }}>
            {experience.readerPromise}
          </p>
        </div>

        <div className="mag-entry-footer">
          <div className="mag-entry-grid" aria-label="Entry points into this issue">
            {entryPoints.map((article) => (
              <Link key={article.slug} to={`/magazine/${article.slug}`} className="mag-entry-card">
                <span className="mag-entry-card-label">Enter here</span>
                <span>{article.title}</span>
              </Link>
            ))}
          </div>
          {lead && (
            <Link to={`/magazine/${lead.slug}`} className="mag-entry-start">
              <span>{experience.issueCta}</span>
              <strong>Start with {lead.title}</strong>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
