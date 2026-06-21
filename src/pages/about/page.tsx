import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { WkButton } from "@/components/design-system/primitives/Button";
import { trackEvent, getAnalyticsSessionId, getCanonicalPageUrl } from "@/services/analytics";
import { submitForm } from "@/services/formService";

function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("hp-reveal-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.06, rootMargin: "0px 0px -24px 0px" },
    );
    const els = document.querySelectorAll(".hp-reveal");
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

function AboutNewsletter() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const submission: Record<string, string> = { form_type: "newsletter" };
    formData.forEach((value, key) => {
      submission[key] = String(value);
    });

    trackEvent("newsletter_signup", {
      pageType: "about",
      context: { sourceSection: "newsletter_footer", formId: "about-newsletter" },
    });

    const result = await submitForm(submission);
    if (result.success) setDone(true);
  };

  return (
    <section className="hp-reveal rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
      {done ? (
        <div className="py-16 px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--wk-brand)] flex items-center justify-center mx-auto mb-5">
            <i className="ri-check-line text-[28px] text-[var(--wk-brand-on)]" />
          </div>
          <h3 className="text-[24px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">You're in</h3>
          <p className="text-[14px] text-[var(--wk-text-muted)] max-w-[380px] mx-auto leading-relaxed">
            Charts, guides, and editorial deep-dives delivered to your inbox. Welcome to the ecosystem.
          </p>
        </div>
      ) : (
        <div className="py-14 px-6 text-center max-w-[580px] mx-auto">
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-4">
            <i className="ri-mail-line text-[15px]" /> Stay connected
          </span>
          <h2 className="text-[clamp(28px,3vw,38px)] font-black tracking-[-0.04em] text-[var(--wk-text)] leading-tight mb-3">The ecosystem, in your inbox</h2>
          <p className="text-[14px] text-[var(--wk-text-muted)] leading-relaxed mb-8">
            Chart updates, new guides, editorial deep-dives, and early access to everything we build across African creative life.
          </p>
          <form onSubmit={handleSubmit} className="flex gap-3 max-w-[480px] mx-auto">
            <input type="hidden" name="wk_session_id" value={getAnalyticsSessionId()} />
            <input type="hidden" name="wk_page_url" value={getCanonicalPageUrl()} />
            <input type="hidden" name="wk_page_type" value="about" />
            <input type="hidden" name="wk_source_section" value="newsletter_footer" />
            <div className="relative flex-1">
              <i className="ri-mail-line absolute left-4 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)] text-[17px] pointer-events-none" />
              <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required className="w-full h-12 rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] pl-11 pr-4 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors" />
            </div>
            <button type="submit" className="h-12 px-7 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[14px] font-extrabold hover:-translate-y-0.5 transition-transform whitespace-nowrap shrink-0 cursor-pointer">Subscribe</button>
          </form>
          <p className="mt-4 text-[11px] font-semibold text-[var(--wk-text-faint)]">No spam. Unsubscribe anytime.</p>
        </div>
      )}
    </section>
  );
}

const WHAT_WE_DO = [
  {
    icon: "ri-bar-chart-grouped-line",
    title: "Charts",
    desc: "Weekly music charts built from real data across African markets — transparent methodology, country-specific editions, and a transparent scoring engine that rewards genuine listener engagement.",
    to: "/charts",
    color: "var(--wk-brand)",
  },
  {
    icon: "ri-newspaper-line",
    title: "Magazine",
    desc: "Editorial coverage of African creative life — long-form features, artist profiles, release reviews, and cultural commentary that goes deeper than the algorithm.",
    to: "/magazine",
    color: "var(--wk-brand)",
  },
  {
    icon: "ri-compass-3-line",
    title: "Guides",
    desc: "Practical discovery layers for African creative life. Field guides, advance dossiers, and literary projects — built to be useful, not just beautiful.",
    to: "/guides",
    color: "var(--wk-brand)",
  },
  {
    icon: "ri-mic-line",
    title: "Artist Registry",
    desc: "A growing database of African artists, their discographies, biographies, and connections — the foundation for everything we build.",
    to: "/artists",
    color: "var(--wk-brand)",
  },
];

