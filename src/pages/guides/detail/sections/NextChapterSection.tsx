import { useState } from "react";
import type { NextChapterData } from "../sectionTypes";

export default function NextChapterSection({ data }: { data: NextChapterData }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setEmail("");
      }, 3000);
    }
  };

  return (
    <section className="relative py-12 md:py-16" style={{ background: "var(--wk-bg)" }}>
      <div className="max-w-[720px] mx-auto px-6 md:px-8 text-center">
        <div className="mb-6 text-[20px] tracking-widest" style={{ color: "var(--wk-text-muted)" }} aria-hidden="true">· · ·</div>

        <span className="text-[11px] font-semibold tracking-[0.2em] uppercase" style={{ color: "var(--wk-text-muted)" }}>Coming next</span>

        <h2 className="mt-3 text-[24px] md:text-[32px] font-black leading-tight" style={{ color: "var(--wk-text)", fontFamily: "var(--wk-font-heading)" }}>{data.title}</h2>

        <p className="mt-3 text-[14px] md:text-[15px] leading-relaxed max-w-[480px] mx-auto" style={{ color: "var(--wk-text-soft)" }}>{data.subtitle}</p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col sm:flex-row items-center gap-3 max-w-[480px] mx-auto">
          <label htmlFor="next-chapter-email" className="sr-only">Email address</label>
          <input id="next-chapter-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" autoComplete="email" required
            className="flex-1 w-full px-4 py-3 rounded-md text-[14px] border outline-none focus:ring-2 focus:ring-offset-1"
            style={{ background: "var(--wk-surface)", borderColor: "var(--wk-divider)", color: "var(--wk-text)", fontFamily: "var(--wk-font-body)" }}
          />
          <button type="submit" className="w-full sm:w-auto px-5 py-3 rounded-md text-[14px] font-semibold text-white transition-opacity hover:opacity-90 whitespace-nowrap" style={{ background: "#C4A35A" }}>
            {submitted ? (
              <span className="flex items-center gap-2"><i className="ri-check-line" /> Added</span>
            ) : "Notify me"}
          </button>
        </form>
      </div>
    </section>
  );
}