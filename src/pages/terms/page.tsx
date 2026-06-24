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

export default function TermsPage() {
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
          src="https://wakilisha.africa/api/search-image?query=Cinematic%20composition%20of%20human%20figures%20walking%20with%20purpose%20through%20warm%20amber%20and%20olive%20ambient%20light%2C%20grounded%20confident%20stride%20through%20architectural%20space%20with%20soft%20golden%20hour%20light%20creating%20elongated%20shadows%20and%20dramatic%20rim%20lighting%2C%20medium%20wide%20shot%20conveying%20foundation%20stability%20and%20forward%20movement%2C%20film%20grain%20texture%20with%20rich%20warm%20earth%20tones%20and%20deep%20charcoal%20shadows%2C%20editorial%20documentary%20photography%20style%20with%20grounded%20cinematic%20mood%2C%20modern%20contemporary%20African%20urban%20setting%20with%20clean%20architectural%20lines&width=1800&height=800&seq=terms-hero-2026-wk-v2&orientation=landscape"
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
              Terms of Service
            </h1>
            <p className="text-[14px] text-white/45">Last updated: {lastModified}</p>
          </div>
        </div>
      </div>

      <div className="max-w-[760px] mx-auto px-6 lg:px-8 py-16 lg:py-24">
        <div className="hp-reveal space-y-16">
          {/* Section 1 */}
          <section>
            <h2 className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-4">Acceptance of terms</h2>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
              By accessing or using WAKILISHA ("the platform"), you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, please do not use the platform. We may update these terms from time to time — continued use after changes constitutes acceptance.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-4">Using the platform</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-[14px] font-bold text-[var(--wk-text)] mb-1.5">What you can do</h3>
                <ul className="space-y-2 list-none">
                  {[
                    "Browse charts, artists, magazine articles, and guides freely.",
                    "Share links to WAKILISHA content on social media and other platforms.",
                    "Create an account to access additional features.",
                    "Submit corrections and contributions through our official channels.",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
                      <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--wk-brand)]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-[var(--wk-text)] mb-1.5">What you may not do</h3>
                <ul className="space-y-2 list-none">
                  {[
                    "Scrape, bulk-download, or systematically extract data from the platform without written permission.",
                    "Use the platform to distribute spam, malware, or harmful content.",
                    "Impersonate WAKILISHA or misrepresent your affiliation with the platform.",
                    "Attempt to access, modify, or disrupt the platform's systems or security.",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
                      <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--wk-text-faint)]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-4">Intellectual property</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-[14px] font-bold text-[var(--wk-text)] mb-1.5">Our content</h3>
                <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
                  All original content on WAKILISHA — including articles, guides, chart methodology, editorial writing, design, and code — is owned by WAKILISHA or its respective authors and is protected by applicable copyright laws. You may share and link to our content freely; reproduction, republication, or commercial use requires our written permission.
                </p>
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-[var(--wk-text)] mb-1.5">Artist and third-party content</h3>
                <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
                  Artist names, images, biographies, and discography information in our registry are sourced from publicly available data. Artist images, album artwork, and other media remain the property of their respective rights holders. We display this information for discovery and informational purposes.
                </p>
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-[var(--wk-text)] mb-1.5">Your contributions</h3>
                <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
                  By submitting content to WAKILISHA — such as lyric contributions, corrections, or editorial pitches — you grant us the right to use, display, and distribute that content on the platform. You retain ownership of your original work.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-4">Disclaimer</h2>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
              WAKILISHA is provided "as is" without warranties of any kind. We work hard to ensure accuracy — especially in our charts and artist registry — but we cannot guarantee that all information is complete, current, or error-free. Chart data is compiled from multiple sources and methodologies; use it for discovery, not as a sole basis for business or legal decisions.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-4">Limitation of liability</h2>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
              To the fullest extent permitted by law, WAKILISHA and its team shall not be liable for any indirect, incidental, or consequential damages arising from your use of the platform. This includes but is not limited to data inaccuracies, service interruptions, or third-party content linked from the platform.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-4">Account termination</h2>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
              We reserve the right to suspend or terminate accounts that violate these terms or engage in harmful behaviour on the platform. Users may delete their accounts at any time by contacting us.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-4">Governing law</h2>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
              These terms are governed by the laws of Kenya. Any disputes shall be resolved in the courts of Nairobi, Kenya.
            </p>
          </section>

          {/* Contact */}
          <section className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 lg:p-8">
            <h2 className="text-[16px] font-black tracking-[-0.02em] text-[var(--wk-text)] mb-2">Questions about these terms?</h2>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)] mb-4">
              Contact us at <a href="mailto:hello@wakilisha.com" className="underline underline-offset-2 text-[var(--wk-text-soft)] hover:text-[var(--wk-text)] transition-colors">hello@wakilisha.com</a> or visit our <a href="/contact" className="underline underline-offset-2 text-[var(--wk-text-soft)] hover:text-[var(--wk-text)] transition-colors">Contact page</a>.
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