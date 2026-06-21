import { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useMagazineArticles, type MagazineArticle } from "@/services/magazineArticles";
import { getAuthorMeta } from "@/services/authorProfiles";
import { MagazineCard } from "@/pages/magazine/components/MagazineCard";
import { SkeletonMagazinePage } from "@/components/skeletons/Skeletons";
import { Chapter19FallbackImage } from "@/components/media/Chapter19FallbackImage";
import { trackEvent } from "@/services/analytics";
import { submitForm } from "@/services/formService";

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
      { threshold: 0.08, rootMargin: "0px 0px -24px 0px" },
    );
    const els = document.querySelectorAll(".mag-reveal");
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, deps);
}

function computeIssueInfo(articles: MagazineArticle[]) {
  if (!articles.length) return { number: 1, date: "June 2026" };
  const latest = articles[0];
  const d = latest.date ? new Date(latest.date) : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const year = safe.getFullYear();
  const month = safe.getMonth() + 1;
  return { number: Math.max(1, (year - 2024) * 12 + month), date: safe.toLocaleDateString("en", { month: "long", year: "numeric" }) };
}

function MobileSectionLabel({ children, count, href }: { children: string; count?: number; href?: string }) {
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
      {href && (
        <Link to={href} className="text-[11px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] transition-colors flex items-center gap-1 whitespace-nowrap">
          All <i className="ri-arrow-right-line text-[10px]" />
        </Link>
      )}
    </div>
  );
}

