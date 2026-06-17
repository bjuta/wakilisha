import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
            {count.toLocaleString()} tags
          </span>
        )}
      </div>
    </div>
  );
}

export default function TagsIndex() {
  const [tags, setTags] = useState<PublicTaxonomyTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const heroRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTaxonomyIndex("post_tag");
      setTags(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tags.");
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

  const filteredTags = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, query]);

  const totalArticles = tags.reduce((s, t) => s + t.article_count, 0);

  /* Weighted sizing for tag cloud */
  const maxCount = tags.length > 0 ? Math.max(...tags.map((t) => t.article_count), 1) : 1;

  function tagWeightClass(count: number): string {
    const ratio = count / maxCount;
    if (ratio >= 0.7) return "text-[17px] font-black";
    if (ratio >= 0.4) return "text-[15px] font-extrabold";
    if (ratio >= 0.15) return "text-[13px] font-bold";
    return "text-[12px] font-semibold";
  }

  /* ── Loading state ── */
  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)]">
        <div className="relative min-h-[70vh] flex items-end bg-[#0a0a0a] overflow-hidden -mt-16">
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/90" />
          <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 pb-16 lg:px-8 lg:pb-20">
            <div className="h-4 w-20 rounded bg-white/10 animate-pulse mb-4" />
            <div className="h-16 w-[400px] rounded bg-white/10 animate-pulse mb-4" />
            <div className="h-5 w-[550px] rounded bg-white/10 animate-pulse" />
          </div>
        </div>
        <div className="max-w-[1280px] mx-auto px-6 py-14 lg:px-8 lg:py-20">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} className="h-9 rounded-full bg-[var(--wk-surface)] animate-pulse" style={{ width: `${60 + Math.random() * 100}px` }} />
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
          <i className="ri-price-tag-3-line text-[38px] text-[var(--wk-text-faint)] mb-4 block" />
          <h1 className="text-[20px] font-black text-[var(--wk-text)] mb-2">Could not load tags</h1>
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
          src="https://readdy.ai/api/search-image?query=Dark%20abstract%20typographic%20composition%20with%20scattered%20floating%20labels%20and%20taxonomic%20threads%2C%20deep%20charcoal%20background%20with%20warm%20amber%20and%20muted%20gold%20highlights%2C%20minimalist%20data%20visualization%20aesthetic%2C%20soft%20film%20grain%2C%20editorial%20atmosphere%2C%20no%20text%2C%20museum%20archive%20mood%2C%20dramatic%20lighting&width=1800&height=1100&seq=tags-hero-2026&orientation=landscape"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-85 will-change-transform"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/90" />

        <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 pb-16 lg:px-8 lg:pb-20 text-white">
          <Link to="/magazine" className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/50 hover:text-white/80 transition-colors mb-5">
            <span className="h-px w-5 bg-white/30" /> Magazine
          </Link>
          <h1 className="text-[clamp(40px,6vw,80px)] font-black tracking-[-0.05em] leading-[0.92] max-w-[18ch]">
            Tags
          </h1>
          <p className="mt-5 text-[16px] lg:text-[18px] leading-relaxed text-white/60 max-w-[56ch]">
            Every topic, theme, artist, and cultural thread across {tags.length.toLocaleString()} tags. Click any tag to explore related stories.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/85 font-semibold px-3.5 py-2 text-[12px]">
              <i className="ri-price-tag-3-line text-[13px]" />
              {tags.length.toLocaleString()} tags
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/65 px-3.5 py-2 text-[12px]">
              <i className="ri-file-text-line text-[13px]" />
              {totalArticles.toLocaleString()} tagged articles
            </span>
          </div>

          {/* Search */}
          <div className="mt-6 max-w-[480px]">
            <div className="relative">
              <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-white/35 text-[16px] pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${tags.length.toLocaleString()} tags...`}
                className="w-full h-12 rounded-full border border-white/15 bg-white/8 backdrop-blur-md pl-11 pr-5 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-white/25 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 hidden lg:flex flex-col items-center gap-2">
          <div className="w-px h-12 bg-gradient-to-b from-white/40 to-transparent" />
        </div>
      </div>

      {/* ═══════════════════════ CONTENT BODY ═══════════════════════ */}
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 flex flex-col gap-20 py-16">

        {/* ── Tag Cloud ── */}
        <section className="mag-reveal">
          <SectionLabel count={query ? filteredTags.length : tags.length}>
            {query ? "Matching Tags" : "All Tags"}
          </SectionLabel>

          {filteredTags.length === 0 ? (
            <div className="text-center py-16">
              <i className="ri-price-tag-3-line text-[36px] text-[var(--wk-text-faint)] mb-4 block" />
              <h2 className="text-[18px] font-black text-[var(--wk-text)] mb-2">No tags found</h2>
              <p className="text-[13px] text-[var(--wk-text-muted)]">Try a different search term.</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {filteredTags.map((tag) => (
                <Link
                  key={tag.id}
                  to={`/tags/${tag.slug}`}
                  className={`group inline-flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2.5 hover:border-[var(--wk-brand)] hover:bg-[var(--wk-brand)] hover:text-[var(--wk-brand-on)] transition-all duration-200 cursor-pointer whitespace-nowrap ${tagWeightClass(tag.article_count)} text-[var(--wk-text)]`}
                  title={`${tag.article_count} article${tag.article_count !== 1 ? "s" : ""}`}
                >
                  {tag.name}
                  <span className="text-[10px] opacity-40 font-medium ml-0.5">{tag.article_count}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Pullquote (visual rhythm break) ── */}
        <div className="mag-reveal border-y border-[var(--wk-border)] py-14 lg:py-20">
          <div className="max-w-[800px] mx-auto text-center">
            <div className="w-12 h-1 rounded-full bg-[var(--wk-brand)] mx-auto mb-7" />
            <p className="text-[clamp(28px,4vw,52px)] font-black tracking-[-0.045em] leading-[0.96] text-[var(--wk-text)]">
              {tags.length.toLocaleString()} threads. One cultural conversation.
            </p>
            <div className="w-12 h-1 rounded-full bg-[var(--wk-brand)] mx-auto mt-7" />
          </div>
        </div>

        {/* ── Top Tags Feature ── */}
        {tags.length > 0 && (
          <section className="mag-reveal">
            <div className="flex items-center gap-3 mb-8">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)]">
                Trending Topics
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {tags.slice(0, 8).map((tag) => (
                <Link
                  key={tag.id}
                  to={`/tags/${tag.slug}`}
                  className="group rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 hover:border-[var(--wk-border-strong)] hover:bg-[var(--wk-surface-raised)] transition-all duration-300"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="inline-flex items-center rounded-full bg-[var(--wk-brand)]/10 border border-[var(--wk-brand)]/20 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--wk-brand)]">
                      <i className="ri-price-tag-3-line text-[10px] mr-1" />
                      Topic
                    </span>
                    <span className="shrink-0 inline-flex items-center justify-center min-w-[32px] h-6 rounded-full bg-[var(--wk-bg)] border border-[var(--wk-border)] text-[11px] font-extrabold text-[var(--wk-brand)]">
                      {tag.article_count}
                    </span>
                  </div>
                  <h3 className="text-[15px] font-black tracking-[-0.02em] text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-1">
                    {tag.name}
                  </h3>
                  {tag.description && (
                    <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--wk-text-soft)] line-clamp-2">
                      {tag.description.replace(/<[^>]*>/g, "").slice(0, 120)}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--wk-text-faint)] group-hover:text-[var(--wk-brand)] transition-colors">
                    <span>Explore</span>
                    <i className="ri-arrow-right-line text-[10px]" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Magazine Footer ── */}
        <footer className="border-t border-[var(--wk-border)] pt-14 pb-8 text-center">
          <span className="text-[9px] font-black uppercase tracking-[0.24em] text-[var(--wk-brand)] mb-3 block">
            WAKILISHA Topic Map
          </span>
          <p className="text-[24px] lg:text-[28px] font-black tracking-[-0.035em] text-[var(--wk-text)] leading-snug max-w-[420px] mx-auto">
            {tags.length.toLocaleString()} tags mapping the cultural conversation.
          </p>
        </footer>
      </div>
    </main>
  );
}