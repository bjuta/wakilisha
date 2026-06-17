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
  return (
    <section className="mag-issue-zone mag-reveal mag-issue-back-matter" id={`${issue.id}-back-matter`}>
      <div className="mag-exit-room">
        <div className="magazine-meta">Leave through this</div>
        <h2 className="mag-back-title">{experience.backMatterLine}</h2>
        <p>{experience.archiveBlurb}</p>
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
