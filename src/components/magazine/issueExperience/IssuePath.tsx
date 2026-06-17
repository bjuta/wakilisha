import { Link } from 'react-router-dom';
import type { MagazineIssue } from '@/services/magazineIssues';
import type { MagazineIssueExperience } from '@/services/magazineIssueEngine';

type IssuePathProps = {
  issue: MagazineIssue;
  experience: MagazineIssueExperience;
};

export function IssuePath({ issue, experience }: IssuePathProps) {
  return (
    <section className="magazine-spread mag-reveal mag-issue-path" id={`${issue.id}-path`}>
      <div className="mag-toc">
        <div className="magazine-meta">The path through {issue.issueLabel}</div>
        <h2 className="mag-toc-title">{experience.contentsTitle}</h2>
        <p className="mag-toc-hero">{experience.contentsIntro}</p>

        <div className="mag-toc-cols">
          {experience.readingPath.map((step, index) => (
            <div className="mag-toc-block" key={step.id}>
              <h3>
                <span style={{ color: 'var(--mag-accent)', fontStyle: 'normal' }}>
                  {String(index + 1).padStart(2, '0')}
                </span>{' '}
                {step.label}
              </h3>
              {step.articleSlug ? (
                <Link className="mag-toc-line" to={`/magazine/${step.articleSlug}`}>
                  <span>{step.title}</span>
                  <span className="pg">Open</span>
                </Link>
              ) : (
                <div className="mag-toc-line">
                  <span>{step.title}</span>
                  <span className="pg">Read</span>
                </div>
              )}
              <p style={{ color: 'var(--mag-text-muted)', fontSize: 13, lineHeight: 1.5, marginTop: 10 }}>
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
