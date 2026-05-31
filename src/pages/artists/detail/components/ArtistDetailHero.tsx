import { Link } from "react-router-dom";

export interface ArtistDetailHeroProps {
  name: string;
  imageUrl?: string;
  genres: string[];
  country: string;
  debutYear: number;
  monthlyStreams: number;
  trackCount: number;
  releaseCount: number;
  isChartArtist?: boolean;
  topChartPosition?: number;
  bio: string;
  isRising?: boolean;
}

export function ArtistDetailHero({
  name,
  imageUrl,
  genres,
  country,
  debutYear,
  monthlyStreams,
  trackCount,
  releaseCount,
  isChartArtist,
  topChartPosition,
  bio,
  isRising,
}: ArtistDetailHeroProps) {
  return (
    <section className="relative min-h-[420px] md:min-h-[480px] flex items-end overflow-hidden">
      {/* Background image via CSS — better scaling for mixed-aspect images */}
      {imageUrl && (
        <div
          className="absolute inset-0 bg-[var(--wk-surface-raised)]"
          style={{
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center 20%",
            backgroundRepeat: "no-repeat",
          }}
        />
      )}
      {/* Multi-layer scrim for legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/30" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/40" />

      {/* Content */}
      <div className="relative w-full">
        <div className="wk-container px-6 pb-10 pt-16 md:pb-14 md:pt-20">
          {/* Breadcrumb row */}
          <div className="mb-5 flex items-center gap-3">
            <Link
              to="/artists"
              className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] transition-opacity hover:opacity-70"
            >
              Artists
            </Link>
            <i className="ri-arrow-right-line text-[10px] text-white/40" />
            <span className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/50">
              Registry
            </span>
            {isChartArtist && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-brand)] px-2.5 py-1 text-[10px] font-bold text-[var(--wk-brand-on)] uppercase tracking-wider">
                <i className="ri-bar-chart-line text-[10px]" />
                Chart # {topChartPosition}
              </span>
            )}
            {isRising && !isChartArtist && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-brand-2)] px-2.5 py-1 text-[10px] font-bold text-[var(--wk-brand-2-on)] uppercase tracking-wider">
                <i className="ri-fire-line text-[10px]" />
                Rising
              </span>
            )}
          </div>

          {/* Name */}
          <h1
            className="mb-4 font-black leading-[0.88] tracking-[-0.04em] text-[#F0EFE8]"
            style={{ fontSize: "clamp(40px, 7vw, 88px)" }}
          >
            {name}
          </h1>

          {/* Metadata row */}
          <div className="mb-6 flex flex-wrap items-center gap-3 text-[14px] text-white/70">
            {genres.map((g) => (
              <span
                key={g}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-semibold backdrop-blur-sm"
              >
                {g}
              </span>
            ))}
            <span className="text-white/40">·</span>
            <span className="flex items-center gap-1.5">
              <i className="ri-map-pin-line text-[12px]" />
              {country}
            </span>
            <span className="text-white/40">·</span>
            <span className="flex items-center gap-1.5">
              <i className="ri-calendar-line text-[12px]" />
              Since {debutYear}
            </span>
            <span className="text-white/40">·</span>
            <span className="flex items-center gap-1.5">
              <i className="ri-headphone-line text-[12px]" />
              {monthlyStreams}M streams
            </span>
          </div>

          {/* Bio excerpt */}
          <p className="mb-6 max-w-2xl text-[15px] leading-[1.6] text-white/60 md:text-[16px]">
            {bio}
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-6 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] transition-all hover:bg-[var(--wk-brand-2)]">
              <i className="ri-play-fill text-lg" />
              Play
            </button>
            <button className="flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-3 text-[13px] font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20">
              <i className="ri-user-add-line text-[15px]" />
              Follow
            </button>
            <button className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20">
              <i className="ri-share-line text-[15px]" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}