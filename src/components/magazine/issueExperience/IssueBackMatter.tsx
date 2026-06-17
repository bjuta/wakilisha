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
    <section className="magazine-spread mag-reveal mag-issue-back-matter" id={`${issue.id}-back-matter`}>
      <div className="mag-back">
        <div className="magazine-meta">End note · {issue.issueLabel}</div>
        <h2 className="mag-back-title">{experience.backMatterLine}</h2>
        <p>{experience.archiveBlurb}</p>
        <div className="mag-nav" style={{ marginTop: 36 }}>
          <span>{previousHref && <Link to={previousHref}>← {previousLabel ?? 'Previous issue'}</Link>}</span>
          <span>{nextHref && <Link to={nextHref}>{nextLabel ?? 'Next issue'} →</Link>}</span>
        </div>
        <div className="magazine-meta" style={{ color: 'var(--mag-accent)', marginTop: 24 }}>
          WAKILISHA.AFRICA
        </div>
      </div>
    </section>
  );
}
