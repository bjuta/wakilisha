import { Link } from 'react-router-dom';
import type { MagazineIssue } from '@/services/magazineIssues';
import type { MagazineIssueExperience } from '@/services/magazineIssueEngine';

type IssuePathProps = {
  issue: MagazineIssue;
  experience: MagazineIssueExperience;
};

export function IssuePath({ issue, experience }: IssuePathProps) {
  return (
    <section className="mag-issue-zone mag-reveal mag-issue-path" id={`${issue.id}-path`}>
      <div className="mag-route">
        <div className="mag-route-head">
          <div className="magazine-meta">Choose your route</div>
          <h2 className="mag-route-title">{experience.contentsTitle}</h2>
          <p className="mag-route-intro">{experience.contentsIntro}</p>
        </div>

        <div className="mag-route-grid">
          {experience.readingPath.map((step) => {
            const body = (
              <>
                <span className="mag-route-step-label">{step.label}</span>
                <strong>{step.title}</strong>
                <p>{step.description}</p>
                <span className="mag-route-action">{step.articleSlug ? 'Open this thread' : 'Hold this thought'}</span>
              </>
            );

            return step.articleSlug ? (
              <Link className="mag-route-step" to={`/magazine/${step.articleSlug}`} key={step.id}>
                {body}
              </Link>
            ) : (
              <div className="mag-route-step" key={step.id}>
                {body}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
