import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { WkButton } from "@/components/design-system/primitives/Button";

const SUGGESTED_LINKS = [
  { label: "Charts", to: "/charts", icon: "ri-bar-chart-line" },
  { label: "Artists", to: "/artists", icon: "ri-mic-line" },
  { label: "Magazine", to: "/magazine", icon: "ri-newspaper-line" },
  { label: "Guides", to: "/guides", icon: "ri-compass-3-line" },
  { label: "Genres", to: "/genres", icon: "ri-price-tag-3-line" },
  { label: "Labels", to: "/labels", icon: "ri-disc-line" },
];

export default function NotFound() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--wk-bg)] px-6 py-20">
      {/* Subtle decorative background */}
      <div className="pointer-events-none absolute inset-0 select-none">
        <div
          className="absolute -top-32 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full opacity-[0.04]"
          style={{ background: `radial-gradient(circle, var(--wk-brand) 0%, transparent 70%)` }}
        />
        <div
          className="absolute -bottom-24 -right-24 h-[400px] w-[400px] rounded-full opacity-[0.03]"
          style={{ background: `radial-gradient(circle, var(--wk-brand) 0%, transparent 70%)` }}
        />
      </div>

      {/* Content */}
      <div
        className={`relative z-10 flex flex-col items-center text-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
        }`}
      >
        {/* Mega 404 */}
        <div className="relative mb-2 select-none">
          <span
            className="block text-[clamp(120px,18vw,220px)] font-black leading-none tracking-[-0.07em]"
            style={{
              fontFamily: "var(--wk-font-display)",
              color: "var(--wk-text)",
              opacity: 0.06,
            }}
          >
            404
          </span>
          <span
            className="absolute inset-0 flex items-center justify-center text-[clamp(120px,18vw,220px)] font-black leading-none tracking-[-0.07em]"
            style={{
              fontFamily: "var(--wk-font-display)",
              background: `linear-gradient(180deg, var(--wk-text) 0%, var(--wk-text-soft) 40%, var(--wk-brand) 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            404
          </span>
        </div>

        {/* Message */}
        <h1
          className="wk-h-section mb-2 -mt-6 md:-mt-10"
          style={{ color: "var(--wk-text)" }}
        >
          Page not found
        </h1>
        <p
          className="wk-copy mb-10 max-w-md text-center"
          style={{ color: "var(--wk-text-muted)" }}
        >
          The page you're looking for doesn't exist or has been moved.
          Let's get you back on track.
        </p>

        {/* Primary action */}
        <Link to="/">
          <WkButton variant="primary" className="text-[14px] px-8 py-3">
            <i className="ri-home-5-line text-base" />
            Back to home
          </WkButton>
        </Link>

        {/* Divider */}
        <div className="my-10 flex w-full max-w-xs items-center gap-4">
          <div className="h-px flex-1 bg-[var(--wk-divider)]" />
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.15em]"
            style={{ color: "var(--wk-text-faint)" }}
          >
            or explore
          </span>
          <div className="h-px flex-1 bg-[var(--wk-divider)]" />
        </div>

        {/* Suggested links */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3">
          {SUGGESTED_LINKS.map((link, i) => (
            <Link
              key={link.to}
              to={link.to}
              className="group flex items-center gap-2.5 rounded-lg border px-4 py-3 text-[13px] font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                borderColor: "var(--wk-border-2)",
                color: "var(--wk-text-soft)",
                backgroundColor: "var(--wk-surface)",
                transitionDelay: `${i * 50}ms`,
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(8px)",
              }}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: "var(--wk-brand-soft)" }}>
                <i className={`${link.icon} text-sm`} style={{ color: "var(--wk-brand)" }} />
              </span>
              <span className="whitespace-nowrap transition-colors duration-200 group-hover:text-[var(--wk-text)]">
                {link.label}
              </span>
            </Link>
          ))}
        </div>

        {/* Footer note */}
        <p
          className="mt-12 text-[11px]"
          style={{ color: "var(--wk-text-faint)" }}
        >
          If you believe this is a mistake,{" "}
          <a href="mailto:hello@wakilisha.africa" className="underline underline-offset-2 hover:text-[var(--wk-text-muted)] transition-colors">
            let us know
          </a>
          .
        </p>
      </div>
    </div>
  );
}