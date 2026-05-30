import { useState } from "react";

interface WkNewsletterCTAProps {
  variant?: "inline" | "panel";
}

export function WkNewsletterCTA({ variant = "panel" }: WkNewsletterCTAProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-center">
        <div className="absolute inset-0 bg-[var(--wk-brand)] opacity-[0.06]" />
        <div className="relative">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
            <i className="ri-check-line text-xl" />
          </div>
          <h3 className="text-[16px] font-bold text-[var(--wk-text)]">
            Subscribed
          </h3>
          <p className="mt-1 text-[13px] text-[var(--wk-text-muted)]">
            You will receive the WAKILISHA editorial digest.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
      {/* Brand top bar */}
      <div className="relative overflow-hidden px-6 py-8 text-center">
        <div className="absolute inset-0 bg-[var(--wk-brand)] opacity-[0.06]" />
        <div className="relative">
          <div className="mb-3 flex items-center justify-center gap-2">
            <i className="ri-newspaper-line text-[var(--wk-brand)]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">
              WAKILISHA Editorial
            </span>
          </div>
          <h3 className="text-[18px] font-bold leading-tight text-[var(--wk-text)]">
            Get the editorial digest
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--wk-text-muted)]">
            Weekly analysis, chart commentary, and industry signals delivered to your inbox.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="border-t border-[var(--wk-divider)] px-6 py-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)]" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] py-3 pl-10 pr-4 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)]"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-[var(--wk-brand)] py-3 text-[14px] font-bold text-[var(--wk-brand-on)] transition-all hover:brightness-110 whitespace-nowrap"
          >
            Subscribe
          </button>
        </form>
        <p className="mt-3 text-center text-[11px] text-[var(--wk-text-faint)]">
          No spam. Unsubscribe anytime.
        </p>
      </div>
    </div>
  );
}