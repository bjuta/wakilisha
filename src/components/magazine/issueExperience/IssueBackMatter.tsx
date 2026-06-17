import { Link } from 'react-router-dom';
import type { MagazineIssue } from '@/services/magazineIssues';
import type { MagazineIssueExperience } from '@/services/magazineIssueEngine';

type IssueBackMatterProps = {
  issue: MagazineIssue;
  experience: MagazineIssueExperience;
  previousHref?: string;
  previousLabel?: string;
  nextHref?: string;
  nextLabel?: string;
};

export function IssueBackMatter({ issue, experience, previousHref, previousLabel, nextHref, nextLabel }: IssueBackMatterProps) {
  const nextMoves = issue.articles.slice(1, 4);

  return (
    <section className="mag-issue-zone mag-reveal mag-issue-back-matter" id={`${issue.id}-back-matter`}>
      <div className="mag-exit-room">
        <div className="magazine-meta">Leave through this</div>
        <h2 className="mag-back-title">{experience.backMatterLine}</h2>
        <p>{experience.archiveBlurb}</p>

        {nextMoves.length > 0 && (
          <div className="mag-next-moves" aria-label="Where to go next">
            <span className="mag-route-step-label">Where next?</span>
            {nextMoves.map((article) => (
              <Link to={`/magazine/${article.slug}`} key={article.slug} className="mag-next-move-card">
                <strong>{article.title}</strong>
                <small>{article.section}</small>
              </Link>
            ))}
          </div>
        )}

        <div className="mag-issue-jump" style={{ marginTop: 36 }}>
          <span>{previousHref && <Link to={previousHref}>Previous: {previousLabel ?? 'previous issue'}</Link>}</span>
          <span>{nextHref && <Link to={nextHref}>Next: {nextLabel ?? 'next issue'}</Link>}</span>
        </div>
        <div className="magazine-meta" style={{ color: 'var(--mag-accent)', marginTop: 24 }}>
          Your people are here.
        </div>
      </div>
    </section>
  );
}
