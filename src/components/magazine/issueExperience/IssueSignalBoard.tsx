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
    <section className="magazine-spread mag-reveal mag-issue-signal-board" id={`${issue.id}-signal-board`}>
      <div className="mag-signal">
        <div className="mag-rail magazine-meta">
          <span>{experience.archetypeLabel}</span>
          <span>{experience.interactionPattern}</span>
        </div>
        <div className="mag-signal-head">
          <h2>{experience.signalTitle}</h2>
        </div>
        <div className="mag-signal-lead">
          <div className="mag-signal-big">{articles.length}</div>
          <div className="mag-signal-text">{experience.signalDeck}</div>
        </div>
        <p style={{ color: 'var(--mag-text-soft)', fontSize: 17, lineHeight: 1.6, maxWidth: 720 }}>
          {experience.signalReading}
        </p>
        <div className="mag-signal-grid">
          <div>
            {articles.map((article, index) => (
              <Link className="mag-chart-row" key={article.slug} to={`/magazine/${article.slug}`}>
                <span className="rank">{String(index + 1).padStart(2, '0')}</span>
                <span>
                  <h4>{article.title}</h4>
                  <p>{article.section} · {article.author}</p>
                </span>
                <span className="magazine-meta" style={{ color: 'var(--mag-accent)' }}>
                  {article.role}
                </span>
              </Link>
            ))}
          </div>
          <div className="mag-finding">
            <h4>Why this issue exists</h4>
            <p>{experience.readerPromise}</p>
            <h4 style={{ marginTop: 20 }}>How to read it</h4>
            <p>{experience.visualPromise}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
