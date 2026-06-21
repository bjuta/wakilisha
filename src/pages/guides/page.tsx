import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPublishedGuides } from "@/services/guidePages";
import type { GuidePageRecord } from "@/pages/guides/detail/sectionTypes";
import { NewsletterSubscribe } from "@/components/feature/NewsletterSubscribe";

/* ─── Format to visual mapping ─── */

const FORMAT_STYLES: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  "Field guide": {
    color: "#9C8FF5",
    bg: "rgba(156,143,245,0.10)",
    border: "rgba(156,143,245,0.25)",
    icon: "ri-map-2-line",
  },
  "Advance dossier": {
    color: "#D6766A",
    bg: "rgba(214,118,106,0.10)",
    border: "rgba(214,118,106,0.25)",
    icon: "ri-folder-open-line",
  },
  "Literary project": {
    color: "#C4A35A",
    bg: "rgba(196,163,90,0.10)",
    border: "rgba(196,163,90,0.25)",
    icon: "ri-book-open-line",
  },
};

const DEFAULT_STYLE = { color: "#888", bg: "rgba(136,136,136,0.10)", border: "rgba(136,136,136,0.25)", icon: "ri-file-text-line" };

/* ─── Scroll reveal ─── */

function useGuidesScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("guides-reveal-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -32px 0px" },
    );
    const els = document.querySelectorAll(".guides-reveal");
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

/* ─── Newsletter ─── */

function GuidesNewsletter() {
  return (
    <section className="guides-reveal">
      <NewsletterSubscribe
        formAction="https://readdy.ai/api/form/d8qhqude8ise6dlc8d90"
        formId="guides-newsletter-form"
        headline="Guides delivered first"
        description="Get WAKILISHA guides — field reports, dossiers, literary projects — as soon as they launch. No noise, just signal."
        contextFields={{ wk_page_type: "guides_listing", wk_source_section: "newsletter_footer" }}
        analytics={{
          pageType: "guides_listing",
        }}
      />
    </section>
  );
}

/* ─── Format explainer ─── */

