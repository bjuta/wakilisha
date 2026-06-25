import { useState } from "react";
import { Link } from "react-router-dom";
import { trackEvent, getAnalyticsSessionId, getCanonicalPageUrl } from "@/services/analytics";
import { BRIEFING_SLUGS, briefingInterest, subscribeToBriefings } from "@/services/audienceSubscriptionService";

const guideEntries = [
  {
    slug: "the-day-reading-changed",
    title: "The Day Reading Changed",
    excerpt:
      "A WAKILISHA Books literary project by Wangari Karume on the reading cultures that shaped a generation and what fractured them. Prologue now open.",
    badge: "Guide 06",
    tagline: "Literary Series",
    accentColor: "#C4A35A",
    accentBg: "rgba(196,163,90,0.12)",
    accentBorder: "rgba(196,163,90,0.30)",
    image:
      "https://wakilisha.africa/wp-content/plugins/wakilisha-v2.0.201-cpt-cleanup/assets/guides/share/kenyan-literary-scene-share.jpg",
  },
  {
    slug: "dakar-biennale-2026",
    title: "Dakar Biennale 2026",
    excerpt:
      "A WAKILISHA advance dossier on Dak'Art 2026, built from the official call, internal regulations, theme, event architecture and early editorial signals.",
    badge: "Issue 002",
    tagline: "Advance Dossier",
    accentColor: "#D6766A",
    accentBg: "rgba(214,118,106,0.12)",
    accentBorder: "rgba(214,118,106,0.30)",
    image:
      "https://wakilisha.africa/wp-content/plugins/wakilisha-v2.0.201-cpt-cleanup/assets/guides/dakar-biennale-2026/WAKILISHA_Dakar_Biennale_2026.jpg",
  },
  {
    slug: "in-minor-keys",
    title: "In Minor Keys",
    excerpt:
      "A WAKILISHA field guide to Biennale Arte 2026, following the African artists, national pavilions, schools, routes and questions shaping Venice.",
    badge: "Issue 001",
    tagline: "Field Guide",
    accentColor: "#9C8FF5",
    accentBg: "rgba(156,143,245,0.12)",
    accentBorder: "rgba(156,143,245,0.30)",
    image:
      "https://wakilisha.africa/wp-content/plugins/wakilisha-v2.0.201-cpt-cleanup/assets/guides/in-minor-keys/p21-img1.webp",
  },
];

