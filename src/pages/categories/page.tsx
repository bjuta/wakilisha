import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { fetchTaxonomyIndex, type PublicTaxonomyTerm } from "@/services/publicTaxonomy";

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
            {count} sections
          </span>
        )}
      </div>
    </div>
  );
}

function stripHtml(html: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, "").trim();
}

export default function CategoriesIndex() {
  const [categories, setCategories] = useState<PublicTaxonomyTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTaxonomyIndex("category");
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Parallax scroll on hero image */
  useEffect(() => {
    const hero = heroRef.current;
    const img = heroImgRef.current;
    if (!hero || !img) return;
    const onScroll = () => {
      const scrollY = window.scrollY;
      const h = hero.offsetHeight;
      const p = Math.min(scrollY / h, 1);
      img.style.transform = `scale(${1 + p * 0.06})`;
      img.style.opacity = String(Math.max(0.85 - p * 0.3, 0.4));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [loading]);

  useScrollReveal([loading]);

  const totalArticles = categories.reduce((s, c) => s + c.article_count, 0);

  const featuredCategories = categories.slice(0, 3);
  const remainingCategories = categories.slice(3);

  /* ── Loading state ── */
  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)]">
        <div className="relative min-h-[70vh] flex items-end bg-[#0a0a0a] overflow-hidden -mt-16">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/90" />
          </div>
          <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 pb-16 lg:px-8 lg:pb-20">
            <div className="h-4 w-28 rounded bg-white/10 animate-pulse mb-4" />
            <div className="h-16 w-[520px] rounded bg-white/10 animate-pulse mb-4" />
            <div className="h-5 w-[600px] rounded bg-white/10 animate-pulse" />
          </div>
        </div>
        <div className="max-w-[1280px] mx-auto px-6 py-14 lg:px-8 lg:py-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6">
                <div className="h-5 w-3/4 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                <div className="h-3 w-full rounded bg-[var(--wk-surface-raised)] animate-pulse mt-3" />
                <div className="h-3 w-2/3 rounded bg-[var(--wk-surface-raised)] animate-pulse mt-1.5" />
                <div className="h-5 w-20 rounded bg-[var(--wk-surface-raised)] animate-pulse mt-4" />
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]">
        <div className="max-w-md mx-auto rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-center">
          <i className="ri-folder-line text-[38px] text-[var(--wk-text-faint)] mb-4 block" />
          <h1 className="text-[20px] font-black text-[var(--wk-text)] mb-2">Could not load categories</h1>
          <p className="text-[13px] text-[var(--wk-text-muted)] mb-6">{error}</p>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] px-5 py-2.5 text-[13px] font-bold cursor-pointer whitespace-nowrap">
            <i className="ri-refresh-line" /> Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <div
        ref={heroRef}
        className="relative min-h-[72vh] flex items-end overflow-hidden bg-[#0a0a0a]"
      >
        <img
          ref={heroImgRef}
          src="https://wakilisha.africa/api/search-image?query=Dark%20abstract%20editorial%20composition%20with%20layered%20archival%20textures%2C%20warm%20amber%20and%20deep%20charcoal%20tones%2C%20minimalist%20geometric%20shapes%20scattered%20like%20catalog%20cards%2C%20soft%20film%20grain%2C%20museum%20archive%20aesthetic%2C%20dramatic%20shadows%2C%20no%20text%2C%20editorial%20photography%20style%2C%20warm%20golden%20accents%20on%20dark%20background&width=1800&height=1100&seq=categories-hero-2026&orientation=landscape"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-85 will-change-transform"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/90" />

        <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 pb-16 lg:px-8 lg:pb-20 text-white">
          <Link to="/magazine" className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/50 hover:text-white/80 transition-colors mb-5">
            <span className="h-px w-5 bg-white/30" /> Magazine
          </Link>
          <h1 className="text-[clamp(40px,6vw,80px)] font-black tracking-[-0.05em] leading-[0.92] max-w-[18ch]">
            Categories
          </h1>
          <p className="mt-5 text-[16px] lg:text-[18px] leading-relaxed text-white/60 max-w-[56ch]">
            Browse WAKILISHA editorial content by category. {categories.length} sections spanning music, art, film, literature, and more.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/85 font-semibold px-3.5 py-2 text-[12px]">
              <i className="ri-folder-line text-[13px]" />
              {categories.length} categories
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/65 px-3.5 py-2 text-[12px]">
              <i className="ri-file-text-line text-[13px]" />
              {totalArticles} articles
            </span>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 hidden lg:flex flex-col items-center gap-2">
          <div className="w-px h-12 bg-gradient-to-b from-white/40 to-transparent" />
        </div>
      </div>

      {/* ═══════════════════════ CONTENT BODY ═══════════════════════ */}
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 flex flex-col gap-20 py-16">

        {/* ── Featured Categories ── */}
        {featuredCategories.length > 0 && (
          <section className="mag-reveal">
            <SectionLabel count={categories.length}>Featured Sections</SectionLabel>

            {/* Dynamic asymmetry: first category as hero card, next 2 stacked */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:items-stretch">
              <div className="lg:h-full">
                <CategoryHeroCard category={featuredCategories[0]} rank={1} />
              </div>
              <div className="grid grid-cols-1 gap-5 lg:grid-rows-2">
                {featuredCategories.slice(1, 3).map((cat, i) => (
                  <div key={cat.id} className="flex">
                    <CategoryCompactCard category={cat} rank={i + 2} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Pullquote (visual rhythm break) ── */}
        <div className="mag-reveal border-y border-[var(--wk-border)] py-14 lg:py-20">
          <div className="max-w-[800px] mx-auto text-center">
            <div className="w-12 h-1 rounded-full bg-[var(--wk-brand)] mx-auto mb-7" />
            <p className="text-[clamp(28px,4vw,52px)] font-black tracking-[-0.045em] leading-[0.96] text-[var(--wk-text)]">
              Every story finds its home in a category.
            </p>
            <div className="w-12 h-1 rounded-full bg-[var(--wk-brand)] mx-auto mt-7" />
          </div>
        </div>

        {/* ── All Categories Grid ── */}
        {remainingCategories.length > 0 && (
          <section className="mag-reveal">
            <SectionLabel>All Categories</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {remainingCategories.map((cat) => (
                <CategoryGridCard key={cat.id} category={cat} />
              ))}
            </div>
          </section>
        )}

        {/* ── Magazine Footer ── */}
        <footer className="border-t border-[var(--wk-border)] pt-14 pb-8 text-center">
          <span className="text-[9px] font-black uppercase tracking-[0.24em] text-[var(--wk-brand)] mb-3 block">
            WAKILISHA Magazine
          </span>
          <p className="text-[24px] lg:text-[28px] font-black tracking-[-0.035em] text-[var(--wk-text)] leading-snug max-w-[420px] mx-auto">
            {categories.length} categories. {totalArticles} articles. One editorial voice.
          </p>
        </footer>
      </div>
    </main>
  );
}

/* ── Hero category card: dark overlay, large ── */
function CategoryHeroCard({ category, rank }: { category: PublicTaxonomyTerm; rank: number }) {
  return (
    <Link
      to={`/categories/${category.slug}`}
      className="group relative overflow-hidden rounded-2xl bg-[#0a0a0a] flex flex-col h-full"
      style={{ minHeight: "clamp(280px, 36vw, 420px)" }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1f1a] via-[#141814] to-[#1a1a14]" />
      <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full bg-[var(--wk-brand)] opacity-[0.04] blur-[60px]" />

      <span className="absolute top-4 left-4 z-10 w-8 h-8 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[12px] font-black flex items-center justify-center">
        {rank}
      </span>

      <div className="relative z-10 mt-auto p-6 lg:p-8 text-white">
        <span className="inline-block mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)] bg-black/20 backdrop-blur-sm px-2.5 py-1 rounded-full">
          {category.article_count} {category.article_count === 1 ? "article" : "articles"}
        </span>
        <h3 className="text-[clamp(22px,2.6vw,32px)] font-black tracking-[-0.04em] leading-[1.06] mb-3 line-clamp-2 group-hover:text-white/90 transition-colors">
          {category.name}
        </h3>
        {category.description && (
          <p className="text-[13px] lg:text-[14px] leading-relaxed text-white/55 mb-4 line-clamp-2 max-w-[48ch]">
            {stripHtml(category.description)}
          </p>
        )}
        <div className="flex items-center gap-2 text-[12px] text-white/45 group-hover:text-white/70 transition-colors">
          <span className="font-semibold">Browse section</span>
          <i className="ri-arrow-right-line text-[11px]" />
        </div>
      </div>
    </Link>
  );
}

/* ── Compact stacked category card ── */
function CategoryCompactCard({ category, rank }: { category: PublicTaxonomyTerm; rank: number }) {
  return (
    <Link
      to={`/categories/${category.slug}`}
      className="group flex gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 hover:border-[var(--wk-border-strong)] hover:bg-[var(--wk-surface-raised)] transition-all duration-300 w-full h-full"
    >
      <div className="w-20 shrink-0 rounded-lg overflow-hidden bg-[#0a0a0a] self-stretch min-h-[80px] flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--wk-brand)]/10 to-transparent" />
        <span className="relative z-10 text-[20px] font-black text-[var(--wk-brand)] opacity-20">
          {String(rank).padStart(2, "0")}
        </span>
      </div>
      <div className="flex flex-col justify-center gap-1.5 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
            {category.article_count} articles
          </span>
        </div>
        <h4 className="text-[14px] font-black tracking-[-0.02em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-2">
          {category.name}
        </h4>
        {category.description && (
          <p className="text-[12px] leading-relaxed text-[var(--wk-text-soft)] line-clamp-2">
            {stripHtml(category.description).slice(0, 140)}{(stripHtml(category.description).length > 140) ? "…" : ""}
          </p>
        )}
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--wk-text-faint)] mt-auto pt-1">
          <span className="font-semibold">Explore</span>
          <i className="ri-arrow-right-line text-[10px]" />
        </div>
      </div>
    </Link>
  );
}

/* ── Grid category card ── */
function CategoryGridCard({ category }: { category: PublicTaxonomyTerm }) {
  return (
    <Link
      to={`/categories/${category.slug}`}
      className="group flex flex-col rounded-xl overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-surface)] hover:border-[var(--wk-border-strong)] hover:-translate-y-0.5 transition-all duration-300 h-full"
    >
      <div className="aspect-[16/10] overflow-hidden bg-[#0a0a0a] relative flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1f1a] via-[#141814] to-[#1a1a14]" />
        <span className="relative z-10 text-[48px] font-black text-[var(--wk-brand)] opacity-[0.07]">
          {category.name.charAt(0)}
        </span>
      </div>
      <div className="p-4 lg:p-5 flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
            {category.article_count} {category.article_count === 1 ? "article" : "articles"}
          </span>
        </div>
        <h3 className="text-[15px] lg:text-[16px] font-black tracking-[-0.02em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-2">
          {category.name}
        </h3>
        {category.description && (
          <p className="text-[12px] leading-relaxed text-[var(--wk-text-soft)] line-clamp-2 hidden lg:block">
            {stripHtml(category.description).slice(0, 160)}{(stripHtml(category.description).length > 160) ? "…" : ""}
          </p>
        )}
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--wk-text-faint)] mt-auto pt-1">
          <span className="font-semibold group-hover:text-[var(--wk-brand)] transition-colors">Browse articles</span>
          <i className="ri-arrow-right-line text-[10px]" />
        </div>
      </div>
    </Link>
  );
}