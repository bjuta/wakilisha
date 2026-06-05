import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMagazineArticles } from "@/services/magazineArticles";
import { buildMagazineIssues, issueUrl } from "@/services/magazineIssues";
import { SkeletonMagazinePage } from "@/components/skeletons/Skeletons";
import "../issue/magazineIssue.css";

export default function AllIssuesPage() {
  const { articles, loading, error } = useMagazineArticles();
  const [search, setSearch] = useState("");
  const [showBackfilled, setShowBackfilled] = useState(false);

  const allIssues = useMemo(() => buildMagazineIssues(articles), [articles]);
  const visibleIssues = showBackfilled ? allIssues : allIssues.slice(0, Math.min(3, allIssues.length));

  const filteredIssues = useMemo(() => {
    const base = visibleIssues;
    if (!search.trim()) return base;
    const q = search.toLowerCase().trim();
    return base.filter((issue) =>
      issue.title.toLowerCase().includes(q) ||
      issue.issueLabel.toLowerCase().includes(q) ||
      issue.sourceWindowLabel.toLowerCase().includes(q) ||
      issue.primaryVerticals.some((vertical) => vertical.toLowerCase().includes(q))
    );
  }, [visibleIssues, search]);

  if (loading) return <SkeletonMagazinePage />;

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]">
        <div className="text-center px-6">
          <p className="text-[15px] font-bold text-[var(--wk-text-muted)]">{error}</p>
          <Link to="/magazine" className="inline-flex items-center gap-2 mt-5 text-[13px] font-bold text-[var(--wk-brand)] hover:underline">Back to Magazine</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="magazine-issue min-h-screen">
      <section className="mag-archive-hero">
        <Link to="/magazine" className="magazine-backlink">← Magazine</Link>
        <h1 className="mag-archive-title">Browse the <em>field records.</em></h1>
        <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-[var(--wk-text-muted)]">
          WAKILISHA Magazine issues are content-based cultural volumes, not monthly folders. The source windows help us back-populate the archive, but the public object is the issue: title, theme, sections, spreads and record.
        </p>
        <button className="mag-populate" type="button" onClick={() => setShowBackfilled((value) => !value)}>
          <span>{showBackfilled ? "Show latest issues only" : "Populate all magazine issues"}</span>
          <span className="text-[var(--wk-text-faint)]">{allIssues.length} generated</span>
        </button>
        <div className="mt-6 max-w-[460px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues by theme, section, or source window…"
            className="w-full h-12 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 text-[14px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]"
          />
        </div>
      </section>

      <section className="mag-archive-grid">
        {filteredIssues.map((issue, index) => (
          <Link key={issue.slug} to={issueUrl(issue)} className="mag-issue-card">
            <div className="magazine-meta flex items-center justify-between text-[var(--mag-on-dark-muted)]">
              <span>{issue.issueLabel}</span>
              <span>{index === 0 && !showBackfilled ? "Latest" : issue.sourceWindowLabel}</span>
            </div>
            <div className="mt-8"><IssueSealPreview /></div>
            <h2>{issue.title}</h2>
            <p>{issue.deck}</p>
            <p className="magazine-meta" style={{ color: "var(--mag-green)", marginTop: 16 }}>
              {issue.articles.length} selected · {issue.excludedArticles.length} flagged · {issue.primaryVerticals.slice(0, 2).join(" / ")}
            </p>
          </Link>
        ))}
      </section>

      {filteredIssues.length === 0 && (
        <div className="text-center py-20">
          <p className="text-[15px] text-[var(--wk-text-muted)]">No issues match your search.</p>
        </div>
      )}
    </main>
  );
}

function IssueSealPreview() {
  return (
    <span className="mag-seal small" aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <defs><path id="archive-seal-ring" d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" /></defs>
        <circle cx="50" cy="50" r="46.5" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeOpacity=".14" strokeWidth=".5" />
        <text className="ring-text" fill="currentColor"><textPath href="#archive-seal-ring">· WAKILISHA FIELD RECORD · RECORDED IN NAIROBI · </textPath></text>
        <g transform="translate(50,52) scale(1.5) translate(-132.4,-15)">
          <path fill="currentColor" d="M132.91,11.14l-7.87,18.73,15.96-17.97c.26-.29.05-.76-.34-.76h-7.75Z" />
          <path fill="currentColor" d="M130.72.18h6.59c.15.01.26.17.2.31-2.24,5.23-4.48,10.46-6.73,15.69l-6.74-.02c-.19,0-.32-.19-.24-.37l6.54-15.37c.06-.15.21-.25.37-.25Z" />
        </g>
      </svg>
    </span>
  );
}
