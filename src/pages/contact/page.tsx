import { useEffect, useRef, useState } from "react";
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

export default function ContactPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;

    const textarea = form.querySelector("textarea") as HTMLTextAreaElement;
    if (textarea && textarea.value.length > 500) {
      setSubmitError("Message must be 500 characters or fewer.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const formData = new FormData(form);
    const submission: Record<string, string> = { form_type: "contact" };
    formData.forEach((value, key) => {
      submission[key] = String(value);
    });

    const result = await submitForm(submission);

    if (result.success) {
      setSubmitted(true);
      trackEvent("contact_form_submit", {
        pageType: "contact",
        context: { formId: "contact-main" },
      });
    } else {
      setSubmitError(result.error ?? "Something went wrong. Please try again or email us directly.");
    }

    setSubmitting(false);
  };

  const CONTACT_INFO = [
    { icon: "ri-mail-line", label: "Email", value: "hello@wakilisha.com", href: "mailto:hello@wakilisha.com" },
    { icon: "ri-twitter-x-line", label: "X / Twitter", value: "@wakilisha", href: "https://x.com/wakilisha" },
    { icon: "ri-instagram-line", label: "Instagram", value: "@wakilisha.africa", href: "https://instagram.com/wakilisha.africa" },
    { icon: "ri-map-pin-line", label: "Location", value: "Nairobi, Kenya", href: null },
  ];

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      {/* Hero */}
      <div ref={heroRef} className="relative min-h-[55vh] flex items-end overflow-hidden bg-[#0a0a0a] -mt-16">
        <img
          ref={heroImgRef}
          src="https://wakilisha.africa/api/search-image?query=Cinematic%20medium%20shot%20of%20human%20connection%20and%20conversation%20in%20warm%20amber%20and%20olive%20ambient%20lighting%2C%20two%20figures%20engaged%20in%20warm%20exchange%20with%20genuine%20expressions%20and%20natural%20body%20language%2C%20soft%20golden%20hour%20light%20wrapping%20around%20profiles%20with%20gentle%20lens%20flare%2C%20shallow%20depth%20of%20field%20with%20bokeh%20background%20of%20warm%20blurred%20tones%2C%20film%20grain%20texture%20with%20rich%20warm%20shadows%20and%20luminous%20highlights%2C%20intimate%20editorial%20documentary%20photography%20style%20with%20authentic%20candid%20mood%2C%20modern%20contemporary%20African%20creative%20setting&width=1800&height=900&seq=contact-hero-2026-wk-v2&orientation=landscape"
          alt=""
          className="absolute inset-0 w-full h-full object-cover will-change-transform"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/30" />

        <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 lg:px-8 pb-16 pt-28 text-white">
          <div className="max-w-[640px]">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-8 h-px bg-white/40" />
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-white/60">Get in touch</span>
            </div>
            <h1 className="text-[clamp(44px,6vw,80px)] font-black tracking-[-0.05em] leading-[0.90] mb-5">
              We'd love to hear from you
            </h1>
            <p className="text-[clamp(15px,1.8vw,18px)] leading-relaxed text-white/55 max-w-[480px]">
              Whether you're an artist wanting to be in the registry, a writer pitching a story, or just someone who cares about African creative life — say hello.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 flex flex-col gap-20 py-20">
        {/* Form + Info */}
        <div className="hp-reveal grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Form */}
          <div className="lg:col-span-3">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-6 h-px bg-[var(--wk-brand)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)]">Send a message</span>
            </div>

            {submitted ? (
              <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-10 text-center">
                <div className="w-16 h-16 rounded-full bg-[var(--wk-brand)] flex items-center justify-center mx-auto mb-6">
                  <i className="ri-check-line text-[32px] text-[var(--wk-brand-on)]" />
                </div>
                <h3 className="text-[24px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">Message sent</h3>
                <p className="text-[14px] text-[var(--wk-text-muted)] max-w-[380px] mx-auto leading-relaxed">
                  Thanks for reaching out. We read every message and we'll get back to you as soon as we can.
                </p>
              </div>
            ) : (
              <form
                id="contact-form-main"
                onSubmit={handleSubmit}
                className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 lg:p-8 space-y-5"
              >
                <input type="hidden" name="wk_session_id" value={getAnalyticsSessionId()} />
                <input type="hidden" name="wk_page_url" value={getCanonicalPageUrl()} />
                <input type="hidden" name="wk_page_type" value="contact" />
                <input type="hidden" name="wk_source_section" value="contact_main" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="contact-name" className="block text-[12px] font-bold text-[var(--wk-text-soft)] mb-2">Name</label>
                    <input
                      id="contact-name"
                      name="name"
                      type="text"
                      required
                      placeholder="Your full name"
                      className="w-full h-12 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="block text-[12px] font-bold text-[var(--wk-text-soft)] mb-2">Email</label>
                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      required
                      placeholder="you@example.com"
                      className="w-full h-12 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-subject" className="block text-[12px] font-bold text-[var(--wk-text-soft)] mb-2">Subject</label>
                  <select
                    id="contact-subject"
                    name="subject"
                    required
                    className="w-full h-12 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 text-[14px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)] transition-colors appearance-none cursor-pointer"
                    style={{ backgroundImage: "none" }}
                  >
                    <option value="" disabled selected>Select a topic</option>
                    <option value="Artist registry inquiry">Artist registry inquiry</option>
                    <option value="Editorial pitch">Editorial pitch</option>
                    <option value="Guide suggestion">Guide suggestion</option>
                    <option value="Chart methodology question">Chart methodology question</option>
                    <option value="Partnership">Partnership</option>
                    <option value="Press / media">Press / media</option>
                    <option value="Technical issue">Technical issue</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-[12px] font-bold text-[var(--wk-text-soft)] mb-2">
                    Message <span className="text-[var(--wk-text-faint)] font-normal">(max 500 characters)</span>
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    required
                    maxLength={500}
                    rows={5}
                    placeholder="Tell us what's on your mind..."
                    className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors resize-none"
                  />
                </div>

                {submitError && (
                  <div className="flex items-center gap-2 text-[13px] text-[var(--wk-danger)] bg-[var(--wk-danger-soft)] rounded-xl px-4 py-3">
                    <i className="ri-error-warning-line shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="h-12 px-8 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[14px] font-extrabold hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                >
                  {submitting ? "Sending..." : "Send message"}
                </button>
              </form>
            )}
          </div>

          {/* Info sidebar */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-6 h-px bg-[var(--wk-brand)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)]">Reach us</span>
            </div>
            <div className="space-y-3">
              {CONTACT_INFO.map((item) => {
                const content = (
                  <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--wk-bg-subtle)]">
                      <i className={`${item.icon} text-[18px] text-[var(--wk-text-soft)]`} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--wk-text-faint)] mb-1">{item.label}</p>
                      <p className="text-[14px] font-semibold text-[var(--wk-text)]">{item.value}</p>
                    </div>
                  </div>
                );
                if (item.href) {
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      target={item.href.startsWith("http") ? "_blank" : undefined}
                      rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="block hover:border-[var(--wk-border-2)] transition-colors"
                    >
                      {content}
                    </a>
                  );
                }
                return <div key={item.label}>{content}</div>;
              })}
            </div>

            {/* Office hours */}
            <div className="mt-8 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-5">
              <div className="flex items-center gap-2 mb-3">
                <i className="ri-time-line text-[15px] text-[var(--wk-text-faint)]" />
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--wk-text-faint)]">Response time</span>
              </div>
              <p className="text-[13px] leading-relaxed text-[var(--wk-text-muted)]">
                We typically respond within 2-3 business days. For urgent chart or registry issues, please include "Urgent" in your subject line.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="hp-reveal border-t border-[var(--wk-border)] pt-14 pb-8 text-center">
          <span className="text-[9px] font-black uppercase tracking-[0.24em] text-[var(--wk-brand)] mb-3 block">WAKILISHA</span>
          <p className="text-[24px] lg:text-[28px] font-black tracking-[-0.035em] text-[var(--wk-text)] leading-snug max-w-[480px] mx-auto">
            Let's build together.
          </p>
          <div className="mt-4 flex items-center justify-center gap-1 text-[12px] text-[var(--wk-text-faint)]">
            <span>Nairobi, Kenya</span>
            <span className="text-[var(--wk-border-strong)]">·</span>
            <a href="mailto:hello@wakilisha.com" className="underline underline-offset-2 hover:text-[var(--wk-text-muted)] transition-colors">hello@wakilisha.com</a>
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