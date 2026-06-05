import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMagazineArticles } from "@/services/magazineArticles";
import { SkeletonMagazinePage } from "@/components/skeletons/Skeletons";
import { issueCovers } from "@/mocks/issueCovers";

export default function AllIssuesPage() {
  const { articles: allStories, loading, error } = useMagazineArticles();
  const [search, setSearch] = useState("");

  const allIssues = useMemo(() => {
    const grouped: Record<string, { articles: typeof allStories; coverArticle: (typeof allStories)[0] }> = {};
    for (const article of allStories) {
      const parsed = new Date(article.date);
      if (Number.isNaN(parsed.getTime())) continue;
      const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
      if (!grouped[key]) {
        grouped[key] = { articles: [], coverArticle: article };
      }
      grouped[key].articles.push(article);
    }
    return Object.entries(grouped)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, val], idx, arr) => {
        const [y, m] = key.split("-");
        const monthName = new Date(Number(y), Number(m) - 1).toLocaleDateString("en", { month: "long", year: "numeric" });
        return {
          key,
          monthName,
          issueNumber: arr.length - idx,
          coverUrl: issueCovers[key] || val.coverArticle.heroUrl,
          isCustomCover: !!issueCovers[key],
          articleCount: val.articles.length,
        };
      });
  }, [allStories]);

  const filteredIssues = useMemo(() => {
    if (!search.trim()) return allIssues;
    const q = search.toLowerCase().trim();
    return allIssues.filter((issue) =>
      issue.monthName.toLowerCase().includes(q) ||
      String(issue.issueNumber).includes(q)
    );
  }, [allIssues, search]);

  if (loading) {
    return <SkeletonMagazinePage />;
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]">
        <div className="text-center px-6">
          <i className="ri-error-warning-line text-[var(--wk-text-faint)] text-[40px] mb-4 block" />
          <p className="text-[15px] font-bold text-[var(--wk-text-muted)]">{error}</p>
          <Link to="/magazine" className="inline-flex items-center gap-2 mt-5 text-[13px] font-bold text-[var(--wk-brand)] hover:underline">
            <i className="ri-arrow-left-line" />
            Back to Magazine
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      {/* ── Header ── */}
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 py-16 lg:py-20">
        <Link
          to="/magazine"
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] transition-colors mb-6"
        >
          <i className="ri-arrow-left-line text-[14px]" />
          Magazine
        </Link>

        <h1 className="text-[clamp(36px,5vw,60px)] font-black tracking-[-0.04em] leading-[0.94] text-[var(--wk-text)] mb-3">
          All Issues
        </h1>
        <p className="text-[15px] text-[var(--wk-text-muted)] max-w-[48ch]">
          Every edition of WAKILISHA Magazine, from the latest to the earliest. Browse the archive.
        </p>

        {/* ── Search ── */}
        <div className="mt-8 max-w-[420px]">
          <div className="relative">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)] text-[16px] pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by month or issue number..."
              className="w-full h-12 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] pl-11 pr-4 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[var(--wk-border)] flex items-center justify-center text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:bg-[var(--wk-border-strong)] transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-[14px]" />
              </button>
            )}
          </div>
          {search && (
            <p className="mt-2 text-[12px] text-[var(--wk-text-faint)]">
              {filteredIssues.length} {filteredIssues.length === 1 ? "issue" : "issues"} found
            </p>
          )}
        </div>
      </div>

      {/* ── Issues Grid ── */}
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredIssues.map((issue, idx) => (
            <Link
              key={issue.key}
              to={`/magazine/issue/${issue.key}`}
              className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-[#0a0a0a]"
            >
              <img
                src={issue.coverUrl}
                alt={issue.monthName}
                className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-600 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />
              {/* Current issue badge */}
              {idx === 0 && (
                <div className="absolute top-3 left-3 z-10">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[9px] font-black tracking-[0.12em] px-2.5 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--wk-brand-on)] animate-pulse" />
                    Current
                  </span>
                </div>
              )}
              <div className="absolute top-3 right-3 z-10">
                <span className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/80 text-[10px] font-black tracking-[0.12em] px-2.5 py-1">
                  No. {issue.issueNumber}
                </span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 z-10 p-4">
                <p className="text-[13px] font-bold text-white/50 tracking-[0.06em] uppercase mb-0.5">
                  {issue.monthName}
                </p>
                <p className="text-[10px] text-white/35">
                  {issue.articleCount} {issue.articleCount === 1 ? "story" : "stories"}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {filteredIssues.length === 0 && search && (
          <div className="text-center py-20">
            <i className="ri-search-line text-[var(--wk-text-faint)] text-[36px] mb-3 block" />
            <p className="text-[15px] font-bold text-[var(--wk-text-muted)]">No issues match &ldquo;{search}&rdquo;</p>
            <button
              onClick={() => setSearch("")}
              className="mt-4 text-[13px] font-semibold text-[var(--wk-brand)] hover:underline cursor-pointer"
            >
              Clear search
            </button>
          </div>
        )}

        {allIssues.length === 0 && (
          <div className="text-center py-20">
            <p className="text-[15px] text-[var(--wk-text-muted)]">No issues published yet.</p>
          </div>
        )}
      </div>
    </main>
  );
}