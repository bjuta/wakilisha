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

function SectionLabel({ children, count }: { children: string; count?: number }) {
  return (
    <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)]">
          {children}
        </span>
        {count !== undefined && (
          <span className="text-[11px] font-semibold text-[var(--wk-text-faint)] bg-[var(--wk-surface)] border border-[var(--wk-border)] px-2.5 py-0.5 rounded-full">
            {count} {count === 1 ? "story" : "stories"}
          </span>
        )}
      </div>
    </div>
  );
}

export default function MagazineIssuePage() {
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
      <main className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]">
        <div className="text-center px-6">
          <i className="ri-history-line text-[var(--wk-text-faint)] text-[40px] mb-4 block" />
          <p className="text-[15px] font-bold text-[var(--wk-text-muted)]">
            {error || "This issue has no stories yet."}
          </p>
          <Link
            to="/magazine"
            className="inline-flex items-center gap-2 mt-5 text-[13px] font-bold text-[var(--wk-brand)] hover:underline"
          >
            <i className="ri-arrow-left-line" />
            Back to Magazine
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      {/* ── Prev / Next floating nav ── */}
      <div className="fixed top-1/2 -translate-y-1/2 left-4 lg:left-8 z-50 flex flex-col gap-4">
        {prevIssue && (
          <Link
            to={`/magazine/issue/${prevIssue}`}
            className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-[var(--wk-surface)] border border-[var(--wk-border)] flex items-center justify-center text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:border-[var(--wk-border-strong)] hover:-translate-x-0.5 transition-all shadow-sm"
            title="Previous issue"
          >
            <i className="ri-arrow-left-s-line text-[18px] lg:text-[22px]" />
          </Link>
        )}
      </div>
      <div className="fixed top-1/2 -translate-y-1/2 right-4 lg:right-8 z-50 flex flex-col gap-4">
        {nextIssue && (
          <Link
            to={`/magazine/issue/${nextIssue}`}
            className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-[var(--wk-surface)] border border-[var(--wk-border)] flex items-center justify-center text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:border-[var(--wk-border-strong)] hover:translate-x-0.5 transition-all shadow-sm"
            title="Next issue"
          >
            <i className="ri-arrow-right-s-line text-[18px] lg:text-[22px]" />
          </Link>
        )}
      </div>

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
        <div className="relative z-10 max-w-[1280px] mx-auto px-6 lg:px-8 py-20 lg:py-28">
          <Link
            to="/magazine"
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-white/50 hover:text-white/80 transition-colors mb-8"
          >
            <i className="ri-arrow-left-line text-[14px]" />
            Magazine
          </Link>
          <Link
            to="/magazine/issues"
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-white/50 hover:text-white/80 transition-colors mb-8 ml-4"
          >
            All issues
          </Link>

          <div className="flex items-center gap-3 mb-6">
            {issueNumber && (
              <span className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/80 text-[10px] font-black tracking-[0.14em] px-3 py-1.5">
                No. {issueNumber}
              </span>
            )}
            <h1 className="text-[clamp(36px,5vw,64px)] font-black tracking-[-0.04em] leading-[0.94] text-white">
              {monthLabel}
            </h1>
          </div>

          <p className="text-[15px] text-white/50">
            {issueArticles.length} {issueArticles.length === 1 ? "story" : "stories"} published this month
          </p>
        </div>
      </div>

      {/* ── Dynamic Section Layouts ── */}
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 flex flex-col gap-16 py-16">
        {sections.map(([sectionName, secArticles], sectionIndex) => {
          const layout = sectionIndex % 4;

          if (layout === 0) {
            // Hero + 3-column grid
            const [hero, ...rest] = secArticles;
            return (
              <section key={sectionName}>
                <SectionLabel count={secArticles.length}>{sectionName}</SectionLabel>
                {hero && (
                  <Link
                    to={`/magazine/${hero.slug}`}
                    className="group relative block overflow-hidden rounded-2xl bg-[#0a0a0a] aspect-[21/9] mb-6"
                  >
                    <img
                      src={hero.heroUrl}
                      alt={hero.title}
                      className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10" />
                    <div className="absolute bottom-0 left-0 right-0 z-10 p-6 lg:p-8">
                      <span className="inline-block text-[9px] font-black uppercase tracking-[0.16em] text-white/60 bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full mb-3">
                        {hero.section}
                      </span>
                      <h3 className="text-[22px] lg:text-[28px] font-black tracking-[-0.03em] leading-snug text-white line-clamp-2 mb-2">
                        {hero.title}
                      </h3>
                      {hero.dek && (
                        <p className="text-[14px] leading-relaxed text-white/55 line-clamp-2 max-w-[60ch]">
                          {hero.dek}
                        </p>
                      )}
                    </div>
                  </Link>
                )}
                {rest.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {rest.map((article) => (
                      <ArticleCard key={article.slug} article={article} />
                    ))}
                  </div>
                )}
              </section>
            );
          }

          if (layout === 1) {
            // 2-column grid
            return (
              <section key={sectionName}>
                <SectionLabel count={secArticles.length}>{sectionName}</SectionLabel>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {secArticles.map((article) => (
                    <ArticleCard key={article.slug} article={article} />
                  ))}
                </div>
              </section>
            );
          }

          if (layout === 2) {
            // Wide landscape hero + compact rows
            const [hero, ...rest] = secArticles;
            return (
              <section key={sectionName}>
                <SectionLabel count={secArticles.length}>{sectionName}</SectionLabel>
                {hero && (
                  <Link
                    to={`/magazine/${hero.slug}`}
                    className="group relative block overflow-hidden rounded-2xl bg-[#0a0a0a] aspect-[16/9] mb-5"
                  >
                    <img
                      src={hero.heroUrl}
                      alt={hero.title}
                      className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10" />
                    <div className="absolute bottom-0 left-0 right-0 z-10 p-6">
                      <h3 className="text-[20px] lg:text-[24px] font-black tracking-[-0.03em] leading-snug text-white line-clamp-2">
                        {hero.title}
                      </h3>
                    </div>
                  </Link>
                )}
                <div className="flex flex-col gap-3">
                  {rest.slice(0, 4).map((article) => (
                    <CompactRow key={article.slug} article={article} />
                  ))}
                </div>
              </section>
            );
          }

          // Layout 3: 3-column grid
          return (
            <section key={sectionName}>
              <SectionLabel count={secArticles.length}>{sectionName}</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {secArticles.map((article) => (
                  <ArticleCard key={article.slug} article={article} />
                ))}
              </div>
            </section>
          );
        })}

        {issueArticles.length === 0 && (
          <div className="text-center py-20">
            <p className="text-[15px] text-[var(--wk-text-muted)]">No articles in this issue yet.</p>
          </div>
        )}

        {/* ── Pullquote ── */}
        <div className="border-y border-[var(--wk-border)] py-14 lg:py-20">
          <div className="max-w-[800px] mx-auto text-center">
            <div className="w-12 h-1 rounded-full bg-[var(--wk-brand)] mx-auto mb-7" />
            <p className="text-[clamp(22px,3vw,42px)] font-black tracking-[-0.04em] leading-[0.96] text-[var(--wk-text)]">
              Every month tells a different story.
            </p>
            <div className="w-12 h-1 rounded-full bg-[var(--wk-brand)] mx-auto mt-7" />
          </div>
        </div>

        {/* ── Back link ── */}
        <div className="text-center pb-8">
          <Link
            to="/magazine"
            className="inline-flex items-center gap-2 text-[14px] font-bold text-[var(--wk-brand)] hover:underline"
          >
            <i className="ri-arrow-left-line" />
            Back to current issue
          </Link>
        </div>
      </div>
    </main>
  );
}

