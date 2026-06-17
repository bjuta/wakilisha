import { Link } from 'react-router-dom';
import type { MagazineIssue } from '@/services/magazineIssues';
import type { MagazineIssueExperience } from '@/services/magazineIssueEngine';

type IssuePathProps = {
  issue: MagazineIssue;
  experience: MagazineIssueExperience;
};

export function IssuePath({ issue, experience }: IssuePathProps) {
  const totalSteps = Math.max(experience.readingPath.length - 1, 1);

  return (
    <section className="mag-issue-zone mag-reveal mag-issue-path" id={`${issue.id}-path`}>
      <div className="mag-route">
        <div className="mag-route-head">
          <div className="magazine-meta">Choose your route</div>
          <h2 className="mag-route-title">{experience.contentsTitle}</h2>
          <p className="mag-route-intro">{experience.contentsIntro}</p>
          <div className="mag-path-progress" aria-hidden="true">
            <span style={{ width: `${Math.min(100, experience.readingPath.length * 22)}%` }} />
          </div>
        </div>

        <div className="mag-route-grid mag-route-builds">
          {experience.readingPath.map((step, index) => {
            const body = (
              <>
                <span className="mag-route-step-label">{step.label}</span>
                <strong>{step.title}</strong>
                <p>{step.description}</p>
                <span className="mag-route-action">{step.articleSlug ? 'Open this thread' : 'Hold this thought'}</span>
                <span className="mag-route-reveal">Follow this because it carries step {index + 1} of the issue path.</span>
              </>
            );

            const style = { '--path-step-progress': `${Math.round((index / totalSteps) * 100)}%` } as React.CSSProperties;

            return step.articleSlug ? (
              <Link className="mag-route-step mag-meaning-card" to={`/magazine/${step.articleSlug}`} key={step.id} style={style}>
                {body}
              </Link>
            ) : (
              <div className="mag-route-step mag-meaning-card" key={step.id} style={style}>
                {body}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
