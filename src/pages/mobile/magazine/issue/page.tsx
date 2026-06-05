import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useMagazineArticles } from "@/services/magazineArticles";
import { getAuthorMeta } from "@/services/authorProfiles";
import { SkeletonMagazinePage } from "@/components/skeletons/Skeletons";

function issueKeyToLabel(key: string) {
  const [y, m] = key.split("-");
  const monthName = new Date(Number(y), Number(m) - 1).toLocaleDateString("en", { month: "long", year: "numeric" });
  return monthName;
}

function MobileSectionLabel({ children, count }: { children: string; count?: number }) {
  return (
    <div className="flex items-end justify-between mb-5 gap-3">
      <div className="flex items-center gap-2.5">
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)]">
          {children}
        </span>
        {count !== undefined && (
          <span className="text-[10px] font-bold text-[var(--wk-text-faint)] bg-[var(--wk-surface)] border border-[var(--wk-border)] px-2 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </div>
    </div>
  );
}

export default function MobileMagazineIssuePage() {
  const { issueKey } = useParams<{ issueKey: string }>();
  const { articles: allStories, loading, error } = useMagazineArticles();

  const issueArticles = useMemo(() => {
    if (!issueKey || !allStories.length) return [];
    return allStories.filter((article) => {
      const d = new Date(article.date);
      if (Number.isNaN(d.getTime())) return false;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return key === issueKey;
    });
  }, [allStories, issueKey]);

  const coverArticle = issueArticles[0];
  const monthLabel = issueKey ? issueKeyToLabel(issueKey) : "Unknown Issue";

  const issueNumber = useMemo(() => {
    if (!allStories.length || !issueKey) return null;
    const allKeys = new Set<string>();
    for (const article of allStories) {
      const d = new Date(article.date);
      if (Number.isNaN(d.getTime())) continue;
      allKeys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return Array.from(allKeys).sort().reverse().indexOf(issueKey) + 1;
  }, [allStories, issueKey]);

  const sectionMap = useMemo(() => {
    const map: Record<string, typeof issueArticles> = {};
    for (const article of issueArticles) {
      const sec = article.section || "Article";
      if (!map[sec]) map[sec] = [];
      map[sec].push(article);
    }
    return map;
  }, [issueArticles]);

  const sections = useMemo(
    () => Object.entries(sectionMap).sort((a, b) => b[1].length - a[1].length),
    [sectionMap],
  );

  const allIssueKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const article of allStories) {
      const d = new Date(article.date);
      if (Number.isNaN(d.getTime())) continue;
      keys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return Array.from(keys).sort().reverse();
  }, [allStories]);

  const currentIndex = allIssueKeys.indexOf(issueKey || "");
  const prevIssue = currentIndex < allIssueKeys.length - 1 ? allIssueKeys[currentIndex + 1] : null;
  const nextIssue = currentIndex > 0 ? allIssueKeys[currentIndex - 1] : null;

  if (loading) {
    return <SkeletonMagazinePage />;
  }

  if (error || !coverArticle) {
    return (
      <div className="wk-mobile-v5 flex min-h-screen items-center justify-center px-5 text-center bg-[var(--wk-bg)]">
        <div>
          <i className="ri-history-line text-[var(--wk-text-faint)] text-[36px] mb-3 block" />
          <p className="text-[14px] font-bold text-[var(--wk-text-muted)]">
            {error || "This issue has no stories yet."}
          </p>
          <Link
            to="/magazine"
            className="inline-flex items-center gap-2 mt-4 text-[13px] font-bold text-[var(--wk-brand)]"
          >
            <i className="ri-arrow-left-line" />
            Back to Magazine
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wk-mobile-v5 min-h-screen bg-[var(--wk-bg)]">
      {/* ── Issue Header ── */}
      <div className="relative overflow-hidden bg-[#0a0a0a]">
        <div className="absolute inset-0">
          <img
            src={coverArticle.heroUrl}
            alt=""
            className="w-full h-full object-cover opacity-40"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/95" />
        <div className="relative z-10 px-5 py-16">
          <Link
            to="/magazine"
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/50 hover:text-white/80 transition-colors mb-6"
          >
            <i className="ri-arrow-left-line text-[13px]" />
            Magazine
          </Link>
          <Link
            to="/magazine/issues"
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/50 hover:text-white/80 transition-colors mb-6 ml-3"
          >
            All issues
          </Link>

          <div className="flex items-center gap-2.5 mb-4">
            {issueNumber && (
              <span className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/80 text-[9px] font-black tracking-[0.14em] px-2.5 py-1">
                No. {issueNumber}
              </span>
            )}
          </div>

          <h1 className="text-[32px] font-black tracking-[-0.04em] leading-[0.94] text-white">
            {monthLabel}
          </h1>

          <p className="mt-2 text-[13px] text-white/50">
            {issueArticles.length} {issueArticles.length === 1 ? "story" : "stories"} published this month
          </p>
        </div>
      </div>

      {/* ── Prev / Next issue nav bar ── */}
      {(prevIssue || nextIssue) && (
        <div className="border-b border-[var(--wk-border)] bg-[var(--wk-surface)]">
          <div className="px-4 flex items-center justify-between py-3">
            {prevIssue ? (
              <Link
                to={`/magazine/issue/${prevIssue}`}
                className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] transition-colors"
              >
                <i className="ri-arrow-left-s-line text-[16px]" />
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
              Issue {issueNumber} of {allIssueKeys.length}
            </span>
            {nextIssue ? (
              <Link
                to={`/magazine/issue/${nextIssue}`}
                className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] transition-colors"
              >
                Next
                <i className="ri-arrow-right-s-line text-[16px]" />
              </Link>
            ) : (
              <span />
            )}
          </div>
        </div>
      )}

      {/* ── Dynamic Section Layouts ── */}
      <div className="px-4 py-8 flex flex-col gap-12">
        {sections.map(([sectionName, secArticles], sectionIndex) => {
          const layout = sectionIndex % 4;

          if (layout === 0) {
            // Hero + list
            const [hero, ...rest] = secArticles;
            return (
              <section key={sectionName}>
                <MobileSectionLabel count={secArticles.length}>{sectionName}</MobileSectionLabel>
                <div className="flex flex-col gap-3">
                  {hero && (
                    <Link
                      to={`/magazine/${hero.slug}`}
                      className="group relative overflow-hidden rounded-2xl bg-[#0a0a0a] aspect-[16/10]"
                    >
                      <img
                        src={hero.heroUrl}
                        alt={hero.title}
                        className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10" />
                      <div className="absolute bottom-0 left-0 right-0 z-10 p-4">
                        <span className="inline-block text-[9px] font-black uppercase tracking-[0.16em] text-white/60 bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full mb-2">
                          {hero.section}
                        </span>
                        <h3 className="text-[16px] font-black tracking-[-0.025em] leading-snug text-white line-clamp-2">
                          {hero.title}
                        </h3>
                      </div>
                    </Link>
                  )}
                  {rest.map((article) => (
                    <MobileCompactRow key={article.slug} article={article} />
                  ))}
                </div>
              </section>
            );
          }

          if (layout === 1) {
            // Portrait carousel
            return (
              <section key={sectionName}>
                <MobileSectionLabel count={secArticles.length}>{sectionName}</MobileSectionLabel>
                <div
                  className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory -mx-4 px-4"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {secArticles.map((article) => (
                    <Link
                      key={article.slug}
                      to={`/magazine/${article.slug}`}
                      className="group relative shrink-0 snap-start w-[220px] aspect-[4/5] rounded-2xl overflow-hidden bg-[#0a0a0a]"
                    >
                      <img
                        src={article.heroUrl}
                        alt={article.title}
                        className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/10" />
                      <div className="absolute top-3 left-3 z-10">
                        <span className="inline-block text-[9px] font-black uppercase tracking-[0.18em] text-white/80 bg-black/35 backdrop-blur-sm px-2.5 py-1 rounded-full">
                          {article.section}
                        </span>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 z-10 p-4 pb-5">
                        <h4 className="text-[15px] font-black tracking-[-0.025em] leading-snug text-white line-clamp-2 mb-2">
                          {article.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-white/40">
                          <span className="font-semibold text-white/60">{article.author}</span>
                          <span className="text-white/15">·</span>
                          <span>{article.readingTime} min</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          }

          if (layout === 2) {
            // 2-column grid
            return (
              <section key={sectionName}>
                <MobileSectionLabel count={secArticles.length}>{sectionName}</MobileSectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  {secArticles.map((article) => (
                    <Link
                      key={article.slug}
                      to={`/magazine/${article.slug}`}
                      className="group flex flex-col rounded-xl overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-surface)] hover:border-[var(--wk-border-strong)] active:scale-[0.98] transition-all duration-200"
                    >
                      <div className="aspect-[3/4] overflow-hidden bg-[var(--wk-surface-raised)]">
                        <img
                          src={article.heroUrl}
                          alt={article.title}
                          className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <div className="p-2.5 flex flex-col gap-1 flex-1">
                        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
                          {article.section}
                        </span>
                        <h4 className="text-[12px] font-black tracking-[-0.015em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-3">
                          {article.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-[var(--wk-text-faint)] mt-auto pt-1">
                          <span className="font-semibold">{article.author}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          }

          // Layout 3: compact rows
          return (
            <section key={sectionName}>
              <MobileSectionLabel count={secArticles.length}>{sectionName}</MobileSectionLabel>
              <div className="flex flex-col gap-3">
                {secArticles.map((article) => (
                  <MobileCompactRow key={article.slug} article={article} />
                ))}
              </div>
            </section>
          );
        })}

        {issueArticles.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[14px] text-[var(--wk-text-muted)]">No articles in this issue yet.</p>
          </div>
        )}

        {/* ── Pullquote ── */}
        <div className="border-y border-[var(--wk-border)] py-10">
          <div className="max-w-[600px] mx-auto text-center">
            <div className="w-10 h-0.5 rounded-full bg-[var(--wk-brand)] mx-auto mb-5" />
            <p className="text-[20px] font-black tracking-[-0.04em] leading-[0.96] text-[var(--wk-text)]">
              Every month tells a different story.
            </p>
            <div className="w-10 h-0.5 rounded-full bg-[var(--wk-brand)] mx-auto mt-5" />
          </div>
        </div>

        {/* ── Back link ── */}
        <div className="text-center pb-4">
          <Link
            to="/magazine"
            className="inline-flex items-center gap-2 text-[13px] font-bold text-[var(--wk-brand)]"
          >
            <i className="ri-arrow-left-line" />
            Back to current issue
          </Link>
        </div>
      </div>
    </div>
  );
}

function MobileCompactRow({ article }: { article: { slug: string; title: string; section: string; heroUrl: string; author: string; readingTime: number } }) {
  return (
    <Link
      to={`/magazine/${article.slug}`}
      className="group flex gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 hover:border-[var(--wk-border-strong)] hover:bg-[var(--wk-surface-raised)] transition-all duration-300 active:scale-[0.99]"
    >
      <div className="w-[72px] h-[72px] shrink-0 rounded-lg overflow-hidden bg-[var(--wk-surface-raised)]">
        <img
          src={article.heroUrl}
          alt=""
          className="w-full h-full object-cover object-top transition-transform duration-400 group-hover:scale-110"
        />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
          {article.section}
        </span>
        <h4 className="text-[14px] font-bold tracking-[-0.02em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-2">
          {article.title}
        </h4>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--wk-text-faint)]">
          <span className="font-semibold">{article.author}</span>
          <span className="text-[var(--wk-border-strong)]">·</span>
          <span>{article.readingTime} min</span>
        </div>
      </div>
    </Link>
  );
}