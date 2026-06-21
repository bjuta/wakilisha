import { useState, useEffect, useCallback } from "react";
import { WkButton } from "@/components/design-system/primitives/Button";
import { HomeHero } from "@/pages/home/components/HomeHero";
import { HomeMarquee } from "@/pages/home/components/HomeMarquee";
import { HomeRightNow } from "@/pages/home/components/HomeRightNow";
import { HomeExplore } from "@/pages/home/components/HomeExplore";
import { HomeMission } from "@/pages/home/components/HomeMission";
import { listMagazineStories, type PublicStory } from "@/services/publicContent/client";
import { getChartFamilies, getLatestChartEdition, getChartEditionEntries, type ChartEditionEntry } from "@/services/chartsPublic/client";
import { trackEvent, getAnalyticsSessionId, getCanonicalPageUrl } from "@/services/analytics";
import { submitForm } from "@/services/formService";

export default function MobileHome() {
  const [loading, setLoading] = useState(true);
  const [chartEntries, setChartEntries] = useState<ChartEditionEntry[]>([]);
  const [stories, setStories] = useState<PublicStory[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const handleNewsletterSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const emailInput = form.querySelector('input[name="email"]') as HTMLInputElement;
    if (!emailInput || !emailInput.value.trim()) return;

    trackEvent("newsletter_signup", {
      pageType: "home",
      context: { sourceSection: "newsletter_footer", formId: "homepage-newsletter-mobile" },
    });

    setNewsletterStatus("submitting");
    const formData = new FormData(form);
    const submission: Record<string, string> = { form_type: "newsletter" };
    formData.forEach((value, key) => {
      submission[key] = String(value);
    });

    const result = await submitForm(submission);
    if (result.success) {
      setNewsletterStatus("success");
      form.reset();
    } else {
      setNewsletterStatus("error");
    }
  };

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
      setLoadError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: "var(--wk-bg)" }}>
      <div className="relative z-[1]">
        <HomeHero chartEntries={chartEntries} stories={stories} loading={loading} />
        <HomeMarquee />
        <HomeRightNow chartEntries={chartEntries} stories={stories} loading={loading} />
        <HomeExplore />
        <HomeMission />

        {loadError && (
          <div className="border-t border-[var(--wk-danger)]/20 bg-[var(--wk-danger-soft)] px-4 sm:px-6 py-3">
            <div className="flex items-center gap-2 text-[12px] sm:text-[13px] text-[var(--wk-danger)]" style={{ maxWidth: 1180, margin: "0 auto" }}>
              <i className="ri-error-warning-line shrink-0" />
              <span className="truncate">Some data could not load</span>
              <button onClick={loadData} className="ml-auto font-bold underline underline-offset-2 cursor-pointer shrink-0">
                Retry
              </button>
            </div>
          </div>
        )}

        <section className="py-12 sm:py-16 md:py-24 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg-subtle)" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 clamp(20px,4vw,40px)" }}>
            <div className="relative rounded-2xl overflow-hidden border border-[var(--wk-border)]" style={{ background: "var(--wk-surface)" }}>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-20 -left-20 w-[200px] sm:w-[350px] h-[200px] sm:h-[350px] rounded-full"
                style={{ background: "var(--wk-brand)", opacity: 0.03 }}
              />
              <div className="relative z-10 p-6 sm:p-8 md:p-12 max-w-[620px]">
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
                  onSubmit={handleNewsletterSubmit}
                >
                  <input type="hidden" name="wk_session_id" value={getAnalyticsSessionId()} />
                  <input type="hidden" name="wk_page_url" value={getCanonicalPageUrl()} />
                  <input type="hidden" name="wk_page_type" value="home" />
                  <input type="hidden" name="wk_source_section" value="newsletter_footer" />
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