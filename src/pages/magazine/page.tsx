import { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useMagazineArticles, type MagazineArticle } from "@/services/magazineArticles";
import { getAuthorMeta } from "@/services/authorProfiles";
import { MagazineCard } from "./components/MagazineCard";
import { SectionCarousel } from "./components/SectionCarousel";
import { SkeletonMagazinePage } from "@/components/skeletons/Skeletons";
import { Chapter19FallbackImage } from "@/components/media/Chapter19FallbackImage";

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

function computeIssueInfo(articles: MagazineArticle[]) {
  if (!articles.length) return { number: 1, date: "June 2026" };
  const latest = articles[0];
  const d = latest.date ? new Date(latest.date) : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const year = safe.getFullYear();
  const month = safe.getMonth() + 1;
  return { number: Math.max(1, (year - 2024) * 12 + month), date: safe.toLocaleDateString("en", { month: "long", year: "numeric" }) };
}

/* ── Section header ── */
function SectionLabel({ children, count, href }: { children: string; count?: number; href?: string }) {
  return (
    <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)]">
          {children}
        </span>
        {count !== undefined && (
          <span className="text-[11px] font-semibold text-[var(--wk-text-faint)] bg-[var(--wk-surface)] border border-[var(--wk-border)] px-2.5 py-0.5 rounded-full">
            {count} stories
          </span>
        )}
      </div>
      {href && (
        <Link to={href} className="text-[12px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] transition-colors flex items-center gap-1 whitespace-nowrap">
          View all <i className="ri-arrow-right-line text-[11px]" />
        </Link>
      )}
    </div>
  );
}