export default function MobileGuides() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const [subscribing, setSubscribing] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSubscribing(true);

    trackEvent("newsletter_signup", {
      pageType: "guides_listing",
      context: { sourceSection: "newsletter_footer", formId: "guides-newsletter-mobile", briefing_slugs: BRIEFING_SLUGS.fieldGuides },
    });

    try {
      await subscribeToBriefings(email, BRIEFING_SLUGS.fieldGuides, {
        sourceForm: "guides_mobile_newsletter",
        pageType: "guides_listing",
        pageUrl: getCanonicalPageUrl(),
        sessionId: getAnalyticsSessionId(),
        interests: [
          briefingInterest({
            slug: "field-guides",
            title: "Field Guides",
            sourceForm: "guides_mobile_newsletter",
            sourceContext: { source_section: "newsletter_footer", mobile: true },
          }),
        ],
      });
      setSubscribed(true);
    } catch {
      setSubscribed(false);
    }
    setSubscribing(false);
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--wk-bg)" }}>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#0a0a0a] min-h-[70vh] flex flex-col justify-end -mt-16">
        <img
          src="https://wakilisha.africa/api/search-image?query=Abstract%20editorial%20composition%20with%20overlapping%20translucent%20maps%20and%20architectural%20diagrams%20floating%20in%20warm%20amber%20and%20deep%20charcoal%20space%2C%20soft%20atmospheric%20light%20rays%20cutting%20through%20dust%2C%20museum%20gallery%20aesthetic%2C%20contemporary%20art%20publication%20vibe%2C%20cinematic%20depth%2C%20rich%20textures%2C%20editorial%20photography%20style%20with%20film%20grain&width=800&height=1000&seq=guides-mobile-hero&orientation=portrait"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/40 to-black/90" />

        <div className="relative z-10 px-5 pb-12 pt-20 text-white">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-px bg-white/40" />
            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/55">
              WAKILISHA Guides
            </span>
            <span className="inline-flex items-center rounded-full bg-white/10 border border-white/15 text-white/65 text-[9px] font-bold px-2 py-0.5">
              3 guides
            </span>
          </div>
          <h1 className="text-[32px] font-black tracking-[-0.04em] leading-[0.92] mb-3">
            Your discovery layer for African creative life
          </h1>
          <p className="text-[14px] leading-relaxed text-white/50 max-w-[320px]">
            Where to go, what to experience, who to know — practical guides built for the culture.
          </p>

          {/* City pills */}
          <div className="flex items-center gap-2 mt-6 flex-wrap">
            {["Venice", "Dakar", "Nairobi"].map((city) => (
              <span
                key={city}
                className="inline-flex items-center rounded-full bg-white/8 border border-white/12 text-white/70 text-[11px] font-bold px-3 py-1.5"
              >
                {city}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Guide cards */}
      <section className="px-5 py-10 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-5 h-px bg-[var(--wk-brand)]" />
          <span className="text-[9px] font-black uppercase tracking-[0.20em] text-[var(--wk-brand)]">
            The Collection
          </span>
        </div>

        {guideEntries.map((guide) => (
          <Link
            key={guide.slug}
            to={`/guides/${guide.slug}`}
            className="group relative block rounded-2xl overflow-hidden bg-[#0a0a0a] min-h-[280px] active:scale-[0.98] transition-transform cursor-pointer"
          >
            <img
              src={guide.image}
              alt={guide.title}
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/20" />

            <div className="relative z-10 p-5 flex flex-col justify-end h-full">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] border"
                  style={{
                    background: guide.accentBg,
                    borderColor: guide.accentBorder,
                    color: guide.accentColor,
                  }}
                >
                  {guide.badge}
                </span>
                <span className="text-[9px] font-bold text-white/35 uppercase tracking-[0.05em]">
                  {guide.tagline}
                </span>
              </div>
              <h3 className="text-[22px] font-black tracking-[-0.03em] leading-[0.94] text-white mb-2">
                {guide.title}
              </h3>
              <p className="text-[12px] leading-relaxed text-white/50 line-clamp-2 mb-3">
                {guide.excerpt}
              </p>
              <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-white/55 group-active:text-white transition-colors">
                Read guide
                <i className="ri-arrow-right-line text-[12px]" />
              </span>
            </div>
          </Link>
        ))}
      </section>

      {/* Formats explainer */}
      <section className="px-5 py-6">
        <div className="flex items-center gap-3 mb-5">
          <span className="w-5 h-px bg-[var(--wk-brand)]" />
          <span className="text-[9px] font-black uppercase tracking-[0.20em] text-[var(--wk-brand)]">
            Formats
          </span>
        </div>
        <div className="space-y-3">
          {[
            {
              icon: "ri-map-2-line",
              label: "Field Guide",
              desc: "On-the-ground routes through exhibitions, cities, and cultural events.",
            },
            {
              icon: "ri-folder-open-line",
              label: "Advance Dossier",
              desc: "Pre-event intelligence: themes, artists, and reporting angles.",
            },
            {
              icon: "ri-book-open-line",
              label: "Literary Project",
              desc: "Long-form cultural investigation — the slow work of ideas.",
            },
          ].map((format) => (
            <div
              key={format.label}
              className="flex items-start gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--wk-bg-subtle)]">
                <i className={`${format.icon} text-[18px] text-[var(--wk-brand)]`} />
              </div>
              <div>
                <h4 className="text-[14px] font-black text-[var(--wk-text)] mb-0.5">
                  {format.label}
                </h4>
                <p className="text-[12px] leading-relaxed text-[var(--wk-text-muted)]">
                  {format.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pullquote */}
      <section className="px-5 py-10">
        <div className="border-y border-[var(--wk-border)] py-10 text-center">
          <div className="w-8 h-0.5 rounded-full bg-[var(--wk-brand)] mx-auto mb-4" />
          <p className="text-[22px] font-black tracking-[-0.035em] leading-[0.96] text-[var(--wk-text)]">
            Culture doesn't need more noise. It needs signal.
          </p>
          <p className="mt-3 text-[13px] text-[var(--wk-text-muted)] max-w-[280px] mx-auto leading-relaxed">
            Each guide is built to be useful, not just beautiful.
          </p>
          <div className="w-8 h-0.5 rounded-full bg-[var(--wk-brand)] mx-auto mt-4" />
        </div>
      </section>

      {/* Newsletter */}
      <section className="px-5 pb-8">
        <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
          {subscribed ? (
            <div className="py-12 px-5 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--wk-brand)] flex items-center justify-center mx-auto mb-4">
                <i className="ri-check-line text-[24px] text-[var(--wk-brand-on)]" />
              </div>
              <h3 className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-1">
                You're on the list
              </h3>
              <p className="text-[13px] text-[var(--wk-text-muted)]">
                Guides delivered straight to your inbox.
              </p>
            </div>
          ) : (
            <div className="py-10 px-5 text-center">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)] mb-3">
                <i className="ri-mail-line text-[14px]" />
                Stay ahead
              </span>
              <h2 className="text-[22px] font-black tracking-[-0.035em] text-[var(--wk-text)] mb-2">
                Guides delivered first
              </h2>
              <p className="text-[13px] text-[var(--wk-text-muted)] mb-6">
                Get WAKILISHA guides as soon as they launch.
              </p>
              <form
                onSubmit={handleSubscribe}
                className="flex flex-col gap-3"
              >
                <input type="hidden" name="wk_session_id" value={getAnalyticsSessionId()} />
                <input type="hidden" name="wk_page_url" value={getCanonicalPageUrl()} />
                <input type="hidden" name="wk_page_type" value="guides_listing" />
                <input type="hidden" name="wk_source_section" value="newsletter_footer" />
                <div className="relative">
                  <i className="ri-mail-line absolute left-4 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)] text-[16px] pointer-events-none" />
                  <input
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full h-12 rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] pl-11 pr-4 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={subscribing}
                  className="h-12 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[14px] font-extrabold active:scale-[0.97] transition-transform whitespace-nowrap cursor-pointer disabled:opacity-60"
                >
                  {subscribing ? "Subscribing..." : "Subscribe"}
                </button>
              </form>
              <p className="mt-3 text-[11px] font-semibold text-[var(--wk-text-faint)]">
                No spam. Unsubscribe anytime.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-5 pb-10 pt-4 text-center">
        <span className="text-[9px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-2 block">
          WAKILISHA Guides
        </span>
        <p className="text-[18px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-1">
          Practical discovery for African creative life.
        </p>
        <p className="text-[11px] text-[var(--wk-text-faint)]">
          3 guides · Updated June 2026
        </p>
      </footer>
    </div>
  );
}