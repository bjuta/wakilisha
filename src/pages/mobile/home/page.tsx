import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { WkButton } from "@/components/design-system/primitives/Button";
import { StoryCard } from "@/components/design-system/editorial/StoryCard";
import { SkeletonStoryCard } from "@/components/skeletons/Skeletons";
import { HomeHero } from "@/pages/home/components/HomeHero";
import { HomeMarquee } from "@/pages/home/components/HomeMarquee";
import { HomeCollage } from "@/pages/home/components/HomeCollage";
import { HomeFeatured } from "@/pages/home/components/HomeFeatured";
import { HomeMission } from "@/pages/home/components/HomeMission";
import { listMagazineStories, type RepairedStory } from "@/services/repairedContent/client";
import { getChartFamilies, getLatestChartEdition, getChartEditionEntries, type ChartEditionEntry } from "@/services/chartsPublic/client";

function CompactStoryCard({ story }: { story: { slug: string; title: string; section?: string; dek?: string; date?: string; readingTime?: number; heroUrl?: string; author?: string } }) {
  return (
    <Link
      to={`/magazine/${story.slug}`}
      className="group flex gap-3 sm:gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 sm:p-4 hover:border-[var(--wk-border-strong)] hover:bg-[var(--wk-surface-raised)] transition-all duration-300 w-full h-full"
    >
      <div className="w-20 sm:w-24 shrink-0 rounded-lg overflow-hidden bg-[var(--wk-surface-raised)] self-stretch min-h-[70px] sm:min-h-[90px]">
        {story.heroUrl && (
          <img src={story.heroUrl} alt="" className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-110" />
        )}
      </div>
      <div className="flex flex-col justify-center gap-1 sm:gap-1.5 flex-1 min-w-0">
        {story.section && (
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">{story.section}</span>
        )}
        <h4 className="text-[13px] sm:text-[14px] font-black tracking-[-0.02em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-2">
          {story.title}
        </h4>
        {story.dek && (
          <p className="text-[11px] sm:text-[12px] leading-relaxed text-[var(--wk-text-soft)] line-clamp-2 sm:line-clamp-3">
            {story.dek.length > 140 ? story.dek.slice(0, 140).trimEnd() + "\u2026" : story.dek}
          </p>
        )}
        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-[var(--wk-text-faint)] mt-auto pt-1">
          {story.author && (
            <>
              <span className="font-semibold truncate max-w-[12ch] sm:max-w-[14ch]">{story.author}</span>
              <span className="text-[var(--wk-border-strong)] shrink-0">·</span>
            </>
          )}
          {story.readingTime && <span className="shrink-0">{story.readingTime} min</span>}
        </div>
      </div>
    </Link>
  );
}

