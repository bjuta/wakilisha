import "@/styles/wakilisha-magazine-38-44.css";
import "@/styles/wakilisha-workbook-p1-p11-authority.css";
import { useScrollRevealElements } from "@/hooks/useScrollReveal";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMagazineArticles, type MagazineArticle } from "@/services/magazineArticles";
import { MagazineCard } from "@/pages/magazine/components/MagazineCard";
import { SkeletonMagazinePage } from "@/components/skeletons/Skeletons";
import { Chapter19FallbackImage } from "@/components/media/Chapter19FallbackImage";
import { ResponsiveMediaImage } from "@/components/media/ResponsiveMediaImage";
import { trackEvent, getAnalyticsSessionId, getCanonicalPageUrl } from "@/services/analytics";
import { BRIEFING_SLUGS, briefingInterest, subscribeToBriefings } from "@/services/audienceSubscriptionService";
import { MagazineHeroMeta } from "@/pages/magazine/components/MagazineHeroMeta";

function computeIssueInfo(articles: MagazineArticle[]) {
  if (!articles.length) return { number: 1, date: "June 2026" };
  const latest = articles[0];
  const d = latest.date ? new Date(latest.date) : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const year = safe.getFullYear();
  const month = safe.getMonth() + 1;
  return { number: Math.max(1, (year - 2024) * 12 + month), date: safe.toLocaleDateString("en", { month: "long", year: "numeric" }) };
}

const MIN_HOMEPAGE_SECTION_STORIES = 3;

