import { useState } from "react";
import { WkButton } from "@/components/design-system/primitives/Button";

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
      <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 text-center">
        <div className="mb-2 flex justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
            <i className="ri-check-line text-lg" />
          </div>
        </div>
        <h3 className="text-[15px] font-bold text-[var(--wk-text)]">
          Subscribed
        </h3>
        <p className="mt-1 text-[13px] text-[var(--wk-text-muted)]">
          You will receive the WAKILISHA editorial digest.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-md">
          <h3 className="text-[16px] font-bold text-[var(--wk-text)]">
            WAKILISHA editorial digest
          </h3>
          <p className="mt-1 text-[13px] text-[var(--wk-text-muted)]">
            Weekly analysis, chart commentary, and industry signals — delivered to your inbox.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex items-center gap-2 sm:shrink-0">
          <div className="relative flex-1 sm:flex-initial">
            <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)]" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] py-2.5 pl-9 pr-4 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] sm:w-64"
            />
          </div>
          <WkButton type="submit" variant="primary">
            Subscribe
          </WkButton>
        </form>
      </div>
    </div>
  );
}