export default function MobileHome() {
  const [scrollY, setScrollY] = useState(0);
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

      const { data: families } = await getChartFamilies();
      if (families.length > 0) {
        const slug = families[0].publicSlug ?? families[0].slug ?? families[0].familyKey;
        const { data: edition } = await getLatestChartEdition(slug);
        if (edition) {
          const { data: entries } = await getChartEditionEntries(slug, edition.slug);
          setChartEntries(entries);
        }
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const on = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const editorialStories = stories.slice(0, 4);

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: "var(--wk-bg)" }}>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(1000px 560px at 8% -4%, rgba(132,194,65,0.08), transparent 55%),
            radial-gradient(760px 600px at 102% 0%, rgba(107,168,245,0.03), transparent 50%)
          `,
        }}
      />

      <div className="relative z-[1]">
        <HomeHero scrollY={scrollY} />
        <HomeMarquee />
        <HomeCollage />
        <HomeFeatured chartEntries={chartEntries} loading={loading} />

        <HomeMission />

        {loadError && (
          <div className="border-b border-[var(--wk-danger)]/20 bg-[var(--wk-danger-soft)] px-4 sm:px-6 py-3">
            <div className="flex items-center gap-2 text-[12px] sm:text-[13px] text-[var(--wk-danger)]" style={{ maxWidth: 1180, margin: "0 auto" }}>
              <i className="ri-error-warning-line shrink-0" />
              <span className="truncate">Some data could not load</span>
              <button onClick={loadData} className="ml-auto font-bold underline underline-offset-2 cursor-pointer shrink-0">
                Retry
              </button>
            </div>
          </div>
        )}

        <section className="py-12 sm:py-16 md:py-24 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg)" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 clamp(20px,4vw,40px)" }}>
            <div className="flex items-end justify-between gap-5 flex-wrap mb-8 sm:mb-10 md:mb-14">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-8 h-[2px] rounded-full" style={{ background: "var(--wk-v-film)" }} />
                  <span className="text-[10px] font-black text-[var(--wk-text-faint)] uppercase tracking-[0.22em]">Magazine</span>
                </div>
                <h2 className="font-black tracking-[-0.04em] text-[var(--wk-text)]" style={{ fontSize: "clamp(24px,3.5vw,48px)", lineHeight: 0.92 }}>
                  Editorial
                </h2>
              </div>
              <Link to="/magazine" className="hidden sm:block whitespace-nowrap">
                <WkButton variant="ghost">
                  Open Magazine <i className="ri-arrow-right-line" />
                </WkButton>
              </Link>
            </div>

            {loading ? (
              <div className="grid gap-4 lg:grid-cols-5 lg:items-stretch">
                <div className="lg:col-span-3">
                  <SkeletonStoryCard />
                </div>
                <div className="lg:col-span-2 grid grid-cols-1 gap-4" style={{ gridTemplateRows: "repeat(3, 1fr)" }}>
                  <div className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] h-20 sm:h-auto" />
                  <div className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] h-20 sm:h-auto" />
                  <div className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] h-20 sm:h-auto" />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-5 lg:items-stretch">
                <div className="lg:col-span-3 lg:h-full">
                  {editorialStories[0] && <StoryCard {...editorialStories[0]} isFeatured />}
                </div>
                <div className="lg:col-span-2 grid grid-cols-1 gap-4" style={{ gridTemplateRows: "repeat(3, 1fr)" }}>
                  {editorialStories.slice(1, 4).map((story) => (
                    <CompactStoryCard key={story.slug} story={story} />
                  ))}
                </div>
                <Link to="/magazine" className="sm:hidden mt-2 text-center text-[13px] font-semibold text-[var(--wk-brand)] whitespace-nowrap">
                  Open Magazine <i className="ri-arrow-right-line text-xs" />
                </Link>
              </div>
            )}
          </div>
        </section>

        <section className="py-12 sm:py-16 md:py-24 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg-subtle)" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 clamp(20px,4vw,40px)" }}>
            <div className="relative rounded-2xl overflow-hidden" style={{ background: "var(--wk-surface)" }}>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-20 -left-20 w-[200px] sm:w-[350px] h-[200px] sm:h-[350px] rounded-full opacity-[0.04]"
                style={{ background: "var(--wk-brand)" }}
              />
              <div className="relative z-10 p-6 sm:p-8 md:p-12 max-w-[600px]">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-6 h-[2px] rounded-full opacity-50" style={{ background: "var(--wk-brand)" }} />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">
                    Stay Connected
                  </span>
                </div>
                <h2 className="font-black tracking-[-0.03em] text-[var(--wk-text)] mb-3" style={{ fontSize: "clamp(20px,2.5vw,32px)", lineHeight: 1.0 }}>
                  The ecosystem, in your inbox.
                </h2>
                <p className="text-[13px] sm:text-[14px] leading-relaxed text-[var(--wk-text-soft)] mb-6">
                  Chart updates, new guides, editorial deep-dives, and early access to
                  new verticals as they launch across African creative life.
                </p>
                <form
                  className="flex flex-col sm:flex-row gap-3"
                  action="https://readdy.ai/api/form/d8gs0igb91vaa813drjg"
                  method="POST"
                  data-readdy-form=""
                >
                  <div className="flex-1">
                    <input
                      type="email"
                      name="email"
                      placeholder="Enter your email"
                      required
                      className="w-full rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-5 py-3.5 text-[13px] sm:text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)]/40 transition-colors"
                    />
                  </div>
                  <WkButton variant="primary">
                    <i className="ri-mail-send-line" /> Subscribe
                  </WkButton>
                </form>
                <div className="mt-4 flex items-center gap-4 text-[10px] sm:text-[11px] text-[var(--wk-text-faint)]">
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