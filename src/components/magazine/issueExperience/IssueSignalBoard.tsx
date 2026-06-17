import { Link } from 'react-router-dom';
import type { MagazineIssue, MagazineIssueArticle } from '@/services/magazineIssues';
import type { MagazineIssueExperience } from '@/services/magazineIssueEngine';

type IssueSignalBoardProps = {
  issue: MagazineIssue;
  experience: MagazineIssueExperience;
};

function whyIncluded(article: MagazineIssueArticle, experience: MagazineIssueExperience) {
  if (article.dek) return article.dek;
  if (article.role === 'core') return 'This is one of the pieces holding the issue together.';
  if (article.canonicalSection) return `This keeps the ${article.canonicalSection.toLowerCase()} thread alive.`;
  return experience.readerPromise;
}

export function IssueSignalBoard({ issue, experience }: IssueSignalBoardProps) {
  const articles = issue.articles.slice(0, 12);
  const signalChips = Array.from(new Set(articles.map((article) => article.canonicalSection || article.section).filter(Boolean))).slice(0, 5);

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

        <div className="mag-current-signal" aria-label="Current issue signals">
          {signalChips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>

        <div className="mag-signal-grid">
          <div className="mag-signal-stack">
            {articles.map((article) => (
              <Link className="mag-signal-card mag-meaning-card" key={article.slug} to={`/magazine/${article.slug}`}>
                <span className="mag-signal-dot" aria-hidden="true" />
                <span>
                  <h4>{article.title}</h4>
                  <p>{article.section} · {article.author}</p>
                  <span className="mag-card-why">{whyIncluded(article, experience)}</span>
                </span>
                <span className="mag-signal-card-action">Open</span>
              </Link>
            ))}
          </div>
          <aside className="mag-room-note mag-context-chip-room">
            <h4>Why this issue exists</h4>
            <p>{experience.readerPromise}</p>
            <h4>How to move through it</h4>
            <p>{experience.visualPromise}</p>
            <div className="mag-context-chips" aria-label="Issue context">
              <span>{experience.issueCta}</span>
              <span>{experience.archetypeLabel}</span>
              <span>{issue.articles.length} stories</span>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