function MobileSectionLabel({ children, count, href }: { children: string; count?: number; href?: string }) {
  return (
    <div className="flex items-end justify-between mb-5 gap-3">
      <div className="flex items-center gap-2.5">
        <h2 className="text-[22px] font-bold leading-tight tracking-[-0.035em] text-[var(--wk-text)]">
          {children}
        </h2>
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
  const { articles: stories, loading, error } = useMagazineArticles(24);
  const status: "loading" | "ready" | "error" =
    loading
      ? "loading"
      : error
        ? "error"
        : "ready";
  const [activeSection, setActiveSection] = useState("All");
  const heroRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);

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

  useScrollRevealElements([status, activeSection], { rootMargin: "0px 0px -24px 0px" });

  const sectionNames = useMemo(() => {
    const sects = Array.from(new Set(stories.map((s) => s.section || "Article"))).sort();
    return ["All", ...sects.filter((s) => s !== "All")];
  }, [stories]);

  const { number: issueNum, date: issueDate } = useMemo(() => computeIssueInfo(stories), [stories]);

  const heroStory = stories[0];
  const picks = stories.slice(1, 4);
  const latest = stories.slice(4, 10);
  const sectionBlockStories = stories.slice(10);

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
    () =>
      Object.entries(sectionMap)
        .filter(
          ([, sectionStories]) =>
            sectionStories.length
            >= MIN_HOMEPAGE_SECTION_STORIES,
        )
        .sort(
          (a, b) =>
            b[1].length - a[1].length,
        )
        .slice(0, 4)
        .map(([name]) => name),
    [sectionMap],
  );

  const selectedStories = useMemo(
    () => activeSection === "All" ? stories :
      stories.filter((story) => (story.section || "Article") === activeSection),
    [activeSection, stories],
  );

  const navigate = useNavigate();
  const heroArticleUrl = heroStory ? `/magazine/${heroStory.slug}` : "/magazine";

  const handleHeroOpen = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("a,button")) return;
    navigate(heroArticleUrl);
  }, [navigate, heroArticleUrl]);

  const handleHeroKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("a,button")) return;
    event.preventDefault();
    navigate(heroArticleUrl);
  }, [navigate, heroArticleUrl]);

  if (status === "loading") {
    return <SkeletonMagazinePage />;
  }

  if (status === "error" || !heroStory) {
    return (
      <div className="wk-mobile flex min-h-screen items-center justify-center px-5 text-center bg-[var(--wk-bg)]">
        <div>
          <i className="ri-error-warning-line text-[var(--wk-text-faint)] text-[36px] mb-3 block" />
          <h1 className="text-[20px] font-bold text-[var(--wk-text-muted)]">{error || "No stories yet."}</h1>
        </div>
      </div>
    );
  }

  return (
    <div data-wk-workbook-screen="magazine-mobile" className="wk-mobile min-h-screen bg-[var(--wk-bg)]">

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <div
        ref={heroRef}
        role="link"
        tabIndex={0}
        onClick={handleHeroOpen}
        onKeyDown={handleHeroKeyDown}
        aria-labelledby="wk-mobile-magazine-hero-title"
        className="relative flex min-h-[max(500px,70dvh)] cursor-pointer items-end overflow-hidden bg-[#0a0a0a]"
      >
        {heroStory.heroUrl ? (
          <ResponsiveMediaImage
            ref={heroImgRef}
            src={heroStory.heroUrl}
            preset="hero"
            alt=""
            loading="eager"
            fetchPriority="high"
            decoding="async"
            data-wakilisha-magazine-hero="true"
            className="absolute inset-0 w-full h-full object-cover opacity-85"
          />
        ) : (
          <Chapter19FallbackImage
            id={heroStory.id}
            slug={heroStory.slug}
            name={heroStory.title}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/90" />

        <div className="relative z-10 w-full px-5 pb-12 pt-28 text-white">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--wk-brand-dot)]">{heroStory.section} · Cover story</p>
          <h1
            id="wk-mobile-magazine-hero-title"
            className="text-[34px] sm:text-[42px] font-black tracking-[-0.05em] leading-[0.94]"
          >
            {heroStory.title}
          </h1>

          {heroStory.dek && (
            <p className="mt-4 max-w-[48ch] text-[14px] leading-[1.55] text-white/85">
              {heroStory.dek}
            </p>
          )}

          <Link to={heroArticleUrl} className="mt-5 inline-flex min-h-11 items-center gap-3 self-start rounded-full border border-white/45 bg-black/25 px-5 text-[13px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white hover:text-[#111] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Read the story <span aria-hidden="true" className="text-[17px]">→</span></Link>

          <MagazineHeroMeta
            author={heroStory.author}
            authorPersonPath={heroStory.authorPersonPath}
            date={heroStory.date || issueDate}
            readingTime={heroStory.readingTime}
          />
        </div>
      </div>

      {/* Published Magazine sections, not scroll markers or future categories. */}
      <nav aria-label="Magazine sections" className="sticky top-0 z-40 border-b border-[var(--wk-border)] bg-[var(--wk-bg)] backdrop-blur-lg">
        <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
          {sectionNames.map((sec) => (
            <button
              type="button"
              key={sec}
              data-wk-magazine-filter={sec.toLowerCase()}
              aria-pressed={activeSection === sec}
              onClick={() => setActiveSection(sec)}
              className={`wk-reference-pill ${activeSection === sec ? "bg-[var(--wk-text)] text-[var(--wk-bg)]" : ""}`}
            >
              {sec}
            </button>
          ))}
        </div>
      </nav>

      {/* ═══════════════════════ CONTENT BODY ═══════════════════════ */}
      <div className="flex flex-col gap-10 px-4 py-8">

        {activeSection === "All" ? (
          <>
            {picks.length ? (
              <section className="wk-reveal">
                <MobileSectionLabel>Editor’s Picks</MobileSectionLabel>
                <MagazineCard variant="hero" story={picks[0]} />
                {picks.length > 1 ? (
                  <div className="mt-5">
                    <MobileStoryRail label="Editor’s Picks" stories={picks.slice(1)} />
                  </div>
                ) : null}
              </section>
            ) : null}
            {latest.length ? (
              <section className="wk-reveal">
                <MobileSectionLabel>Latest Stories</MobileSectionLabel>
                <MobileStoryRail label="Latest Stories" stories={latest} />
              </section>
            ) : null}
            {topSections.map((section) => {
              const items = sectionMap[section] || [];
              if (!items.length) return null;
              return (
                <section key={section} className="wk-reveal">
                  <MobileSectionLabel count={items.length}>{section}</MobileSectionLabel>
                  <MobileStoryRail label={section} stories={items} />
                </section>
              );
            })}
          </>
        ) : (
          <section className="wk-reveal" aria-live="polite">
            <MobileSectionLabel count={selectedStories.length}>{activeSection}</MobileSectionLabel>
            <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2">
              {selectedStories.map((story) => (
                <MagazineCard key={story.slug} variant="standard" story={story} />
              ))}
            </div>
          </section>
        )}

        <MobileNewsletterCTA />

      </div>
    </div>
  );
}

