import { Link } from 'react-router-dom';
import { IssueOpening } from './IssueOpening';
import { IssuePath } from './IssuePath';
import { IssueSignalBoard } from './IssueSignalBoard';
import { IssueBackMatter } from './IssueBackMatter';
import type { IssueExperienceComponentProps } from './IssueExperienceShell';

export function ListeningIssueExperience(props: IssueExperienceComponentProps) {
  const { issue, experience } = props;
  const listeningRail = issue.articles.slice(0, 5);

  return (
    <div className="mag-issue-experience mag-issue-experience-listening">
      <IssueOpening issue={issue} experience={experience} eyebrow="Listening issue" />
      <section className="mag-issue-zone mag-reveal mag-experience-room mag-listening-room" id={`${issue.id}-listen-first`}>
        <div className="mag-room-inner">
          <div className="mag-audio-pulse" aria-hidden="true"><span /><span /><span /></div>
          <div className="magazine-meta">Start with the sound</div>
          <h2>The issue opens by ear.</h2>
          <p>{experience.visualPromise}</p>
          <div className="mag-listening-rail" aria-label="Listening path">
            {listeningRail.map((article) => (
              <Link to={`/magazine/${article.slug}`} key={article.slug} className="mag-playable-link">
                <span className="mag-play-icon" aria-hidden="true">▶</span>
                <span>{article.title}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <IssuePath issue={issue} experience={experience} />
      <IssueSignalBoard issue={issue} experience={experience} />
      <IssueBackMatter {...props} />
    </div>
  );
}
