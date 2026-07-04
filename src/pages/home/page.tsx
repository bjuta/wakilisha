import { useState, useEffect, useCallback } from "react";
import { NewsletterSubscribe } from "@/components/feature/NewsletterSubscribe";
import { HomeHero } from "./components/HomeHero";
import { HomeMarquee } from "./components/HomeMarquee";
import { HomeRightNow } from "./components/HomeRightNow";
import { HomeExplore } from "./components/HomeExplore";
import { HomeMission } from "./components/HomeMission";
import { MostDiscussed } from "@/components/feature/community/MostDiscussed";
import { CommunityDigest } from "@/components/feature/community/CommunityDigest";
import {
  listMagazineStories,
  type PublicStory,
} from "@/services/publicContent/client";
import {
  getChartFamilies,
  getLatestChartEdition,
  getChartEditionEntries,
  type ChartEditionEntry,
} from "@/services/chartsPublic/client";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [chartEntries, setChartEntries] = useState<ChartEditionEntry[]>([]);
  const [stories, setStories] = useState<PublicStory[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [storiesData] = await Promise.all([listMagazineStories()]);
      setStories(storiesData);

      const { data: { families } } = await getChartFamilies();
      if (families.length > 0) {
        const slug = families[0].publicSlug ?? families[0].slug ?? families[0].familyKey;
        const { data: edition } = await getLatestChartEdition(slug);
        if (edition) {
          const { data: entries } = await getChartEditionEntries(slug, edition.slug);
          setChartEntries(entries);
        }
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: "var(--wk-bg)" }}>
      <div className="relative z-[1]">

        {/* 1. Hero — full-bleed with portal cards */}
        <HomeHero chartEntries={chartEntries} stories={stories} loading={loading} />

        {/* 2. Marquee */}
        <HomeMarquee />

        {/* 3. Right Now — chart leaderboard + magazine stories */}
        <HomeRightNow chartEntries={chartEntries} stories={stories} loading={loading} />

        {/* 4. Explore — rich destination cards */}
        <HomeExplore />

        {/* 5. Mission + Stats */}
        <HomeMission />

        {/* 6. Community Hub — most discussed + activity feed */}
        <section className="py-14 md:py-20 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg)" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 clamp(20px,4vw,40px)" }}>
            <div className="text-center mb-10">
              <h2 className="text-[28px] md:text-[36px] font-black tracking-tight text-[var(--wk-text)]">
                The Conversation
              </h2>
              <p className="mt-2 text-[14px] text-[var(--wk-text-muted)] max-w-[480px] mx-auto">
                Jump into the most active discussions across the culture. Share your perspective, vote on takes, and connect with the community.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <MostDiscussed limit={6} />
              <CommunityDigest limit={8} />
            </div>
          </div>
        </section>

        {/* Error banner */}
        {loadError && (
          <div className="border-t border-[var(--wk-danger)]/20 bg-[var(--wk-danger-soft)] px-6 py-3.5">
            <div className="flex items-center gap-2 text-[13px] text-[var(--wk-danger)]" style={{ maxWidth: 1180, margin: "0 auto" }}>
              <i className="ri-error-warning-line" />
              <span>Some of this page didn't load. Give it another try.</span>
              <button onClick={loadData} className="ml-auto font-bold underline underline-offset-2 cursor-pointer">
                Retry
              </button>
            </div>
          </div>
        )}

        {/* 7. Newsletter */}
        <section className="py-16 md:py-24 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg-subtle)" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 clamp(20px,4vw,40px)" }}>
            <NewsletterSubscribe
              formId="homepage-newsletter-form"
              headline="The culture, in your inbox."
              description="Chart updates, new guides, editorial deep-dives, and early access to new sections as they launch across WAKILISHA."
              contextFields={{ wk_page_type: "home", wk_source_section: "newsletter_footer" }}
              analytics={{
                pageType: "home",
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}