function ArticleCard({ article }: { article: { slug: string; title: string; section: string; heroUrl: string; dek: string; author: string; readingTime: number } }) {
  return (
    <Link
      to={`/magazine/${article.slug}`}
      className="group flex flex-col rounded-xl overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-surface)] hover:border-[var(--wk-border-strong)] hover:-translate-y-0.5 transition-all duration-300"
    >
      <div className="aspect-[16/10] overflow-hidden bg-[var(--wk-surface-raised)]">
        <img
          src={article.heroUrl}
          alt={article.title}
          className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="p-5 flex flex-col gap-2 flex-1">
        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
          {article.section}
        </span>
        <h3 className="text-[15px] lg:text-[16px] font-black tracking-[-0.02em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-2">
          {article.title}
        </h3>
        {article.dek && (
          <p className="text-[12px] leading-relaxed text-[var(--wk-text-soft)] line-clamp-2">
            {article.dek}
          </p>
        )}
        <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)] mt-auto pt-2">
          <Link
            to={`/authors/${getAuthorMeta(article.author).slug}`}
            className="font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {article.author}
          </Link>
          <span className="text-[var(--wk-border-strong)]">·</span>
          <span>{article.readingTime} min</span>
        </div>
      </div>
    </Link>
  );
}

function CompactRow({ article }: { article: { slug: string; title: string; section: string; heroUrl: string; author: string; readingTime: number } }) {
  return (
    <Link
      to={`/magazine/${article.slug}`}
      className="group flex gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 hover:border-[var(--wk-border-strong)] hover:bg-[var(--wk-surface-raised)] transition-all duration-300"
    >
      <div className="w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-[var(--wk-surface-raised)]">
        <img
          src={article.heroUrl}
          alt=""
          className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-110"
        />
      </div>
      <div className="flex flex-col justify-center gap-1.5 flex-1 min-w-0">
        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">{article.section}</span>
        <h4 className="text-[14px] font-black tracking-[-0.02em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-2">
          {article.title}
        </h4>
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--wk-text-faint)]">
          <span className="font-semibold truncate max-w-[14ch]">{article.author}</span>
          <span className="text-[var(--wk-border-strong)]">·</span>
          <span>{article.readingTime} min</span>
        </div>
      </div>
    </Link>
  );
}