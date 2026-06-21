import { useState, useEffect, useCallback } from "react";
import { NewsletterSubscribe } from "@/components/feature/NewsletterSubscribe";
import { HomeHero } from "./components/HomeHero";
import { HomeMarquee } from "./components/HomeMarquee";
import { HomeRightNow } from "./components/HomeRightNow";
import { HomeExplore } from "./components/HomeExplore";
import { HomeMission } from "./components/HomeMission";
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

        {/* Error banner */}
        {loadError && (
          <div className="border-t border-[var(--wk-danger)]/20 bg-[var(--wk-danger-soft)] px-6 py-3.5">
            <div className="flex items-center gap-2 text-[13px] text-[var(--wk-danger)]" style={{ maxWidth: 1180, margin: "0 auto" }}>
              <i className="ri-error-warning-line" />
              <span>Some data could not load: {loadError}</span>
              <button onClick={loadData} className="ml-auto font-bold underline underline-offset-2 cursor-pointer">
                Retry
              </button>
            </div>
          </div>
        )}

        {/* 6. Newsletter */}
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