/** Horizontal story shelves preserve Magazine's editorial scan on narrow screens.
 * Tabs still filter the full published set; shelves never duplicate editorial data.
 */
function MobileStoryRail({ label, stories }: { label: string; stories: MagazineArticle[] }) {
  return (
    <div
      role="region"
      aria-label={`${label} stories`}
      tabIndex={0}
      data-wk-magazine-story-rail
      className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto overscroll-x-contain px-4 pb-4 [scrollbar-width:thin] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0"
    >
      {stories.map((story) => (
        <div key={story.slug} className="w-[84vw] max-w-[365px] shrink-0 snap-start sm:w-auto sm:max-w-none">
          <MagazineCard variant="standard" story={story} />
        </div>
      ))}
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

    trackEvent("newsletter_signup", {
      pageType: "magazine",
      context: { sourceSection: "mobile_footer", formId: "magazine-newsletter-mobile", briefing_slugs: BRIEFING_SLUGS.weeklyEditorial },
    });

    try {
      await subscribeToBriefings(email, BRIEFING_SLUGS.weeklyEditorial, {
        sourceForm: "magazine_mobile_newsletter",
        pageType: "magazine",
        pageUrl: getCanonicalPageUrl(),
        sessionId: getAnalyticsSessionId(),
        interests: [
          briefingInterest({
            slug: "weekly-editorial",
            title: "Weekly Editorial",
            sourceForm: "magazine_mobile_newsletter",
            sourceContext: { source_section: "mobile_footer", mobile: true },
          }),
        ],
      });
      setDone(true);
    } catch {
      setDone(false);
    }
    setSubscribing(false);
  };

  return (
    <section data-wk-magazine-newsletter className="wk-reveal border-t border-[var(--wk-border)] bg-[var(--wk-bg)]">
      {done ? (
        <div className="py-12 px-5 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--wk-brand)] flex items-center justify-center mx-auto mb-4">
            <i className="ri-check-line text-[24px] text-[var(--wk-brand-on)]" />
          </div>
          <h2 className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">You’re on the list</h2>
          <p className="text-[13px] text-[var(--wk-text-muted)] max-w-[320px] mx-auto leading-relaxed">
            Look out for the next edition.
          </p>
        </div>
      ) : (
        <div className="py-10 px-5 text-center">
          <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-3">
            <i className="ri-mail-line text-[14px]" />
            Magazine
          </span>
          <h2 className="text-[26px] font-black tracking-[-0.04em] text-[var(--wk-text)] leading-tight mb-2">One email a week. The stories, the films and what changed in the record.</h2>

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
                placeholder="Your email address"
                required
                className="w-full h-12 rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] pl-10 pr-4 text-[16px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
              />
            </div>
            <button type="submit" disabled={subscribing} className="min-h-12 rounded-full bg-[var(--wk-text)] px-6 text-[14px] font-bold text-[var(--wk-bg)] disabled:opacity-60">
              {subscribing ? "Subscribing..." : "Subscribe"}
            </button>
          </form>

        </div>
      )}
    </section>
  );
}