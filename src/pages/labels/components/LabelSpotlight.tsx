import { useState } from "react";
import { Link } from "react-router-dom";

export interface LabelSpotlightProps {
  slug: string;
  name: string;
  country?: string;
  artistCount: number;
  releaseCount: number;
  isFeatured?: boolean;
  imageUrl?: string;
  description?: string;
  topArtists?: string[];
  topReleases?: string[];
  year?: string;
}

export function LabelSpotlight({
  slug,
  name,
  country,
  artistCount,
  releaseCount,
  imageUrl,
  description,
  topArtists,
  topReleases,
  year,
}: LabelSpotlightProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <section className="relative overflow-hidden">
      <div className="relative min-h-[480px] md:min-h-[560px]">
        {/* Background image */}
        {imageUrl && (
          <>
            <img
              src={imageUrl}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-700 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setImageLoaded(true)}
            />
            {!imageLoaded && (
              <div className="absolute inset-0 bg-[var(--wk-surface-raised)]" />
            )}
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

        <div className="relative z-10 flex h-full min-h-[480px] md:min-h-[560px] items-end">
          <div className="wk-container w-full px-6 py-12 md:py-16">
            <div className="max-w-2xl">
              <div className="mb-5 flex items-center gap-3">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.22em]" style={{ color: "var(--wk-brand-2)" }}>
                  Label Spotlight
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-brand)] px-2.5 py-1 text-[10px] font-bold text-[var(--wk-brand-on)] uppercase tracking-wider">
                  <i className="ri-building-2-line text-[10px]" />
                  Featured
                </span>
              </div>

              <h2 className="mb-4 text-[clamp(36px,5vw,64px)] font-black leading-[0.88] tracking-[-0.04em]" style={{ color: "#F0EFE8" }}>
                {name}
              </h2>

              {description && (
                <p className="mb-6 text-[16px] leading-[1.65] md:text-[17px]" style={{ color: "rgba(240,239,232,.82)" }}>
                  {description}
                </p>
              )}

              <div className="mb-7 flex flex-wrap items-center gap-4 text-[13px]" style={{ color: "rgba(240,239,232,.65)" }}>
                {country && (
                  <span className="flex items-center gap-1.5">
                    <i className="ri-map-pin-line" />
                    {country}
                  </span>
                )}
                <span className="text-[var(--wk-text-faint)]">·</span>
                <span className="flex items-center gap-1.5">
                  <i className="ri-user-line" />
                  {artistCount} artists
                </span>
                <span className="text-[var(--wk-text-faint)]">·</span>
                <span className="flex items-center gap-1.5">
                  <i className="ri-album-line" />
                  {releaseCount} releases
                </span>
                {year && (
                  <>
                    <span className="text-[var(--wk-text-faint)]">·</span>
                    <span className="flex items-center gap-1.5">
                      <i className="ri-calendar-line" />
                      Since {year}
                    </span>
                  </>
                )}
              </div>

              {topArtists && topArtists.length > 0 && (
                <div className="mb-6 flex flex-wrap gap-2">
                  {topArtists.map((a) => (
                    <span key={a} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-semibold text-white/70 backdrop-blur-sm">
                      {a}
                    </span>
                  ))}
                </div>
              )}

              {topReleases && topReleases.length > 0 && (
                <div className="mb-6 text-[13px] text-white/50">
                  <span className="font-semibold text-white/70">Latest releases:</span>{" "}
                  {topReleases.join(", ")}
                </div>
              )}

              <Link
                to={`/labels/${slug}`}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-6 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] transition-all hover:bg-[var(--wk-brand-2)]"
              >
                Explore label
                <i className="ri-arrow-right-line" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}