export default function Magazine() {
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
  const picks = stories.slice(1, 5);
  const latest = stories.slice(5, 11);
  const sectionBlockStories = stories.slice(11);

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
    () => Object.entries(sectionMap).sort((a, b) => b[1].length - a[1].length).slice(0, 3).map(([n]) => n),
    [sectionMap],
  );

  const pastIssues = useMemo(() => {
    const grouped: Record<string, { articles: MagazineArticle[]; coverArticle: MagazineArticle }> = {};
    for (const article of stories) {
      const parsed = new Date(article.date);
      if (Number.isNaN(parsed.getTime())) continue;
      const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[key]) {
        grouped[key] = { articles: [], coverArticle: article };
      }
      grouped[key].articles.push(article);
    }
    const sorted = Object.entries(grouped)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, val], idx, arr) => {
        const [y, m] = key.split('-');
        const monthName = new Date(Number(y), Number(m) - 1).toLocaleDateString('en', { month: 'long', year: 'numeric' });
        return {
          key,
          monthName,
          issueNumber: arr.length - idx, // most recent = highest number
          coverUrl: val.coverArticle.heroUrl,
          articleCount: val.articles.length,
          firstSlug: val.coverArticle.slug,
        };
      });
    return sorted.slice(1); // skip current issue
  }, [stories]);

  // ── Filter content based on active section tab ──
  const filteredPicks = useMemo(() => {
    if (activeSection === "All") return picks;
    return picks.filter((s) => (s.section || "Article") === activeSection);
  }, [picks, activeSection]);

  const filteredLatest = useMemo(() => {
    if (activeSection === "All") return latest;
    return latest.filter((s) => (s.section || "Article") === activeSection);
  }, [latest, activeSection]);

  const filteredTopSections = useMemo(() => {
    if (activeSection === "All") return topSections;
    return topSections.filter((s) => s === activeSection);
  }, [topSections, activeSection]);

  const allContentEmpty = filteredPicks.length === 0 && filteredLatest.length === 0 && filteredTopSections.length === 0;

  if (status === "loading") {
    return <SkeletonMagazinePage />;
  }

  if (status === "error" || !heroStory) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]">
        <div className="text-center px-6">
          <i className="ri-error-warning-line text-[var(--wk-text-faint)] text-[40px] mb-4 block" />
          <p className="text-[15px] font-bold text-[var(--wk-text-muted)]">{error || "No stories yet."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <Link
        to={`/magazine/${heroStory.slug}`}
        ref={heroRef}
        className="relative min-h-[88vh] flex items-end overflow-hidden bg-[#0a0a0a] block group cursor-pointer -mt-16"
      >
        {/* Image */}
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
        {/* Gradient overlay — heavier at bottom for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/90" />

        {/* Content — anchored bottom-left */}
        <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 lg:px-8 pb-16 pt-28 text-white">
          <h1 className="text-[clamp(40px,6vw,80px)] font-black tracking-[-0.05em] leading-[0.92] max-w-[16ch] group-hover:opacity-90 transition-opacity duration-500">
            {heroStory.title}
          </h1>

          {heroStory.dek && (
            <p className="mt-5 text-[16px] lg:text-[18px] leading-relaxed text-white/60 max-w-[52ch]">
              {heroStory.dek}
            </p>
          )}

          <div className="flex items-center gap-2 mt-6 text-[12px] flex-wrap">
            <Link
              to={`/authors/${getAuthorMeta(heroStory.author).slug}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/85 font-semibold px-3 py-1.5 hover:bg-white/18 hover:text-white transition-all"
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

        {/* Scroll hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 hidden lg:flex flex-col items-center gap-2">
          <div className="w-px h-12 bg-gradient-to-b from-white/40 to-transparent" />
        </div>
      </Link>

      {/* ═══════════════════════ STICKY SECTION NAV ═══════════════════════ */}
      <div className="sticky top-0 z-40 border-b border-[var(--wk-border)] bg-[color-mix(in_srgb,var(--wk-surface)_92%,transparent)] backdrop-blur-[20px]">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8 flex items-center gap-5 overflow-x-auto scrollbar-none py-3.5">
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)] shrink-0 hidden lg:flex items-center gap-2">
            <span className="w-6 h-px bg-[var(--wk-brand)]" />
            Sections
          </span>
          <div className="flex gap-1.5 shrink-0">
            {sectionNames.map((sec) => (
              <button
                key={sec}
                onClick={() => setActiveSection(sec)}
                className={`px-4 py-2 rounded-full text-[13px] font-bold tracking-[-0.005em] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
      </div>

      {/* ═══════════════════════ CONTENT BODY ═══════════════════════ */}
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 flex flex-col gap-20 py-16">

        {/* ── Empty state: no results for this section across all content areas ── */}
        {allContentEmpty && activeSection !== "All" ? (
          <section className="mag-reveal">
            <div className="relative rounded-2xl overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-surface)]">
              <div className="absolute inset-0 opacity-[0.06]">
                <img
                  src="https://readdy.ai/api/search-image?query=Abstract%20minimalist%20editorial%20composition%20with%20scattered%20magazine%20pages%20and%20soft%20organic%20shapes%20floating%20in%20warm%20morning%20light%2C%20cream%20and%20charcoal%20tones%2C%20peaceful%20contemplative%20mood%2C%20wide%20composition%20with%20ample%20negative%20space%2C%20fine%20art%20editorial%20aesthetic%2C%20soft%20focus%2C%20gentle%20gradients&width=1400&height=600&seq=mag-empty-state-01&orientation=landscape"
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="relative z-10 py-20 lg:py-28 px-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[var(--wk-bg)] border border-[var(--wk-border)] flex items-center justify-center mx-auto mb-6 rotate-3">
                  <i className="ri-pages-line text-[28px] text-[var(--wk-text-faint)]" />
                </div>
                <p className="text-[18px] lg:text-[20px] font-black tracking-[-0.025em] text-[var(--wk-text)] mb-3">
                  No stories in <span className="text-[var(--wk-brand)]">{activeSection}</span> yet
                </p>
                <p className="text-[14px] text-[var(--wk-text-muted)] max-w-[420px] mx-auto leading-relaxed mb-8">
                  This section is quiet for now. Fresh stories are being edited and sequenced — check back soon, or explore everything we have.
                </p>
                <button
                  onClick={() => setActiveSection("All")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] text-[13px] font-bold text-[var(--wk-text-soft)] hover:text-[var(--wk-text)] hover:border-[var(--wk-border-strong)] transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-arrow-left-line text-[15px]" />
                  Browse all stories
                </button>
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* ── Editor's Picks ── */}
            {filteredPicks.length > 0 && (
              <section className="mag-reveal">
                <SectionLabel>Editor&apos;s Picks</SectionLabel>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:items-stretch">
                  <div className="lg:h-full">
                    <MagazineCard variant="hero" story={filteredPicks[0]} rank={1} />
                  </div>
                  <div className="grid grid-cols-1 gap-5 lg:grid-rows-3">
                    {filteredPicks.slice(1, 4).map((story, i) => (
                      <div key={story.slug} className="flex">
                        <CompactCardFill story={story} rank={i + 2} />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* ── Latest Stories ── */}
            {filteredLatest.length > 0 && (
              <section className="mag-reveal">
                <SectionLabel count={filteredLatest.length} href="/magazine">Latest Stories</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredLatest.map((story) => (
                    <MagazineCard key={story.slug} variant="standard" story={story} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Section Blocks ── */}
            {(() => {
              if (filteredTopSections.length > 0) {
                return filteredTopSections.map((section, sectionIndex) => {
                  const secStories = sectionMap[section] || [];
                  if (secStories.length === 0) return null;
                  const isMusic = section.toLowerCase() === "music";
                  const isEven = sectionIndex % 2 === 0;

                  return (
                    <section key={section} className="mag-reveal">
                      <SectionLabel count={secStories.length} href="/magazine">{section}</SectionLabel>
                      {isMusic ? (
                        <SectionCarousel stories={secStories} />
                      ) : isEven ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                          {secStories.slice(0, 3).map((story, i) => (
                            <MagazineCard key={story.slug} variant="standard" story={story} rank={i + 1} />
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 lg:items-stretch">
                          {secStories.slice(0, 1).map((story) => (
                            <div key={story.slug} className="lg:col-span-3 lg:h-full">
                              <MagazineCard variant="hero" story={story} rank={1} />
                            </div>
                          ))}
                          <div className="lg:col-span-2 grid grid-cols-1 gap-5 lg:grid-rows-3">
                            {secStories.slice(1, 4).map((story, i) => (
                              <div key={story.slug} className="flex">
                                <CompactCardFill story={story} rank={i + 2} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </section>
                  );
                });
              }
              if (activeSection !== "All") {
                return (
                  <section className="mag-reveal py-20 text-center">
                    <div className="w-14 h-14 rounded-full bg-[var(--wk-surface)] flex items-center justify-center mx-auto mb-5">
                      <i className="ri-article-line text-[24px] text-[var(--wk-text-faint)]" />
                    </div>
                    <p className="text-[16px] font-bold text-[var(--wk-text-muted)] mb-2">No stories in {activeSection}</p>
                    <p className="text-[13px] text-[var(--wk-text-faint)]">Check back soon or browse All stories.</p>
                  </section>
                );
              }
              return null;
            })()}
          </>
        )}

        {/* ── Pullquote (visual rhythm break) ── */}
        <div className="mag-reveal border-y border-[var(--wk-border)] py-14 lg:py-20">
          <div className="max-w-[800px] mx-auto text-center">
            <div className="w-12 h-1 rounded-full bg-[var(--wk-brand)] mx-auto mb-7" />
            <p className="text-[clamp(28px,4vw,52px)] font-black tracking-[-0.045em] leading-[0.96] text-[var(--wk-text)]">
              Stories should feel edited, sequenced, and alive.
            </p>
            <div className="w-12 h-1 rounded-full bg-[var(--wk-brand)] mx-auto mt-7" />
          </div>
        </div>

        {/* ── Past Issues Archive ── */}
        {pastIssues.length > 0 && (
          <section className="mag-reveal">
            <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)]">
                  Past Issues
                </span>
                <span className="text-[11px] font-semibold text-[var(--wk-text-faint)] bg-[var(--wk-surface)] border border-[var(--wk-border)] px-2.5 py-0.5 rounded-full">
                  {pastIssues.length} issues
                </span>
              </div>
              <Link to="/magazine/issues" className="text-[12px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] transition-colors flex items-center gap-1 whitespace-nowrap">
                Browse all <i className="ri-arrow-right-line text-[11px]" />
              </Link>
            </div>
            <div
              className="flex gap-5 overflow-x-auto scrollbar-none pb-2 -mx-6 lg:-mx-8 px-6 lg:px-8"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {pastIssues.map((issue) => (
                <Link
                  key={issue.key}
                  to={`/magazine/issue/${issue.key}`}
                  className="group relative shrink-0 w-[200px] lg:w-[240px] aspect-[3/4] rounded-xl overflow-hidden bg-[#0a0a0a]"
                >
                  {issue.coverUrl ? (
                    <img
                      src={issue.coverUrl}
                      alt={issue.monthName}
                      className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-600 group-hover:scale-105"
                    />
                  ) : (
                    <Chapter19FallbackImage
                      slug={issue.key}
                      name={issue.monthName}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />
                  {/* Top-right issue number */}
                  <div className="absolute top-3 right-3 z-10">
                    <span className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/80 text-[10px] font-black tracking-[0.12em] px-2.5 py-1">
                      No. {issue.issueNumber}
                    </span>
                  </div>
                  {/* Bottom content */}
                  <div className="absolute bottom-0 left-0 right-0 z-10 p-4">
                    <p className="text-[12px] lg:text-[13px] font-bold text-white/50 tracking-[0.06em] uppercase mb-0.5">
                      {issue.monthName}
                    </p>
                    <p className="text-[10px] text-white/35">
                      {issue.articleCount} {issue.articleCount === 1 ? 'story' : 'stories'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Newsletter ── */}
        <NewsletterCTA />

        {/* ── Footer ── */}
        <footer className="border-t border-[var(--wk-border)] pt-14 pb-8 text-center">
          <span className="text-[9px] font-black uppercase tracking-[0.24em] text-[var(--wk-brand)] mb-3 block">
            WAKILISHA Magazine
          </span>
          <p className="text-[24px] lg:text-[28px] font-black tracking-[-0.035em] text-[var(--wk-text)] leading-snug max-w-[420px] mx-auto">
            Stories that move East African culture forward.
          </p>
          <p className="mt-3 text-[12px] text-[var(--wk-text-faint)]">
            Issue {issueNum} &middot; {issueDate}
          </p>
        </footer>
      </div>
    </main>
  );
}

/* ── Compact card that stretches to fill row height ── */
function CompactCardFill({ story, rank }: { story: MagazineArticle; rank: number }) {
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
          <Chapter19FallbackImage
            id={story.id}
            slug={story.slug}
            name={story.title}
          />
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

/* ── Inline Newsletter component (no CSS file dependency) ── */
function NewsletterCTA() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) setDone(true);
  };

  return (
    <section className="mag-reveal rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
      {done ? (
        <div className="py-16 px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--wk-brand)] flex items-center justify-center mx-auto mb-5">
            <i className="ri-check-line text-[28px] text-[var(--wk-brand-on)]" />
          </div>
          <h3 className="text-[24px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">
            You&apos;re on the list
          </h3>
          <p className="text-[14px] text-[var(--wk-text-muted)] max-w-[380px] mx-auto leading-relaxed">
            Expect WAKILISHA stories, charts, and cultural dispatches — no noise.
          </p>
        </div>
      ) : (
        <div className="py-14 px-6 text-center max-w-[560px] mx-auto">
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-3">
            <i className="ri-mail-line text-[15px]" />
            WAKILISHA Editorial
          </span>
          <h2 className="text-[clamp(28px,3vw,38px)] font-black tracking-[-0.04em] text-[var(--wk-text)] leading-tight mb-3">
            Read with us
          </h2>
          <p className="text-[14px] text-[var(--wk-text-muted)] leading-relaxed mb-8">
            Get weekly analysis, chart commentary, and industry signals delivered to your inbox.
          </p>
          <form onSubmit={handleSubmit} className="flex gap-3 max-w-[480px] mx-auto">
            <div className="relative flex-1">
              <i className="ri-mail-line absolute left-4 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)] text-[17px] pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full h-12 rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] pl-11 pr-4 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
              />
            </div>
            <button
              type="submit"
              className="h-12 px-7 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[14px] font-extrabold hover:-translate-y-0.5 transition-transform whitespace-nowrap shrink-0 cursor-pointer"
            >
              Subscribe
            </button>
          </form>
          <p className="mt-4 text-[11px] font-semibold text-[var(--wk-text-faint)]">
            No spam. Unsubscribe anytime.
          </p>
        </div>
      )}
    </section>
  );
}