export default function MobileMagazine() {
  const { articles: stories, loading, error } = useMagazineArticles();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [activeSection, setActiveSection] = useState("All");
  const heroRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (loading) setStatus("loading");
    else if (error) setStatus("error");
    else setStatus("ready");
  }, [loading, error]);

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
  }, [status]);

  useScrollReveal([status, activeSection]);

  const sectionNames = useMemo(() => {
    const sects = Array.from(new Set(stories.map((s) => s.section || "Article"))).sort();
    return ["All", ...sects.filter((s) => s !== "All")];
  }, [stories]);

  const sectionCounts = useMemo(() => {
    const cts: Record<string, number> = {};
    for (const s of stories) {
      const sec = s.section || "Article";
      cts[sec] = (cts[sec] || 0) + 1;
    }
    return cts;
  }, [stories]);

  const { number: issueNum, date: issueDate } = useMemo(() => computeIssueInfo(stories), [stories]);

  const heroStory = stories[0];
  const picks = stories.slice(1, 4);
  const sectionBlockStories = stories.slice(4);

  // ── Filter content based on active section tab ──
  const filteredPicks = useMemo(() => {
    if (activeSection === "All") return picks;
    return picks.filter((s) => (s.section || "Article") === activeSection);
  }, [picks, activeSection]);

  const filteredSectionBlockStories = useMemo(() => {
    if (activeSection === "All") return sectionBlockStories;
    return sectionBlockStories.filter((s) => (s.section || "Article") === activeSection);
  }, [sectionBlockStories, activeSection]);

  const sectionMap = useMemo(() => {
    const map: Record<string, MagazineArticle[]> = {};
    for (const story of sectionBlockStories) {
      const sec = story.section || "Article";
      if (!map[sec]) map[sec] = [];
      map[sec].push(story);
    }
    return map;
  }, [sectionBlockStories]);

  const topSections = useMemo(
    () => Object.entries(sectionMap).sort((a, b) => b[1].length - a[1].length).slice(0, 4).map(([n]) => n),
    [sectionMap],
  );

  const filteredTopSections = useMemo(() => {
    if (activeSection === "All") return topSections;
    return topSections.filter((s) => s === activeSection);
  }, [topSections, activeSection]);

  if (status === "loading") {
    return <SkeletonMagazinePage />;
  }

  if (status === "error" || !heroStory) {
    return (
      <div className="wk-mobile-v5 flex min-h-screen items-center justify-center px-5 text-center bg-[var(--wk-bg)]">
        <div>
          <i className="ri-error-warning-line text-[var(--wk-text-faint)] text-[36px] mb-3 block" />
          <p className="text-[14px] font-bold text-[var(--wk-text-muted)]">{error || "No stories yet."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wk-mobile-v5 min-h-screen bg-[var(--wk-bg)]">

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <Link
        to={`/magazine/${heroStory.slug}`}
        ref={heroRef}
        className="relative h-screen flex items-end overflow-hidden bg-[#0a0a0a] block -mt-16"
      >
        {heroStory.heroUrl ? (
          <img
            ref={heroImgRef}
            src={heroStory.heroUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-85 will-change-transform"
          />
        ) : (
          <Chapter19FallbackImage
            id={heroStory.id}
            slug={heroStory.slug}
            name={heroStory.title}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/90" />

        <div className="relative z-10 w-full px-5 pb-12 pt-24 text-white">
          <h1 className="text-[34px] sm:text-[42px] font-black tracking-[-0.05em] leading-[0.94]">
            {heroStory.title}
          </h1>

          {heroStory.dek && (
            <p className="mt-4 text-[14px] leading-relaxed text-white/55 max-w-[48ch]">
              {heroStory.dek}
            </p>
          )}

          <div className="flex items-center gap-2 mt-5 text-[11px] flex-wrap">
            <Link
              to={`/authors/${getAuthorMeta(heroStory.author).slug}`}
              className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/85 font-semibold px-3 py-1.5 hover:bg-white/18 hover:text-white transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              {heroStory.author}
            </Link>
            <span className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/65 px-3 py-1.5">
              {heroStory.date || issueDate}
            </span>
            <span className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/65 px-3 py-1.5">
              {heroStory.readingTime} min read
            </span>
          </div>
        </div>
      </Link>

      {/* ═══════════════════════ STICKY SECTION NAV ═══════════════════════ */}
      <div className="sticky top-0 z-40 border-b border-[var(--wk-border)] bg-[color-mix(in_srgb,var(--wk-surface)_92%,transparent)] backdrop-blur-[20px]" style={{ WebkitBackdropFilter: "blur(20px)" }}>
        <div
          className="px-4 flex items-center gap-1.5 overflow-x-auto scrollbar-none py-3"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
        >
          {sectionNames.map((sec) => (
            <button
              key={sec}
              onClick={() => setActiveSection(sec)}
              className={`px-3.5 py-2 rounded-full text-[12px] font-bold tracking-[-0.005em] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === sec
                  ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                  : "text-[var(--wk-text-soft)] hover:text-[var(--wk-text)] bg-transparent border border-transparent hover:border-[var(--wk-border)]"
              }`}
            >
              {sec}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════ CONTENT BODY ═══════════════════════ */}
      <div className="px-4 py-8 flex flex-col gap-12">

        {/* ── Editor's Picks ── */}
        {filteredPicks.length > 0 && (
          <section className="mag-reveal">
            <MobileSectionLabel>Editor's Picks</MobileSectionLabel>
            <div className="flex flex-col gap-3">
              <MagazineCard variant="hero" story={filteredPicks[0]} rank={1} />
              {filteredPicks.slice(1, 3).map((story, i) => (
                <MagazineCard key={story.slug} variant="compact" story={story} rank={i + 2} />
              ))}
            </div>
          </section>
        )}

        {/* ── Latest Stories ── */}
        {filteredSectionBlockStories.length > 0 && (
          <section className="mag-reveal">
            <MobileSectionLabel href="/magazine">Latest Stories</MobileSectionLabel>
            <div className="grid grid-cols-2 gap-3">
              {filteredSectionBlockStories.slice(0, 6).map((story, i) => (
                <Link
                  key={story.slug}
                  to={`/magazine/${story.slug}`}
                  className="group flex flex-col rounded-xl overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-surface)] hover:border-[var(--wk-border-strong)] active:scale-[0.98] transition-all duration-200"
                >
                  <div className="aspect-[4/5] overflow-hidden bg-[var(--wk-surface-raised)]">
                    {story.heroUrl ? (
                      <img
                        src={story.heroUrl}
                        alt={story.title}
                        className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <Chapter19FallbackImage
                        id={story.id}
                        slug={story.slug}
                        name={story.title}
                      />
                    )}
                  </div>
                  <div className="p-2.5 flex flex-col gap-1 flex-1">
                    <h4 className="text-[12px] sm:text-[13px] font-black tracking-[-0.015em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-2">
                      {story.title}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--wk-text-faint)] mt-auto">
                      <span className="font-semibold text-[var(--wk-text-muted)] truncate">{story.author}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Pullquote ── */}
        <div className="mag-reveal border-y border-[var(--wk-border)] py-10">
          <div className="max-w-[600px] mx-auto text-center">
            <div className="w-10 h-0.5 rounded-full bg-[var(--wk-brand)] mx-auto mb-5" />
            <p className="text-[24px] sm:text-[30px] font-black tracking-[-0.04em] leading-[0.96] text-[var(--wk-text)]">
              Stories should feel edited, sequenced, and alive.
            </p>
            <div className="w-10 h-0.5 rounded-full bg-[var(--wk-brand)] mx-auto mt-5" />
          </div>
        </div>

        {/* ── Section Blocks ── */}
        {filteredTopSections.length > 0 ? (
          filteredTopSections.map((section, sectionIndex) => {
            const secStories = sectionMap[section] || [];
            if (secStories.length === 0) return null;

            // Layout 0: Carousel — image-overlay portrait cards, horizontal scroll
            if (sectionIndex === 0) {
              return (
                <section key={section} className="mag-reveal">
                  <MobileSectionLabel count={secStories.length} href="/magazine">{section}</MobileSectionLabel>
                  <div
                    className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory -mx-4 px-4"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {secStories.map((story) => (
                      <Link
                        key={story.slug}
                        to={`/magazine/${story.slug}`}
                        className="group relative shrink-0 snap-start w-[260px] sm:w-[300px] aspect-[4/5] rounded-2xl overflow-hidden bg-[#0a0a0a]"
                      >
                        {story.heroUrl ? (
                          <img
                            src={story.heroUrl}
                            alt={story.title}
                            className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                          />
                        ) : (
                          <Chapter19FallbackImage
                            id={story.id}
                            slug={story.slug}
                            name={story.title}
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/10" />
                        <div className="absolute top-3 left-3 z-10">
                          <span className="inline-block text-[9px] font-black uppercase tracking-[0.18em] text-white/80 bg-black/35 backdrop-blur-sm px-2.5 py-1 rounded-full">
                            {story.section}
                          </span>
                        </div>
                        <div className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-black/25 backdrop-blur-sm flex items-center justify-center text-white/50 hover:text-white/85 transition-colors cursor-pointer">
                          <i className="ri-bookmark-line text-[13px]" />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 z-10 p-4 pb-5">
                          <h4 className="text-[15px] sm:text-[16px] font-black tracking-[-0.025em] leading-snug text-white group-hover:text-white/90 transition-colors line-clamp-2 mb-2">
                            {story.title}
                          </h4>
                          {story.dek && (
                            <p className="text-[11px] sm:text-[12px] leading-relaxed text-white/55 line-clamp-2 mb-3">
                              {story.dek}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-white/40">
                            <Link
                              to={`/authors/${getAuthorMeta(story.author).slug}`}
                              className="flex items-center gap-1.5 font-semibold text-white/60 hover:text-white/90 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="w-4 h-4 rounded-full bg-[var(--wk-brand)] flex items-center justify-center text-[7px] font-black text-[var(--wk-brand-on)] shrink-0">
                                {story.author.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                              </span>
                              {story.author}
                            </Link>
                            <span className="text-white/15">·</span>
                            <span>{story.readingTime} min</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            }

            // Layout 1: Wide Landscape Scroll — cinematic widescreen cards, horizontal scroll
            if (sectionIndex === 1) {
              return (
                <section key={section} className="mag-reveal">
                  <MobileSectionLabel count={secStories.length} href="/magazine">{section}</MobileSectionLabel>
                  <div
                    className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory -mx-4 px-4"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {secStories.map((story) => (
                      <Link
                        key={story.slug}
                        to={`/magazine/${story.slug}`}
                        className="group relative shrink-0 snap-start w-[300px] sm:w-[360px] aspect-[3/2] rounded-2xl overflow-hidden bg-[#0a0a0a]"
                      >
                        {story.heroUrl ? (
                          <img
                            src={story.heroUrl}
                            alt={story.title}
                            className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                          />
                        ) : (
                          <Chapter19FallbackImage
                            id={story.id}
                            slug={story.slug}
                            name={story.title}
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-black/10" />
                        <div className="absolute top-3 left-3 z-10">
                          <span className="inline-block text-[9px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)] bg-black/35 backdrop-blur-sm px-2.5 py-1 rounded-full">
                            {story.section}
                          </span>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 z-10 p-4 pb-5">
                          <h4 className="text-[16px] sm:text-[18px] font-black tracking-[-0.03em] leading-snug text-white group-hover:text-white/90 transition-colors line-clamp-2 mb-1.5">
                            {story.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-white/40">
                            <span className="font-semibold text-white/60">{story.author}</span>
                            <span className="text-white/15">·</span>
                            <span>{story.readingTime} min</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            }

            // Layout 2: 2-Column Grid — image-forward vertical cards with taller images
            if (sectionIndex === 2) {
              return (
                <section key={section} className="mag-reveal">
                  <MobileSectionLabel count={secStories.length} href="/magazine">{section}</MobileSectionLabel>
                  <div className="grid grid-cols-2 gap-3">
                    {secStories.slice(0, 6).map((story) => (
                      <Link
                        key={story.slug}
                        to={`/magazine/${story.slug}`}
                        className="group flex flex-col rounded-xl overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-surface)] hover:border-[var(--wk-border-strong)] hover:-translate-y-0.5 transition-all duration-300"
                      >
                        <div className="aspect-[3/4] overflow-hidden bg-[var(--wk-surface-raised)]">
                          {story.heroUrl ? (
                            <img
                              src={story.heroUrl}
                              alt={story.title}
                              className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <Chapter19FallbackImage
                              id={story.id}
                              slug={story.slug}
                              name={story.title}
                            />
                          )}
                        </div>
                        <div className="p-3 flex flex-col gap-1.5 flex-1">
                          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
                            {story.section}
                          </span>
                          <h4 className="text-[13px] sm:text-[14px] font-black tracking-[-0.02em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-3">
                            {story.title}
                          </h4>
                          {story.dek && (
                            <p className="text-[10px] sm:text-[11px] leading-relaxed text-[var(--wk-text-soft)] line-clamp-2">
                              {story.dek}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 text-[10px] text-[var(--wk-text-faint)] mt-auto pt-1">
                            <span className="font-semibold">{story.author}</span>
                            <span className="text-[var(--wk-border-strong)]">·</span>
                            <span>{story.readingTime} min</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            }

            // Layout 3: Hero + Compact List — one big image-overlay hero, rest as thumb rows
            const [heroItem, ...restItems] = secStories;
            return (
              <section key={section} className="mag-reveal">
                <MobileSectionLabel count={secStories.length} href="/magazine">{section}</MobileSectionLabel>
                <div className="flex flex-col gap-3">
                  {heroItem && (
                    <Link
                      to={`/magazine/${heroItem.slug}`}
                      className="group relative overflow-hidden rounded-2xl bg-[#0a0a0a] aspect-[16/10]"
                    >
                      {heroItem.heroUrl ? (
                        <img
                          src={heroItem.heroUrl}
                          alt={heroItem.title}
                          className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <Chapter19FallbackImage
                          id={heroItem.id}
                          slug={heroItem.slug}
                          name={heroItem.title}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10" />
                      <div className="absolute top-3 left-3 z-10">
                        <span className="inline-block text-[9px] font-black uppercase tracking-[0.18em] text-white/80 bg-black/35 backdrop-blur-sm px-2.5 py-1 rounded-full">
                          {heroItem.section}
                        </span>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 z-10 p-4 pb-5">
                        <h4 className="text-[18px] sm:text-[20px] font-black tracking-[-0.035em] leading-snug text-white line-clamp-2 mb-1.5">
                          {heroItem.title}
                        </h4>
                        {heroItem.dek && (
                          <p className="text-[12px] leading-relaxed text-white/55 line-clamp-2 mb-2">
                            {heroItem.dek}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-[11px] text-white/40">
                          <span className="font-semibold text-white/60">{heroItem.author}</span>
                          <span className="text-white/15">·</span>
                          <span>{heroItem.readingTime} min</span>
                        </div>
                      </div>
                    </Link>
                  )}
                  {restItems.slice(0, 3).map((story) => (
                    <Link
                      key={story.slug}
                      to={`/magazine/${story.slug}`}
                      className="group flex gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 hover:border-[var(--wk-border-strong)] hover:bg-[var(--wk-surface-raised)] transition-all duration-300"
                    >
                      <div className="w-[72px] h-[72px] shrink-0 rounded-lg overflow-hidden bg-[var(--wk-surface-raised)]">
                        {story.heroUrl ? (
                          <img
                            src={story.heroUrl}
                            alt=""
                            className="w-full h-full object-cover object-top transition-transform duration-400 group-hover:scale-110"
                          />
                        ) : (
                          <Chapter19FallbackImage
                            id={story.id}
                            slug={story.slug}
                            name={story.title}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
                          {story.section}
                        </span>
                        <h4 className="text-[14px] font-bold tracking-[-0.02em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-2">
                          {story.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-[var(--wk-text-faint)]">
                          <span className="font-semibold">{story.author}</span>
                          <span className="text-[var(--wk-border-strong)]">·</span>
                          <span>{story.readingTime} min</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })
        ) : activeSection !== "All" ? (
          <section className="mag-reveal py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--wk-surface)] flex items-center justify-center mx-auto mb-4">
              <i className="ri-article-line text-[20px] text-[var(--wk-text-faint)]" />
            </div>
            <p className="text-[14px] font-bold text-[var(--wk-text-muted)] mb-1">No stories in {activeSection}</p>
            <p className="text-[12px] text-[var(--wk-text-faint)]">Check back soon or browse All stories.</p>
          </section>
        ) : null}

        {/* ── Newsletter ── */}
        <MobileNewsletterCTA />

        {/* ── Footer ── */}
        <footer className="border-t border-[var(--wk-border)] pt-10 pb-4 text-center">
          <span className="text-[9px] font-black uppercase tracking-[0.24em] text-[var(--wk-brand)] mb-2 block">
            WAKILISHA Magazine
          </span>
          <p className="text-[20px] font-black tracking-[-0.035em] text-[var(--wk-text)] leading-snug max-w-[320px] mx-auto">
            Stories that move East African culture forward.
          </p>
          <p className="mt-2 text-[11px] text-[var(--wk-text-faint)]">
            Issue {issueNum} &middot; {issueDate}
          </p>
        </footer>
      </div>
    </div>
  );
}

function MobileNewsletterCTA() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSubscribing(true);

    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const submission: Record<string, string> = { form_type: "newsletter" };
    formData.forEach((value, key) => {
      submission[key] = String(value);
    });

    trackEvent("newsletter_signup", {
      pageType: "magazine",
      context: { sourceSection: "mobile_footer", formId: "magazine-newsletter-mobile" },
    });

    const result = await submitForm(submission);
    if (result.success) setDone(true);
    setSubscribing(false);
  };

  return (
    <section className="mag-reveal rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
      {done ? (
        <div className="py-12 px-5 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--wk-brand)] flex items-center justify-center mx-auto mb-4">
            <i className="ri-check-line text-[24px] text-[var(--wk-brand-on)]" />
          </div>
          <h3 className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">You're on the list</h3>
          <p className="text-[13px] text-[var(--wk-text-muted)] max-w-[320px] mx-auto leading-relaxed">
            Expect WAKILISHA stories, charts, and cultural dispatches — no noise.
          </p>
        </div>
      ) : (
        <div className="py-10 px-5 text-center">
          <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-3">
            <i className="ri-mail-line text-[14px]" />
            WAKILISHA Editorial
          </span>
          <h2 className="text-[26px] font-black tracking-[-0.04em] text-[var(--wk-text)] leading-tight mb-2">Read with us</h2>
          <p className="text-[13px] text-[var(--wk-text-muted)] leading-relaxed mb-6">
            Get weekly analysis, chart commentary, and industry signals delivered to your inbox.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input type="hidden" name="wk_page_type" value="magazine" />
            <input type="hidden" name="wk_source_section" value="mobile_footer" />
            <div className="relative">
              <i className="ri-mail-line absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)] text-[16px] pointer-events-none" />
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full h-12 rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] pl-10 pr-4 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
              />
            </div>
            <button type="submit" disabled={subscribing} className="h-12 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[14px] font-extrabold hover:-translate-y-0.5 transition-transform whitespace-nowrap cursor-pointer disabled:opacity-60">
              {subscribing ? "Subscribing..." : "Subscribe"}
            </button>
          </form>
          <p className="mt-3 text-[10px] font-semibold text-[var(--wk-text-faint)]">No spam. Unsubscribe anytime.</p>
        </div>
      )}
    </section>
  );
}