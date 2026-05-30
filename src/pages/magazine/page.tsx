import { useState, useEffect } from "react";
import { PageHero } from "@/components/design-system/primitives/PageHero";
import { StoryCard } from "@/components/design-system/editorial/StoryCard";
import { SkeletonStoryCard } from "@/components/skeletons/Skeletons";
import { WkEditorialPicks } from "./components/EditorialPicks";
import { WkTrendingStories } from "./components/TrendingStories";
import { WkNewsletterCTA } from "./components/NewsletterCTA";
import { WkSectionSpotlight } from "./components/SectionSpotlight";
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

  return (
    <>
      <PageHero
        eyebrow="WAKILISHA magazine"
        title="Editorial"
        subtitle="Analysis, interviews, industry deep-dives, and cultural commentary from the WAKILISHA editorial team."
      />

      <div className="wk-container-wide px-6 py-10">
        {/* Section filter pills */}
        <div className="mb-8 flex flex-wrap gap-2">
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

        {/* Featured story (only on All) */}
        {activeSection === "All" && (
          <div className="mb-8">
            {loading ? <SkeletonStoryCard /> : <StoryCard {...featured} isFeatured />}
          </div>
        )}

        {/* Story grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonStoryCard key={i} />)
            : rest.map((story) => <StoryCard key={story.slug} {...story} />)}
        </div>

        {/* Empty state */}
        {rest.length === 0 && activeSection !== "All" && !loading && (
          <div className="py-16 text-center text-[var(--wk-text-muted)]">
            <i className="ri-article-line mb-3 block text-4xl" />
            No stories in this section yet.
          </div>
        )}

        {/* New logical segments below the main grid */}
        {activeSection === "All" && !loading && (
          <div className="mt-16 space-y-16">
            {/* Editor's Picks */}
            <WkEditorialPicks picks={EDITOR_PICKS} />

            {/* Trending + Newsletter row */}
            <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
              <WkTrendingStories stories={TRENDING_STORIES} />
              <WkNewsletterCTA />
            </div>

            {/* Section Spotlight */}
            <WkSectionSpotlight stories={STORIES.slice(1)} />
          </div>
        )}
      </div>
    </>
  );
}