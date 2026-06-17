import { Link } from 'react-router-dom';
import type { MagazineIssue } from '@/services/magazineIssues';
import type { MagazineIssueExperience } from '@/services/magazineIssueEngine';

type IssueSignalBoardProps = {
  issue: MagazineIssue;
  experience: MagazineIssueExperience;
};

export function IssueSignalBoard({ issue, experience }: IssueSignalBoardProps) {
  const articles = issue.articles.slice(0, 12);

  return (
    <section className="mag-issue-zone mag-reveal mag-issue-signal-board" id={`${issue.id}-signal-board`}>
      <div className="mag-signal-room">
        <div className="mag-signal-rail magazine-meta">
          <span>{experience.archetypeLabel}</span>
          <span>{experience.issueCta}</span>
        </div>
        <div className="mag-signal-head">
          <h2>{experience.signalTitle}</h2>
          <p>{experience.signalDeck}</p>
        </div>
        <p className="mag-signal-reading">{experience.signalReading}</p>

        <div className="mag-signal-grid">
          <div className="mag-signal-stack">
            {articles.map((article) => (
              <Link className="mag-signal-card" key={article.slug} to={`/magazine/${article.slug}`}>
                <span>
                  <h4>{article.title}</h4>
                  <p>{article.section} · {article.author}</p>
                </span>
                <span className="mag-signal-card-action">Open</span>
              </Link>
            ))}
          </div>
          <aside className="mag-room-note">
            <h4>Why this issue exists</h4>
            <p>{experience.readerPromise}</p>
            <h4>How to move through it</h4>
            <p>{experience.visualPromise}</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
