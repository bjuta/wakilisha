import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import {
  fetchTaxonomyTerm,
  fetchArticlesByTerm,
  type PublicTaxonomyTerm,
  type PublicTaxonomyArticle,
} from "@/services/publicTaxonomy";
import { MagazineCard } from "@/pages/magazine/components/MagazineCard";

const PAGE_SIZE = 12;

/* ── Scroll reveal ── */
function useScrollReveal(deps: unknown[] = []) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("mag-reveal-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -32px 0px" },
    );
    const els = document.querySelectorAll(".mag-reveal");
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, deps);
}

function stripHtml(html: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, "").trim();
}

function estimateReadingTime(html: string | null): number {
  const text = stripHtml(html);
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" });
}

/* ── Map PublicTaxonomyArticle → MagazineArticle shape for MagazineCard ── */
function toMagazineStory(article: PublicTaxonomyArticle, sectionName: string) {
  return {
    slug: article.slug,
    title: article.title,
    dek: article.excerpt ? stripHtml(article.excerpt).slice(0, 200) : "",
    author: article.author || "WAKILISHA",
    section: sectionName,
    readingTime: estimateReadingTime(article.excerpt),
    date: article.published_at || "",
    heroUrl: article.hero_image_url || "",
  };
}

/* ── Section header ── */
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

