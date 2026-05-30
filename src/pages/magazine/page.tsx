import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { StoryCard } from "@/components/design-system/editorial/StoryCard";
import { SkeletonStoryCard } from "@/components/skeletons/Skeletons";
import { WkEditorialPicks } from "./components/EditorialPicks";
import { WkTrendingStories } from "./components/TrendingStories";
import { WkNewsletterCTA } from "./components/NewsletterCTA";
import { SECTIONS, STORIES, EDITOR_PICKS, TRENDING_STORIES } from "@/mocks/magazine";

export default function Magazine() {
  const [activeSection, setActiveSection] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const featured = STORIES[0];
  const rest = STORIES.slice(1).filter(
    (s) => activeSection === "All" || s.section === activeSection,
  );

  // For "All" view, build asymmetric editorial grid
  const largeStories = rest.slice(0, 2);
  const wideStory = rest[2];
  const smallStories = rest.slice(3, 6);
  const remainingStories = rest.slice(6);

  return (
    <div className="min-h-screen">
      {/* ===== COVER STORY HERO — magazine cover, not a generic page hero ===== */}
      <section className="relative min-h-[90vh] flex items-end overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${featured.heroUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />

        {/* Top bar — issue badge */}
        <div className="absolute top-0 left-0 right-0 z-10">
          <div className="wk-container-wide flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/80 backdrop-blur-sm">
                Issue 01
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                May 2024
              </span>
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
              WAKILISHA Editorial
            </span>
          </div>
        </div>

        <div className="relative wk-container-wide w-full px-6 pb-16 pt-20 md:pb-24">
          <div className="max-w-3xl">
            <div className="mb-5 flex items-center gap-3">
              <span className="rounded-full bg-[var(--wk-brand)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-brand-on)]">
                {featured.section}
              </span>
              <span className="text-[12px] font-medium text-white/60">
                {featured.readingTime} min read
              </span>
            </div>
            <h1
              className="font-black leading-[0.92] tracking-[-0.04em] text-[#F0EFE8]"
              style={{ fontSize: "clamp(36px, 5.5vw, 72px)" }}
            >
              {featured.title}
            </h1>
            {featured.dek && (
              <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-white/65">
                {featured.dek}
              </p>
            )}
            <div className="mt-8 flex items-center gap-4">
              <Link
                to={`/magazine/${featured.slug}`}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-6 py-3 text-[14px] font-bold text-[var(--wk-brand-on)] transition-all hover:brightness-110 whitespace-nowrap"
              >
                Read cover story
                <i className="ri-arrow-right-line" />
              </Link>
              <span className="text-[13px] text-white/50">
                by {featured.author}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TRENDING STRIP — horizontal shelf, magazine "what's hot" ===== */}
      <div className="border-y border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="wk-container-wide flex items-center gap-6 overflow-x-auto px-6 py-3">
          <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">
            Trending
          </span>
          <div className="flex items-center gap-1">
            {TRENDING_STORIES.map((story, i) => (
              <Link
                key={story.slug}
                to={`/magazine/${story.slug}`}
                className="group flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold text-[var(--wk-text-soft)] transition-colors hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
              >
                <span className="text-[var(--wk-brand)] font-bold">{i + 1}</span>
                <span className="truncate max-w-[200px]">{story.title}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="wk-container-wide px-6 py-12 md:py-16">
        {/* ===== SECTION FILTER — refined, compact ===== */}
        <div className="mb-12 flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all whitespace-nowrap ${
                activeSection === s
                  ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                  : "border border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* ===== ASYMMETRIC EDITORIAL GRID ===== */}
        {activeSection === "All" && !loading && (
          <div className="space-y-8">
            {/* Row 1: Two large stories side by side */}
            <div className="grid gap-6 lg:grid-cols-2">
              {largeStories.map((story) => (
                <Link
                  key={story.slug}
                  to={`/magazine/${story.slug}`}
                  className="group flex flex-col gap-4"
                >
                  <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                    <img
                      src={story.heroUrl}
                      alt={story.title}
                      className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-slow)] group-hover:scale-105"
                    />
                    <div className="absolute left-3 top-3">
                      <span className="rounded-full bg-[var(--wk-brand)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-brand-on)]">
                        {story.section}
                      </span>
                    </div>
                  </div>
                  <div>
                    <h2 className="text-[22px] font-bold leading-snug tracking-[-0.02em] text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)]">
                      {story.title}
                    </h2>
                    <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
                      {story.body?.[0]}
                    </p>
                    <div className="mt-3 flex items-center gap-3 text-[12px] text-[var(--wk-text-faint)]">
                      <span className="font-semibold text-[var(--wk-text-soft)]">{story.author}</span>
                      <span>·</span>
                      <span>{story.date}</span>
                      <span>·</span>
                      <span>{story.readingTime} min</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Row 2: One wide story — dominant, cinematic */}
            {wideStory && (
              <Link
                to={`/magazine/${wideStory.slug}`}
                className="group grid gap-6 overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] lg:grid-cols-[1.4fr_1fr]"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-[var(--wk-surface-raised)] lg:aspect-auto">
                  <img
                    src={wideStory.heroUrl}
                    alt={wideStory.title}
                    className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-slow)] group-hover:scale-105"
                  />
                  <div className="absolute left-4 top-4">
                    <span className="rounded-full bg-[var(--wk-brand)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-brand-on)]">
                      {wideStory.section}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col justify-center p-6 lg:p-10">
                  <h2 className="text-[28px] font-bold leading-tight tracking-[-0.03em] text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)]">
                    {wideStory.title}
                  </h2>
                  <p className="mt-4 line-clamp-3 text-[15px] leading-relaxed text-[var(--wk-text-muted)]">
                    {wideStory.body?.[0]}
                  </p>
                  <div className="mt-6 flex items-center gap-3 text-[12px] text-[var(--wk-text-faint)]">
                    <span className="font-semibold text-[var(--wk-text-soft)]">{wideStory.author}</span>
                    <span>·</span>
                    <span>{wideStory.date}</span>
                    <span>·</span>
                    <span>{wideStory.readingTime} min</span>
                  </div>
                </div>
              </Link>
            )}

            {/* Row 3: Three small stories — compact, dense */}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {smallStories.map((story) => (
                <Link
                  key={story.slug}
                  to={`/magazine/${story.slug}`}
                  className="group flex flex-col gap-3"
                >
                  <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                    <img
                      src={story.heroUrl}
                      alt={story.title}
                      className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-standard)] group-hover:scale-105"
                    />
                    <div className="absolute left-2 top-2">
                      <span className="rounded-full border border-white/30 bg-black/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/80 backdrop-blur-sm">
                        {story.section}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-[15px] font-bold leading-snug text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)]">
                    {story.title}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
                    <span className="font-semibold text-[var(--wk-text-soft)]">{story.author}</span>
                    <span>·</span>
                    <span>{story.readingTime} min</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ===== FILTERED VIEW — standard grid when filtering by section ===== */}
        {activeSection !== "All" && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonStoryCard key={i} />)
              : rest.map((story) => (
                  <StoryCard key={story.slug} {...story} />
                ))}
          </div>
        )}

        {/* Empty state */}
        {rest.length === 0 && activeSection !== "All" && !loading && (
          <div className="py-16 text-center text-[var(--wk-text-muted)]">
            <i className="ri-article-line mb-3 block text-4xl" />
            No stories in this section yet.
          </div>
        )}

        {/* ===== BELOW THE FOLD — only on All view ===== */}
        {activeSection === "All" && !loading && (
          <div className="mt-20 space-y-20">
            {/* Editor's Picks */}
            <WkEditorialPicks picks={EDITOR_PICKS} />

            {/* Trending + Newsletter — side by side, more visual */}
            <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
              <WkTrendingStories stories={TRENDING_STORIES} />
              <WkNewsletterCTA />
            </div>

            {/* Remaining stories grid */}
            {remainingStories.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="wk-eyebrow">More stories</div>
                  <div className="h-px flex-1 bg-[var(--wk-divider)]" />
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {remainingStories.map((story) => (
                    <StoryCard key={story.slug} {...story} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}