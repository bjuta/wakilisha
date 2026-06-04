import { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useMagazineArticles, type MagazineArticle } from "@/services/magazineArticles";
import { getAuthorMeta } from "@/services/authorProfiles";
import { MagazineCard } from "@/pages/magazine/components/MagazineCard";

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

  useScrollReveal([status]);

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

  if (status === "loading") {
    return (
      <div className="wk-mobile-v5 flex min-h-screen items-center justify-center bg-[var(--wk-bg)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-[var(--wk-border)] border-t-[var(--wk-brand)] rounded-full animate-spin" />
          <span className="text-[13px] font-semibold text-[var(--wk-text-muted)]">Loading…</span>
        </div>
      </div>
    );
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
      <div ref={heroRef} className="relative min-h-[78vh] flex items-end overflow-hidden bg-[#0a0a0a]">
        <img
          ref={heroImgRef}
          src={heroStory.heroUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-85 will-change-transform"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/35 to-black/90" />

        <div className="relative z-10 w-full px-5 pb-16 pt-24 text-white">
          <div className="inline-flex items-center gap-2 rounded-full bg-black/45 border border-white/18 text-white/90 text-[11px] font-bold tracking-[0.14em] uppercase px-3.5 py-1.5 mb-4 backdrop-blur-sm">
            <span className="text-[var(--wk-brand)] font-extrabold">Issue {issueNum}</span>
            <span className="text-white/35">·</span>
            <span>{issueDate}</span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[10px] font-black uppercase tracking-[0.18em] px-3 py-1.5 mb-5">
            <i className="ri-newspaper-line text-[12px]" />
            Cover Story
          </div>

          <h1 className="text-[36px] sm:text-[44px] font-black tracking-[-0.05em] leading-[0.92]">
            {heroStory.title}
          </h1>

          {heroStory.dek && (
            <p className="mt-4 text-[15px] leading-relaxed text-white/65 max-w-[48ch]">
              {heroStory.dek}
            </p>
          )}

          <div className="flex items-center gap-3 mt-6 flex-wrap">
            <Link
              to={`/authors/${getAuthorMeta(heroStory.author).slug}`}
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
            >
              <span className="w-9 h-9 rounded-full bg-[var(--wk-brand)] flex items-center justify-center text-[var(--wk-brand-on)] text-[12px] font-extrabold shrink-0">
                {heroStory.author.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-[13px] font-bold text-white">{heroStory.author}</span>
            </Link>
            <span className="text-white/30">·</span>
            <span className="text-[12px] text-white/50">{heroStory.date || issueDate} · {heroStory.readingTime} min</span>
          </div>

          <Link
            to={`/magazine/${heroStory.slug}`}
            className="inline-flex items-center gap-2.5 bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[13px] font-extrabold px-5 py-2.5 rounded-full mt-5 hover:-translate-y-0.5 transition-transform whitespace-nowrap"
          >
            Read the cover story
            <i className="ri-arrow-right-line text-[14px]" />
          </Link>
        </div>
      </div>

      {/* ═══════════════════════ STICKY SECTION NAV ═══════════════════════ */}
      <div className="sticky top-0 z-40 border-b border-[var(--wk-border)] bg-[color-mix(in_srgb,var(--wk-surface)_92%,transparent)] backdrop-blur-[20px]">
        <div className="px-4 flex items-center gap-1.5 overflow-x-auto scrollbar-none py-3">
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
        {picks.length > 0 && (
          <section className="mag-reveal">
            <MobileSectionLabel>Editor&apos;s Picks</MobileSectionLabel>
            <div className="flex flex-col gap-3">
              <MagazineCard variant="hero" story={picks[0]} rank={1} />
              {picks.slice(1, 3).map((story, i) => (
                <MagazineCard key={story.slug} variant="compact" story={story} rank={i + 2} />
              ))}
            </div>
          </section>
        )}

        {/* ── Latest Stories ── */}
        {sectionBlockStories.length > 0 && (
          <section className="mag-reveal">
            <MobileSectionLabel href="/magazine">Latest Stories</MobileSectionLabel>
            <div className="grid grid-cols-2 gap-3">
              {sectionBlockStories.slice(0, 6).map((story, i) => (
                <MagazineCard key={story.slug} variant="standard" story={story} rank={i + 1} />
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
        {topSections.map((section) => {
          const secStories = sectionMap[section] || [];
          if (secStories.length === 0) return null;
          return (
            <section key={section} className="mag-reveal">
              <MobileSectionLabel count={secStories.length} href="/magazine">{section}</MobileSectionLabel>
              <div className="flex flex-col gap-3">
                {secStories.slice(0, 3).map((story, i) => (
                  <MagazineCard key={story.slug} variant="compact" story={story} rank={i + 1} />
                ))}
              </div>
            </section>
          );
        })}

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
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (email.trim()) setDone(true); };

  return (
    <section className="mag-reveal rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
      {done ? (
        <div className="py-12 px-5 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--wk-brand)] flex items-center justify-center mx-auto mb-4">
            <i className="ri-check-line text-[24px] text-[var(--wk-brand-on)]" />
          </div>
          <h3 className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">You&apos;re on the list</h3>
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
            <div className="relative">
              <i className="ri-mail-line absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)] text-[16px] pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full h-12 rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] pl-10 pr-4 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
              />
            </div>
            <button type="submit" className="h-12 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[14px] font-extrabold hover:-translate-y-0.5 transition-transform whitespace-nowrap cursor-pointer">
              Subscribe
            </button>
          </form>
          <p className="mt-3 text-[10px] font-semibold text-[var(--wk-text-faint)]">No spam. Unsubscribe anytime.</p>
        </div>
      )}
    </section>
  );
}