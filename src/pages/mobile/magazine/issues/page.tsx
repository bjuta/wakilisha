import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMagazineArticles } from "@/services/magazineArticles";
import { SkeletonMagazinePage } from "@/components/skeletons/Skeletons";
import { issueCovers } from "@/mocks/issueCovers";

export default function MobileAllIssuesPage() {
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
      <div className="wk-mobile-v5 flex min-h-screen items-center justify-center px-5 text-center bg-[var(--wk-bg)]">
        <div>
          <i className="ri-error-warning-line text-[var(--wk-text-faint)] text-[36px] mb-3 block" />
          <p className="text-[14px] font-bold text-[var(--wk-text-muted)]">{error}</p>
          <Link to="/magazine" className="inline-flex items-center gap-2 mt-4 text-[13px] font-bold text-[var(--wk-brand)]">
            <i className="ri-arrow-left-line" />
            Back to Magazine
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wk-mobile-v5 min-h-screen bg-[var(--wk-bg)]">
      {/* ── Header ── */}
      <div className="px-4 pt-12 pb-6">
        <Link
          to="/magazine"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] transition-colors mb-5"
        >
          <i className="ri-arrow-left-line text-[13px]" />
          Magazine
        </Link>

        <h1 className="text-[32px] font-black tracking-[-0.04em] leading-[0.94] text-[var(--wk-text)] mb-2">
          All Issues
        </h1>
        <p className="text-[13px] text-[var(--wk-text-muted)]">
          Every edition of WAKILISHA Magazine.
        </p>

        {/* ── Search ── */}
        <div className="mt-5">
          <div className="relative">
            <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)] text-[15px] pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search issues..."
              className="w-full h-11 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] pl-10 pr-10 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--wk-border)] flex items-center justify-center text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-[12px]" />
              </button>
            )}
          </div>
          {search && (
            <p className="mt-1.5 text-[11px] text-[var(--wk-text-faint)]">
              {filteredIssues.length} {filteredIssues.length === 1 ? "issue" : "issues"} found
            </p>
          )}
        </div>
      </div>

      {/* ── Issues Grid ── */}
      <div className="px-4 pb-12">
        <div className="grid grid-cols-2 gap-3">
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
                <div className="absolute top-2.5 left-2.5 z-10">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[8px] font-black tracking-[0.12em] px-2 py-0.5">
                    <span className="w-1 h-1 rounded-full bg-[var(--wk-brand-on)] animate-pulse" />
                    Current
                  </span>
                </div>
              )}
              <div className="absolute top-2.5 right-2.5 z-10">
                <span className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/80 text-[9px] font-black tracking-[0.12em] px-2 py-0.5">
                  No. {issue.issueNumber}
                </span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 z-10 p-3">
                <p className="text-[11px] font-bold text-white/50 tracking-[0.06em] uppercase mb-0.5">
                  {issue.monthName}
                </p>
                <p className="text-[9px] text-white/35">
                  {issue.articleCount} {issue.articleCount === 1 ? "story" : "stories"}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {filteredIssues.length === 0 && search && (
          <div className="text-center py-16">
            <i className="ri-search-line text-[var(--wk-text-faint)] text-[32px] mb-3 block" />
            <p className="text-[14px] font-bold text-[var(--wk-text-muted)]">No issues match &ldquo;{search}&rdquo;</p>
            <button
              onClick={() => setSearch("")}
              className="mt-3 text-[12px] font-semibold text-[var(--wk-brand)] hover:underline cursor-pointer"
            >
              Clear search
            </button>
          </div>
        )}

        {allIssues.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[14px] text-[var(--wk-text-muted)]">No issues published yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}