export default function CategoryDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const pageFromQuery = parseInt(searchParams.get("page") || "1", 10);
  const currentPage = Number.isNaN(pageFromQuery) || pageFromQuery < 1 ? 1 : pageFromQuery;

  const [term, setTerm] = useState<PublicTaxonomyTerm | null>(null);
  const [articles, setArticles] = useState<PublicTaxonomyArticle[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const heroRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const termData = await fetchTaxonomyTerm("category", slug);
      if (!termData) {
        setError("Category not found.");
        setLoading(false);
        return;
      }
      setTerm(termData);

      const { articles: articleData, totalCount: total } = await fetchArticlesByTerm(
        "category",
        termData.name,
        currentPage,
        PAGE_SIZE,
      );
      setArticles(articleData);
      setTotalCount(total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load category.");
    } finally {
      setLoading(false);
    }
  }, [slug, currentPage]);

  useEffect(() => { load(); }, [load]);

  /* Parallax scroll on hero image */
  useEffect(() => {
    const hero = heroRef.current;
    const img = heroImgRef.current;
    if (!hero || !img || loading) return;
    const onScroll = () => {
      const scrollY = window.scrollY;
      const h = hero.offsetHeight;
      const p = Math.min(scrollY / h, 1);
      img.style.transform = `scale(${1 + p * 0.06})`;
      img.style.opacity = String(Math.max(0.85 - p * 0.3, 0.4));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [loading, articles]);

  useScrollReveal([loading]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const goToPage = (p: number) => {
    setSearchParams({ page: String(p) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* Derive magazine-style story objects */
  const sectionName = term?.name || "Category";
  const stories = useMemo(() => articles.map((a) => toMagazineStory(a, sectionName)), [articles, sectionName]);

  /* Layout breakdown */
  const heroStory = stories[0];
  const picks = stories.slice(1, 5);
  const gridStories = stories.slice(5);

  /* ── Loading state ── */
  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)]">
        <div className="relative min-h-[65vh] flex items-end bg-[#0a0a0a] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/90" />
          <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 pb-14 lg:px-8 lg:pb-18">
            <div className="h-4 w-24 rounded bg-white/10 animate-pulse mb-4" />
            <div className="h-14 w-80 rounded bg-white/10 animate-pulse mb-4" />
            <div className="h-5 w-[500px] rounded bg-white/10 animate-pulse" />
          </div>
        </div>
        <div className="max-w-[1280px] mx-auto px-6 py-14 lg:px-8 lg:py-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
                <div className="aspect-[16/10] bg-[var(--wk-surface-raised)] animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="h-3 w-full rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  /* ── Error / not found ── */
  if (error || !term) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]">
        <div className="max-w-md mx-auto rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-center">
          <i className="ri-folder-line text-[38px] text-[var(--wk-text-faint)] mb-4 block" />
          <h1 className="text-[20px] font-black text-[var(--wk-text)] mb-2">Category not found</h1>
          <p className="text-[13px] text-[var(--wk-text-muted)] mb-6">{error || "This category does not exist."}</p>
          <Link to="/categories" className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] px-5 py-2.5 text-[13px] font-bold whitespace-nowrap">
            <i className="ri-arrow-left-line" /> All categories
          </Link>
        </div>
      </main>
    );
  }

  const seoTitle = term.seo_title || `${term.name} — WAKILISHA Magazine`;
  const seoDescription = term.seo_description || term.description?.replace(/<[^>]*>/g, "").slice(0, 160) || `Browse all ${term.name} articles on WAKILISHA.`;

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      {/* SEO */}
      <title>{seoTitle}</title>
      <meta name="description" content={seoDescription} />
      {term.seo_keywords && <meta name="keywords" content={term.seo_keywords} />}

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <div
        ref={heroRef}
        className="relative min-h-[68vh] flex items-end overflow-hidden bg-[#0a0a0a]"
      >
        {/* Use first article's hero image as background, fallback to dark gradient */}
        {heroStory?.heroUrl ? (
          <img
            ref={heroImgRef}
            src={heroStory.heroUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-85 will-change-transform"
          />
        ) : (
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1f1a] via-[#141814] to-[#1a1a14]" />
            <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-[var(--wk-brand)] opacity-[0.04] blur-[80px]" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/90" />

        <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 pb-14 lg:px-8 lg:pb-18 text-white">
          <Link to="/categories" className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/50 hover:text-white/80 transition-colors mb-5">
            <span className="h-px w-5 bg-white/30" /> Categories
          </Link>
          <h1 className="text-[clamp(36px,5.5vw,72px)] font-black tracking-[-0.05em] leading-[0.92] max-w-[18ch]">
            {term.name}
          </h1>
          {term.description && (
            <p className="mt-5 text-[16px] lg:text-[18px] leading-relaxed text-white/60 max-w-[52ch]">
              {stripHtml(term.description)}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/85 font-semibold px-3.5 py-2 text-[12px]">
              <i className="ri-file-text-line text-[13px]" />
              {totalCount} {totalCount === 1 ? "article" : "articles"}
            </span>
            {term.seo_title && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/65 px-3.5 py-2 text-[12px]">
                <i className="ri-search-line text-[13px]" />
                SEO configured
              </span>
            )}
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 hidden lg:flex flex-col items-center gap-2">
          <div className="w-px h-12 bg-gradient-to-b from-white/40 to-transparent" />
        </div>
      </div>

      {/* ═══════════════════════ CONTENT BODY ═══════════════════════ */}
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 flex flex-col gap-20 py-16">

        {/* ── Empty state ── */}
        {stories.length === 0 && (
          <section className="mag-reveal text-center py-16">
            <i className="ri-file-text-line text-[36px] text-[var(--wk-text-faint)] mb-4 block" />
            <h2 className="text-[18px] font-black text-[var(--wk-text)] mb-2">No articles yet</h2>
            <p className="text-[13px] text-[var(--wk-text-muted)]">This category is waiting for its first story.</p>
          </section>
        )}

        {/* ── Editor's Picks (dynamic asymmetry: 1 hero + 3 compact stacked) ── */}
        {picks.length > 0 && (
          <section className="mag-reveal">
            <SectionLabel count={stories.length}>Stories in {term.name}</SectionLabel>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:items-stretch">
              {picks[0] && (
                <div className="lg:h-full">
                  <MagazineCard variant="hero" story={picks[0]} rank={1} />
                </div>
              )}
              <div className="grid grid-cols-1 gap-5 lg:grid-rows-3">
                {picks.slice(1, 4).map((story, i) => (
                  <div key={story.slug} className="flex">
                    <CompactCardFill story={story} rank={i + 2} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Pullquote (visual rhythm break) ── */}
        {gridStories.length > 0 && (
          <div className="mag-reveal border-y border-[var(--wk-border)] py-14 lg:py-20">
            <div className="max-w-[800px] mx-auto text-center">
              <div className="w-12 h-1 rounded-full bg-[var(--wk-brand)] mx-auto mb-7" />
              <p className="text-[clamp(28px,4vw,52px)] font-black tracking-[-0.045em] leading-[0.96] text-[var(--wk-text)]">
                More from {term.name}
              </p>
              <div className="w-12 h-1 rounded-full bg-[var(--wk-brand)] mx-auto mt-7" />
            </div>
          </div>
        )}

        {/* ── Grid stories ── */}
        {gridStories.length > 0 && (
          <section className="mag-reveal">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {gridStories.map((story) => (
                <MagazineCard key={story.slug} variant="standard" story={story} />
              ))}
            </div>
          </section>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="mag-reveal flex items-center justify-center gap-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="h-9 px-3 rounded-full border border-[var(--wk-border)] text-[12px] font-bold text-[var(--wk-text-soft)] hover:border-[var(--wk-border-strong)] hover:text-[var(--wk-text)] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap flex items-center gap-1"
            >
              <i className="ri-arrow-left-s-line" /> Prev
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => {
                if (totalPages <= 7) return true;
                if (p === 1 || p === totalPages) return true;
                if (Math.abs(p - currentPage) <= 1) return true;
                return false;
              })
              .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                if (idx > 0) {
                  const prev = arr[idx - 1];
                  if (p - prev > 1) acc.push("ellipsis");
                }
                acc.push(p);
                return acc;
              }, [])
              .map((item, i) =>
                item === "ellipsis" ? (
                  <span key={`e-${i}`} className="px-2 text-[var(--wk-text-faint)] text-[12px] font-bold">...</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => goToPage(item)}
                    className={`h-9 w-9 rounded-full text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                      item === currentPage
                        ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                        : "border border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:border-[var(--wk-border-strong)] hover:text-[var(--wk-text)]"
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="h-9 px-3 rounded-full border border-[var(--wk-border)] text-[12px] font-bold text-[var(--wk-text-soft)] hover:border-[var(--wk-border-strong)] hover:text-[var(--wk-text)] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap flex items-center gap-1"
            >
              Next <i className="ri-arrow-right-s-line" />
            </button>
          </div>
        )}

        {/* ── Magazine Footer ── */}
        <footer className="border-t border-[var(--wk-border)] pt-14 pb-8 text-center">
          <span className="text-[9px] font-black uppercase tracking-[0.24em] text-[var(--wk-brand)] mb-3 block">
            WAKILISHA Magazine
          </span>
          <p className="text-[24px] lg:text-[28px] font-black tracking-[-0.035em] text-[var(--wk-text)] leading-snug max-w-[420px] mx-auto">
            {totalCount} {totalCount === 1 ? "story" : "stories"} in {term.name}.
          </p>
        </footer>
      </div>
    </main>
  );
}

/* ── Compact card that stretches to fill row height ── */
function CompactCardFill({ story, rank }: { story: ReturnType<typeof toMagazineStory>; rank: number }) {
  const url = `/magazine/${story.slug}`;
  return (
    <Link
      to={url}
      className="group flex gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 hover:border-[var(--wk-border-strong)] hover:bg-[var(--wk-surface-raised)] transition-all duration-300 w-full h-full"
    >
      <div className="w-24 shrink-0 rounded-lg overflow-hidden bg-[var(--wk-surface-raised)] self-stretch min-h-[90px]">
        {story.heroUrl ? (
          <img
            src={story.heroUrl}
            alt=""
            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#0a0a0a]">
            <span className="text-[24px] font-black text-[var(--wk-brand)] opacity-15">{story.title.charAt(0)}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col justify-center gap-1.5 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">{story.section}</span>
          <span className="text-[10px] font-bold text-[var(--wk-text-faint)] opacity-40">#{rank}</span>
        </div>
        <h4 className="text-[14px] font-black tracking-[-0.02em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-2">
          {story.title}
        </h4>
        {story.dek && (
          <p className="text-[12px] leading-relaxed text-[var(--wk-text-soft)] line-clamp-3">
            {story.dek.length > 160 ? story.dek.slice(0, 160).trimEnd() + "…" : story.dek}
          </p>
        )}
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--wk-text-faint)] mt-auto pt-1">
          <span className="font-semibold truncate max-w-[14ch]">{story.author}</span>
          <span className="text-[var(--wk-border-strong)] shrink-0">·</span>
          <span className="shrink-0">{story.readingTime} min</span>
        </div>
      </div>
    </Link>
  );
}