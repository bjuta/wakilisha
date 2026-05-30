import type { ReactNode } from "react";
import { WkButton } from "./Button";

export interface PageHeroProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
  imageUrl?: string;
  variant?: "standard" | "compact" | "full";
  className?: string;
}

export function PageHero({
  eyebrow,
  title,
  subtitle,
  actions,
  imageUrl,
  variant = "standard",
  className = "",
}: PageHeroProps) {
  const heights = {
    standard: "min-h-[320px] md:min-h-[400px]",
    compact: "min-h-[180px] md:min-h-[240px]",
    full: "min-h-[480px] md:min-h-[640px]",
  };

  return (
    <section
      className={`relative flex items-end overflow-hidden ${heights[variant]} ${className}`}
      style={imageUrl ? { backgroundImage: `url(${imageUrl})`, backgroundSize: "cover", backgroundPosition: "top" } : {}}
    >
      {imageUrl && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />
      )}
      {!imageUrl && (
        <div className="absolute inset-0 bg-[var(--wk-bg-subtle)]" />
      )}
      <div className="relative wk-container px-6 pb-10 pt-16 w-full">
        {eyebrow && <div className="wk-eyebrow mb-4">{eyebrow}</div>}
        <h1 className="wk-h-page mb-3" style={{ color: imageUrl ? "#F0EFE8" : "var(--wk-text)" }}>
          {title}
        </h1>
        {subtitle && (
          <p
            className="wk-copy mb-6 max-w-xl"
            style={{ color: imageUrl ? "rgba(240,239,232,.8)" : "var(--wk-text-soft)" }}
          >
            {subtitle}
          </p>
        )}
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>
    </section>
  );
}