export default function AboutPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);

  useScrollReveal();

  useEffect(() => {
    const hero = heroRef.current;
    const img = heroImgRef.current;
    if (!hero || !img) return;
    const onScroll = () => {
      const scrollY = window.scrollY;
      const h = hero.offsetHeight;
      const p = Math.min(scrollY / h, 1);
      img.style.transform = `scale(${1 + p * 0.05})`;
      img.style.opacity = String(Math.max(0.85 - p * 0.3, 0.4));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      {/* Hero */}
      <div ref={heroRef} className="relative min-h-[85vh] flex items-end overflow-hidden bg-[#0a0a0a] -mt-16">
        <img
          ref={heroImgRef}
          src="https://readdy.ai/api/search-image?query=Cinematic%20portrait%20composition%20of%20creative%20community%20gathering%20in%20warm%20amber%20and%20olive%20ambient%20light%2C%20silhouettes%20and%20profiles%20of%20people%20in%20conversation%20and%20creative%20exchange%2C%20soft%20atmospheric%20haze%20with%20golden%20hour%20light%20rays%20streaming%20across%20the%20frame%2C%20shallow%20depth%20of%20field%20highlighting%20human%20connection%20and%20cultural%20exchange%2C%20film%20grain%20texture%20with%20rich%20warm%20shadows%20and%20glowing%20highlights%2C%20editorial%20documentary%20photography%20style%20with%20intimate%20candid%20quality%2C%20African%20creative%20scene%20modern%20contemporary%20aesthetic&width=1800&height=1100&seq=about-hero-2026-wk-v2&orientation=landscape"
          alt=""
          className="absolute inset-0 w-full h-full object-cover will-change-transform"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/35 to-black/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/30" />

        <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 lg:px-8 pb-20 pt-28 text-white">
          <div className="max-w-[720px]">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-8 h-px bg-white/40" />
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-white/60">About WAKILISHA</span>
            </div>
            <h1 className="text-[clamp(48px,7vw,88px)] font-black tracking-[-0.05em] leading-[0.90] mb-6">
              A home for African creative life
            </h1>
            <p className="text-[clamp(16px,2vw,20px)] leading-relaxed text-white/55 max-w-[540px]">
              Music first, then stories, artists, guides, and everything that moves the culture forward. We're building the discovery layer African creativity deserves.
            </p>
            <div className="flex items-center gap-8 mt-10 flex-wrap">
              {[
                { value: "2024", label: "Founded" },
                { value: "4", label: "Products" },
                { value: "Nairobi", label: "Based in" },
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

      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 flex flex-col gap-20 py-20">
        {/* Mission */}
        <div className="hp-reveal border-y border-[var(--wk-border)] py-16 lg:py-24">
          <div className="max-w-[760px] mx-auto text-center">
            <div className="w-10 h-1 rounded-full bg-[var(--wk-brand)] mx-auto mb-6" />
            <p className="text-[clamp(24px,3.5vw,44px)] font-black tracking-[-0.045em] leading-[0.96] text-[var(--wk-text)]">
              Your people are here. Your music is here. Your stories deserve a home that understands them.
            </p>
            <p className="mt-5 text-[15px] text-[var(--wk-text-muted)] max-w-[520px] mx-auto leading-relaxed">
              WAKILISHA exists because African creativity needed infrastructure, not just attention. We're building the permanent record — the registry, the charts, the guides, the stories — so the culture can be discovered, understood, and built upon.
            </p>
            <div className="w-10 h-1 rounded-full bg-[var(--wk-brand)] mx-auto mt-6" />
          </div>
        </div>

        {/* What we do */}
        <div className="hp-reveal">
          <div className="flex items-center gap-3 mb-8">
            <span className="w-6 h-px bg-[var(--wk-brand)]" />
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)]">What we build</span>
          </div>
          <h2 className="text-[clamp(28px,3.5vw,44px)] font-black tracking-[-0.04em] leading-[0.96] text-[var(--wk-text)] mb-12">
            Four products, one ecosystem
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {WHAT_WE_DO.map((item) => (
              <Link
                key={item.title}
                to={item.to}
                className="group rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 lg:p-8 hover:border-[var(--wk-border-2)] transition-all duration-300 cursor-pointer"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wk-bg-subtle)] mb-5 group-hover:bg-[var(--wk-brand-soft)] transition-colors">
                  <i className={`${item.icon} text-[22px] text-[var(--wk-text-soft)] group-hover:text-[var(--wk-brand)] transition-colors`} />
                </div>
                <h3 className="text-[18px] font-black tracking-[-0.02em] text-[var(--wk-text)] mb-2">{item.title}</h3>
                <p className="text-[13px] leading-relaxed text-[var(--wk-text-muted)] mb-4">{item.desc}</p>
                <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--wk-text-faint)] group-hover:text-[var(--wk-brand)] transition-colors">
                  Explore {item.title.toLowerCase()} <i className="ri-arrow-right-line text-[11px]" />
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Values */}
        <div className="hp-reveal">
          <div className="flex items-center gap-3 mb-8">
            <span className="w-6 h-px bg-[var(--wk-brand)]" />
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)]">Our principles</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { icon: "ri-database-2-line", title: "Permanent infrastructure", desc: "We build registries, charts, and editorial archives that outlast trends. African creativity deserves a permanent address on the internet." },
              { icon: "ri-scales-3-line", title: "Transparent methodology", desc: "Our charts use open scoring engines. Our guides cite sources. Our editorial has bylines. No black boxes, no algorithmic mysticism." },
              { icon: "ri-global-line", title: "Continental by design", desc: "Built for African markets first — local charts, regional guides, and editorial that understands context without exoticising it." },
            ].map((v) => (
              <div key={v.title} className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 lg:p-7">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--wk-bg-subtle)] mb-4">
                  <i className={`${v.icon} text-[20px] text-[var(--wk-text-soft)]`} />
                </div>
                <h4 className="text-[15px] font-black tracking-[-0.02em] text-[var(--wk-text)] mb-2">{v.title}</h4>
                <p className="text-[13px] leading-relaxed text-[var(--wk-text-muted)]">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Newsletter */}
        <AboutNewsletter />

        {/* Footer */}
        <footer className="hp-reveal border-t border-[var(--wk-border)] pt-14 pb-8 text-center">
          <span className="text-[9px] font-black uppercase tracking-[0.24em] text-[var(--wk-brand)] mb-3 block">WAKILISHA</span>
          <p className="text-[24px] lg:text-[28px] font-black tracking-[-0.035em] text-[var(--wk-text)] leading-snug max-w-[480px] mx-auto">
            Your people are here.
          </p>
          <div className="mt-4 flex items-center justify-center gap-1 text-[12px] text-[var(--wk-text-faint)]">
            <span>Built in Nairobi</span>
            <span className="text-[var(--wk-border-strong)]">·</span>
            <span>Est. 2024</span>
          </div>
        </footer>
      </div>

      <style>{`
        .hp-reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.7s var(--wk-ease-standard), transform 0.7s var(--wk-ease-standard); }
        .hp-reveal-visible { opacity: 1; transform: translateY(0); }
      `}</style>
    </main>
  );
}