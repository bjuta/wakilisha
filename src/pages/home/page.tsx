import { useState, useEffect, useCallback } from "react";
import { WkButton } from "@/components/design-system/primitives/Button";
import { HomeHero } from "./components/HomeHero";
import { HomeMarquee } from "./components/HomeMarquee";
import { HomeRightNow } from "./components/HomeRightNow";
import { HomeExplore } from "./components/HomeExplore";
import { HomeMission } from "./components/HomeMission";
import {
  listMagazineStories,
  type RepairedStory,
} from "@/services/repairedContent/client";
import {
  getChartFamilies,
  getLatestChartEdition,
  getChartEditionEntries,
  type ChartEditionEntry,
} from "@/services/chartsPublic/client";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [chartEntries, setChartEntries] = useState<ChartEditionEntry[]>([]);
  const [stories, setStories] = useState<RepairedStory[]>([]);
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
            <div
              className="relative rounded-2xl overflow-hidden border border-[var(--wk-border)]"
              style={{ background: "var(--wk-surface)" }}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-20 -right-20 w-[400px] h-[400px] rounded-full"
                style={{ background: "var(--wk-brand)", opacity: 0.03 }}
              />

              <div className="relative z-10 p-8 md:p-12 max-w-[620px]">
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className="w-6 h-[2px] rounded-full"
                    style={{ background: "var(--wk-brand)", opacity: 0.6 }}
                  />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">
                    Stay Connected
                  </span>
                </div>

                <h2
                  className="font-black tracking-[-0.03em] text-[var(--wk-text)] mb-3"
                  style={{ fontSize: "clamp(22px,2.5vw,32px)", lineHeight: 1.05 }}
                >
                  The culture, in your inbox.
                </h2>

                <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)] mb-6">
                  Chart updates, new guides, editorial deep-dives, and early access to
                  new sections as they launch across WAKILISHA.
                </p>

                <form
                  className="flex flex-col sm:flex-row gap-3"
                  action="https://readdy.ai/api/form/d8m5rsojb57qogjbh760"
                  method="POST"
                  data-readdy-form=""
                >
                  <div className="flex-1">
                    <input
                      type="email"
                      name="email"
                      placeholder="Enter your email"
                      required
                      className="w-full rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-5 py-3.5 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)]/40 transition-colors"
                    />
                  </div>
                  <WkButton variant="primary">
                    <i className="ri-mail-send-line" /> Subscribe
                  </WkButton>
                </form>

                <div className="mt-4 flex items-center gap-4 text-[11px] text-[var(--wk-text-faint)]">
                  <span className="inline-flex items-center gap-1">
                    <i className="ri-shield-check-line text-xs" /> No spam, ever
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <i className="ri-close-circle-line text-xs" /> Unsubscribe anytime
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}