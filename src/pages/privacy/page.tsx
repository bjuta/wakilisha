import { useEffect, useRef } from "react";

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

export default function PrivacyPage() {
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

  const lastModified = "2026-06-19";

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      {/* Hero */}
      <div ref={heroRef} className="relative min-h-[40vh] flex items-end overflow-hidden bg-[#0a0a0a] -mt-16">
        <img
          ref={heroImgRef}
          src="https://readdy.ai/api/search-image?query=Cinematic%20portrait%20of%20a%20solitary%20human%20figure%20in%20contemplative%20repose%20bathed%20in%20warm%20amber%20and%20olive%20ambient%20light%2C%20soft%20golden%20hour%20illumination%20wrapping%20gently%20around%20shoulders%20and%20profile%2C%20intimate%20close%20up%20composition%20conveying%20trust%20protection%20and%20quiet%20dignity%2C%20shallow%20depth%20of%20field%20with%20warm%20blurred%20background%20dissolving%20into%20rich%20charcoal%20shadow%2C%20film%20grain%20texture%20with%20luminous%20skin%20tones%20and%20gentle%20highlight%20falloff%2C%20editorial%20documentary%20photography%20style%20with%20understated%20intimacy%20and%20calm%20protective%20mood%2C%20modern%20warm%20minimal%20aesthetic&width=1800&height=800&seq=privacy-hero-2026-wk-v2&orientation=landscape"
          alt=""
          className="absolute inset-0 w-full h-full object-cover will-change-transform"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/90" />

        <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 lg:px-8 pb-14 pt-28 text-white">
          <div className="max-w-[640px]">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-8 h-px bg-white/40" />
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-white/60">Legal</span>
            </div>
            <h1 className="text-[clamp(44px,6vw,72px)] font-black tracking-[-0.05em] leading-[0.90] mb-4">
              Privacy Policy
            </h1>
            <p className="text-[14px] text-white/45">Last updated: {lastModified}</p>
          </div>
        </div>
      </div>

      <div className="max-w-[760px] mx-auto px-6 lg:px-8 py-16 lg:py-24">
        <div className="hp-reveal space-y-16">
          {/* Section 1 */}
          <section>
            <h2 className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-4">Our approach to privacy</h2>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)] mb-4">
              WAKILISHA is built on the principle that discovery infrastructure should respect the people who use it. We collect as little data as possible, we're transparent about what we do collect, and we never sell personal information.
            </p>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
              This policy explains what information we gather, how we use it, and the choices you have. If you have questions after reading this, contact us at hello@wakilisha.com.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-4">What we collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-[14px] font-bold text-[var(--wk-text)] mb-1.5">Anonymous usage data</h3>
                <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
                  We use standard analytics to understand how people use WAKILISHA — which pages are visited, how long people spend reading articles, which charts are most popular. This data is aggregated and does not identify individual users.
                </p>
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-[var(--wk-text)] mb-1.5">Newsletter subscriptions</h3>
                <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
                  When you subscribe to our newsletter, we store your email address. We use it only to send you WAKILISHA updates. You can unsubscribe at any time using the link in every email.
                </p>
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-[var(--wk-text)] mb-1.5">Contact form submissions</h3>
                <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
                  When you send us a message via the contact form, we receive your name, email, and message content. We use this only to respond to your inquiry and do not add you to any mailing list without your explicit consent.
                </p>
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-[var(--wk-text)] mb-1.5">Account data (if you create one)</h3>
                <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
                  If you create a WAKILISHA account, we store your email address and any profile information you choose to provide. We use this to manage your account and provide features like saved favorites and lyric contributions.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-4">What we don't do</h2>
            <ul className="space-y-3 list-none">
              {[
                "We never sell your personal information to third parties.",
                "We never use your data for targeted advertising.",
                "We never share your email address without your consent.",
                "We never track you across other websites.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
                  <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--wk-brand)]" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-4">Artist data</h2>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)] mb-4">
              Our artist registry contains only publicly available information — names, aliases, genre associations, discographies, and chart histories sourced from streaming platforms, public databases, and editorial research. We do not collect or store private artist data such as contact details, financial information, or unreleased material.
            </p>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
              Artists can request corrections or removal of their information by contacting us at hello@wakilisha.com.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-4">Cookies</h2>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
              We use minimal cookies for essential functionality — session management for logged-in users and analytics. We do not use third-party advertising or tracking cookies. You can disable cookies in your browser settings, though some features (like account login) may not work.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-4">Data storage &amp; security</h2>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
              Your data is stored on secure servers and we use industry-standard encryption for data in transit. We retain personal data only as long as necessary to provide our services or as required by law. You can request deletion of your personal data at any time by contacting us.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-4">Changes to this policy</h2>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
              We'll update this page if our practices change. The last-modified date at the top of the page shows when the latest version was published. If we make significant changes, we'll note them in our newsletter.
            </p>
          </section>

          {/* Contact */}
          <section className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 lg:p-8">
            <h2 className="text-[16px] font-black tracking-[-0.02em] text-[var(--wk-text)] mb-2">Questions about your privacy?</h2>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)] mb-4">
              Contact us at <a href="mailto:hello@wakilisha.com" className="underline underline-offset-2 text-[var(--wk-text-soft)] hover:text-[var(--wk-text)] transition-colors">hello@wakilisha.com</a> — we take privacy seriously and respond to every inquiry.
            </p>
          </section>
        </div>
      </div>

      <style>{`
        .hp-reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.7s var(--wk-ease-standard), transform 0.7s var(--wk-ease-standard); }
        .hp-reveal-visible { opacity: 1; transform: translateY(0); }
      `}</style>
    </main>
  );
}