function FormatExplainer() {
  return (
    <div className="guides-reveal">
      <div className="flex items-center gap-3 mb-8">
        <span className="w-6 h-px bg-[var(--wk-brand)]" />
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)]">Formats</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[
          { icon: "ri-map-2-line", label: "Field Guide", desc: "On-the-ground routes through exhibitions, cities, and cultural events. Practical, mapped, opinionated." },
          { icon: "ri-folder-open-line", label: "Advance Dossier", desc: "Pre-event intelligence: themes, artists, architecture, and reporting angles before the programme drops." },
          { icon: "ri-book-open-line", label: "Literary Project", desc: "Long-form cultural investigation. Books, reading, memory, infrastructure — the slow work of ideas." },
        ].map((format) => (
          <div key={format.label} className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 lg:p-7">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--wk-bg-subtle)] mb-4">
              <i className={`${format.icon} text-[20px] text-[var(--wk-brand)]`} />
            </div>
            <h4 className="text-[15px] font-black tracking-[-0.02em] text-[var(--wk-text)] mb-2">{format.label}</h4>
            <p className="text-[13px] leading-relaxed text-[var(--wk-text-muted)]">{format.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── GuideCard ─── */

function GuideCard({ guide, featured }: { guide: GuidePageRecord; featured?: boolean }) {
  const format = guide.guide_format || "";
  const style = FORMAT_STYLES[format] || DEFAULT_STYLE;
  const heroUrl = guide.hero_url || "";

  return (
    <Link
      to={`/guides/${guide.slug}`}
      className={`group relative rounded-2xl overflow-hidden bg-[#0a0a0a] flex items-end cursor-pointer ${featured ? "min-h-[520px]" : "min-h-[248px]"}`}
    >
      {heroUrl && (
        <img src={heroUrl} alt={guide.title} className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105" />
      )}
      <div className={`absolute inset-0 bg-gradient-to-t ${featured ? "from-black/95 via-black/50 to-black/10" : "from-black/90 via-black/45 to-black/15"}`} />

      <div className={`relative z-10 w-full ${featured ? "p-8 lg:p-10" : "p-6"}`}>
        <div className="flex items-center gap-2 mb-2.5">
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] border backdrop-blur-md"
            style={{ background: style.bg, borderColor: style.border, color: style.color }}
          >
            {format}
          </span>
          {guide.subtitle && (
            <span className="text-[9px] font-bold text-white/35 tracking-[0.05em] uppercase">{guide.subtitle}</span>
          )}
        </div>
        <h3 className={`font-black tracking-[-0.03em] leading-[0.96] text-white mb-2 group-hover:opacity-90 transition-opacity ${featured ? "text-[clamp(28px,3vw,40px)]" : "text-[20px] lg:text-[24px]"}`}>
          {guide.title}
        </h3>
        {guide.excerpt && (
          <p className={`leading-relaxed text-white/50 line-clamp-2 ${featured ? "text-[14px] lg:text-[15px] max-w-[480px]" : "text-[12px] lg:text-[13px]"}`}>
            {guide.excerpt}
          </p>
        )}
        <div className={`mt-3 inline-flex items-center gap-1.5 font-bold text-white/50 group-hover:text-white group-hover:gap-2.5 transition-all ${featured ? "text-[13px]" : "text-[12px]"}`}>
          Read guide <i className="ri-arrow-right-line text-[11px]" />
        </div>
      </div>
    </Link>
  );
}

/* ─── Main ─── */

export default function GuidesPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);
  const [guides, setGuides] = useState<GuidePageRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useGuidesScrollReveal();

  useEffect(() => {
    fetchPublishedGuides().then((data) => {
      setGuides(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    const img = heroImgRef.current;
    if (!hero || !img) return;
    const onScroll = () => {
      const scrollY = window.scrollY;
      const h = hero.offsetHeight;
      const p = Math.min(scrollY / h, 1);
      img.style.transform = `scale(${1 + p * 0.06})`;
      img.style.opacity = String(Math.max(0.85 - p * 0.35, 0.35));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const count = guides.length;

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      {/* Hero */}
      <div ref={heroRef} className="relative min-h-[90vh] flex items-end overflow-hidden bg-[#0a0a0a] -mt-16">
        <img ref={heroImgRef}
          src="https://readdy.ai/api/search-image?query=Abstract%20editorial%20composition%20with%20overlapping%20translucent%20maps%20and%20architectural%20diagrams%20floating%20in%20warm%20amber%20and%20deep%20charcoal%20space%2C%20soft%20atmospheric%20light%20rays%20cutting%20through%20dust%2C%20museum%20gallery%20aesthetic%2C%20contemporary%20art%20publication%20vibe%2C%20cinematic%20depth%2C%20rich%20textures%2C%20editorial%20photography%20style%20with%20film%20grain&width=1800&height=1200&seq=guides-hero-2026&orientation=landscape"
          alt="" className="absolute inset-0 w-full h-full object-cover will-change-transform"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/35 to-black/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/30" />

        <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 lg:px-8 pb-20 pt-28 text-white">
          <div className="max-w-[720px]">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-8 h-px bg-white/40" />
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-white/60">WAKILISHA Guides</span>
              {!loading && (
                <span className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/70 text-[10px] font-bold px-2.5 py-0.5 tracking-[0.04em]">
                  {count} guide{count !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <h1 className="text-[clamp(48px,7vw,88px)] font-black tracking-[-0.05em] leading-[0.90] mb-6">
              Your discovery layer for African creative life
            </h1>
            <p className="text-[clamp(16px,2vw,20px)] leading-relaxed text-white/55 max-w-[540px]">
              Where to go, what to experience, who to know — practical guides built for the culture, not the algorithm.
            </p>
            <div className="flex items-center gap-8 mt-10 flex-wrap">
              {[
                { value: "Venice", label: "Biennale coverage" },
                { value: "Dakar", label: "Advance dossier" },
                { value: "Nairobi", label: "Literary project" },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center gap-3">
                  <span className="text-[32px] font-black tracking-[-0.03em] text-white">{stat.value}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40 leading-tight max-w-[80px]">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 hidden lg:flex flex-col items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">Scroll</span>
          <div className="w-px h-10 bg-gradient-to-b from-white/30 to-transparent" />
        </div>
      </div>

      {/* Content body */}
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 flex flex-col gap-20 py-20">
        {/* Section header */}
        <div className="guides-reveal flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-6 h-px bg-[var(--wk-brand)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)]">The Collection</span>
            </div>
            <h2 className="text-[clamp(28px,3.5vw,44px)] font-black tracking-[-0.04em] leading-[0.96] text-[var(--wk-text)]">
              {count === 0 ? "No guides yet" : `${count} way${count !== 1 ? "s" : ""} into the culture`}
            </h2>
          </div>
        </div>

        {/* Guide cards */}
        {loading ? (
          <div className="guides-reveal grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-3 rounded-2xl bg-[var(--wk-surface)] animate-pulse min-h-[520px]" />
            <div className="lg:col-span-2 grid gap-5 lg:grid-rows-2">
              <div className="rounded-2xl bg-[var(--wk-surface)] animate-pulse min-h-[248px]" />
              <div className="rounded-2xl bg-[var(--wk-surface)] animate-pulse min-h-[248px]" />
            </div>
          </div>
        ) : guides.length === 0 ? (
          <div className="guides-reveal text-center py-20">
            <p className="text-[16px] text-[var(--wk-text-muted)]">No guides published yet. Check back soon.</p>
          </div>
        ) : (
          <div className="guides-reveal grid grid-cols-1 lg:grid-cols-5 gap-5 lg:items-stretch">
            {/* First guide = featured */}
            <GuideCard guide={guides[0]} featured />

            {/* Remaining guides = stacked */}
            <div className="lg:col-span-2 grid grid-cols-1 gap-5 lg:grid-rows-auto">
              {guides.slice(1).map((guide) => (
                <div key={guide.slug} className="lg:row-span-1">
                  <GuideCard guide={guide} />
                </div>
              ))}
              {/* If only 1 or 2 guides, fill remaining space to avoid layout issues */}
              {guides.length < 3 && (
                <div className="hidden lg:block rounded-2xl border border-dashed border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] min-h-[248px]" />
              )}
            </div>
          </div>
        )}

        {/* Pullquote */}
        <div className="guides-reveal border-y border-[var(--wk-border)] py-16 lg:py-24">
          <div className="max-w-[760px] mx-auto text-center">
            <div className="w-10 h-1 rounded-full bg-[var(--wk-brand)] mx-auto mb-6" />
            <p className="text-[clamp(24px,3.5vw,44px)] font-black tracking-[-0.045em] leading-[0.96] text-[var(--wk-text)]">
              Culture doesn't need more noise. It needs signal.
            </p>
            <p className="mt-5 text-[15px] text-[var(--wk-text-muted)] max-w-[480px] mx-auto leading-relaxed">
              Each guide is a focused, edited, resourced route into one corner of African creative life — built to be useful, not just beautiful.
            </p>
            <div className="w-10 h-1 rounded-full bg-[var(--wk-brand)] mx-auto mt-6" />
          </div>
        </div>

        {/* Format explainer */}
        <FormatExplainer />

        {/* Newsletter */}
        <GuidesNewsletter />

        {/* Footer */}
        <footer className="guides-reveal border-t border-[var(--wk-border)] pt-14 pb-8 text-center">
          <span className="text-[9px] font-black uppercase tracking-[0.24em] text-[var(--wk-brand)] mb-3 block">WAKILISHA Guides</span>
          <p className="text-[24px] lg:text-[28px] font-black tracking-[-0.035em] text-[var(--wk-text)] leading-snug max-w-[480px] mx-auto">
            Practical discovery for African creative life.
          </p>
          <div className="mt-4 flex items-center justify-center gap-1 text-[12px] text-[var(--wk-text-faint)]">
            <span>{count} guide{count !== 1 ? "s" : ""} published</span>
            <span className="text-[var(--wk-border-strong)]">·</span>
            <span>Updated June 2026</span>
          </div>
        </footer>
      </div>

      <style>{`
        .guides-reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.7s var(--wk-ease-standard), transform 0.7s var(--wk-ease-standard); }
        .guides-reveal-visible { opacity: 1; transform: translateY(0); }
      `}</style>
    </main>
  );
}