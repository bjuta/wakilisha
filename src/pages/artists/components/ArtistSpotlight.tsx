import { useState } from "react";
import { Link } from "react-router-dom";
import { WkTag } from "@/components/design-system/primitives/Tag";

export interface ArtistSpotlightProps {
  slug: string;
  name: string;
  imageUrl?: string;
  genres: string[];
  trackCount: number;
  releaseCount: number;
  country: string;
  debutYear: number;
  monthlyStreams: number;
  topChartPosition: number;
  spotlightBio: string;
  isChartArtist?: boolean;
}

export function ArtistSpotlight({
  slug,
  name,
  imageUrl,
  genres,
  trackCount,
  releaseCount,
  country,
  debutYear,
  monthlyStreams,
  topChartPosition,
  spotlightBio,
  isChartArtist,
}: ArtistSpotlightProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <section className="relative overflow-hidden">
      <div className="relative min-h-[520px] md:min-h-[600px]">
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
        {/* Multi-layer scrim for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

        {/* Content */}
        <div className="relative z-10 flex h-full min-h-[520px] md:min-h-[600px] items-end">
          <div className="wk-container w-full px-6 py-12 md:py-16">
            <div className="max-w-2xl">
              <div className="mb-5 flex items-center gap-3">
                <div className="wk-eyebrow" style={{ color: "var(--wk-brand-2)" }}>
                  <span className="text-[var(--wk-brand-2)]">Artist Spotlight</span>
                </div>
                {isChartArtist && (
                  <WkTag variant="brand">
                    <i className="ri-bar-chart-line" />
                    No. {topChartPosition}
                  </WkTag>
                )}
              </div>

              <h2 className="mb-4 text-[clamp(36px,5vw,64px)] font-black leading-[0.92] tracking-[-0.045em]" style={{ color: "#F0EFE8" }}>
                {name}
              </h2>

              <p className="mb-6 text-[16px] leading-[1.65] md:text-[17px]" style={{ color: "rgba(240,239,232,.82)" }}>
                {spotlightBio}
              </p>

              <div className="mb-7 flex flex-wrap items-center gap-4 text-[13px]" style={{ color: "rgba(240,239,232,.65)" }}>
                <span className="flex items-center gap-1.5">
                  <i className="ri-map-pin-line" />
                  {country}
                </span>
                <span className="text-[var(--wk-text-faint)]">·</span>
                <span className="flex items-center gap-1.5">
                  <i className="ri-calendar-line" />
                  Since {debutYear}
                </span>
                <span className="text-[var(--wk-text-faint)]">·</span>
                <span className="flex items-center gap-1.5">
                  <i className="ri-headphone-line" />
                  {monthlyStreams}M monthly streams
                </span>
                <span className="text-[var(--wk-text-faint)]">·</span>
                <span className="flex items-center gap-1.5">
                  <i className="ri-music-2-line" />
                  {trackCount} tracks
                </span>
                <span className="text-[var(--wk-text-faint)]">·</span>
                <span className="flex items-center gap-1.5">
                  <i className="ri-album-line" />
                  {releaseCount} releases
                </span>
              </div>

              <div className="mb-6 flex flex-wrap gap-2">
                {genres.map((g) => (
                  <WkTag key={g}>
                    <span style={{ color: "rgba(240,239,232,.7)" }}>{g}</span>
                  </WkTag>
                ))}
              </div>

              <Link
                to={`/artists/${slug}`}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-6 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] transition-all hover:bg-[var(--wk-brand-2)]"
              >
                Explore artist
                <i className="ri-arrow-right-line" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}