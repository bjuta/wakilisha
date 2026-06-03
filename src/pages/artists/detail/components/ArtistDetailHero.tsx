export interface ArtistDetailHeroProps {
  name: string;
  imageUrl?: string;
  profileImageUrl?: string;
  genres: string[];
  country: string;
  debutYear: number;
  followerCount: number;
  trackCount: number;
  releaseCount: number;
  isChartArtist?: boolean;
  topChartPosition?: number;
  bio: string;
  isRising?: boolean;
  spotifyUrl?: string;
  artistType?: string | null;
}

export function ArtistDetailHero({
  name,
  imageUrl,
  profileImageUrl,
  genres,
  country,
  debutYear,
  followerCount,
  trackCount,
  releaseCount,
  isChartArtist,
  topChartPosition,
  bio,
  isRising,
  spotifyUrl,
  artistType,
}: ArtistDetailHeroProps) {
  const avatarSrc = profileImageUrl || imageUrl;

  return (
    <section className="relative min-h-[520px] md:min-h-[600px] flex items-end overflow-hidden">
      {/* Background image with Ken Burns */}
      {imageUrl && (
        <div
          className="absolute inset-0 bg-[var(--wk-surface-raised)] hero-ken-burns"
          style={{
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center 20%",
            backgroundRepeat: "no-repeat",
          }}
        />
      )}
      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/25" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-black/50" />

      {/* Content */}
      <div className="relative w-full">
        <div className="wk-container px-6 pb-12 pt-20 md:pb-16 md:pt-24">
          {/* Breadcrumb */}
          <div className="hero-text-reveal mb-6 flex items-center gap-3">
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
          </div>

          {/* Main row: profile + text */}
          <div className="flex flex-col md:flex-row gap-5 md:gap-8 items-end">
            {/* Profile Picture — 4:5 portrait card */}
            {avatarSrc && (
              <div className="shrink-0">
                <div className="relative overflow-hidden rounded-2xl border border-accent-500/30 shadow-2xl">
                  <img
                    src={avatarSrc}
                    alt={name}
                    className="h-44 w-36 md:h-56 md:w-44 object-cover object-top"
                  />
                </div>
              </div>
            )}

            {/* Text content */}
            <div className="flex-1 min-w-0">
              {/* Name */}
              <h1
                className="hero-text-reveal hero-text-reveal-d1 mb-5 font-black leading-[0.88] tracking-[-0.04em] text-[#F0EFE8]"
                style={{ fontSize: "clamp(44px, 8vw, 96px)" }}
              >
                {name}
              </h1>

              {/* Badges row */}
              <div className="hero-text-reveal hero-text-reveal-d2 mb-5 flex flex-wrap items-center gap-3">
                {artistType && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/90 backdrop-blur-sm uppercase tracking-wider">
                    <i className="ri-mic-line text-[10px]" />
                    {artistType}
                  </span>
                )}
                {isChartArtist && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wk-brand)] px-3 py-1.5 text-[11px] font-bold text-[var(--wk-brand-on)] uppercase tracking-wider">
                    <i className="ri-bar-chart-line text-[10px]" />
                    Chart #{topChartPosition}
                  </span>
                )}
                {isRising && !isChartArtist && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wk-brand-2)] px-3 py-1.5 text-[11px] font-bold text-[var(--wk-brand-on)] uppercase tracking-wider">
                    <i className="ri-fire-line text-[10px]" />
                    Rising
                  </span>
                )}
              </div>

              {/* Meta row */}
              <div className="hero-text-reveal hero-text-reveal-d3 mb-6 flex flex-wrap items-center gap-3 text-[14px] text-white/70">
                {genres.map((g) => (
                  <span
                    key={g}
                    className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-semibold backdrop-blur-sm"
                  >
                    {g}
                  </span>
                ))}
                {genres.length > 0 && <span className="text-white/40">·</span>}
                <span className="flex items-center gap-1.5">
                  <i className="ri-map-pin-line text-[12px]" />
                  {country || "Unknown"}
                </span>
                <span className="text-white/40">·</span>
                <span className="flex items-center gap-1.5">
                  <i className="ri-calendar-line text-[12px]" />
                  Since {debutYear}
                </span>
                <span className="text-white/40">·</span>
                <span className="flex items-center gap-1.5">
                  <i className="ri-user-follow-line text-[12px]" />
                  {followerCount > 0 ? `${(followerCount / 1000).toFixed(1)}K` : "—"} followers
                </span>
                <span className="text-white/40">·</span>
                <span className="flex items-center gap-1.5">
                  <i className="ri-music-2-line text-[12px]" />
                  {trackCount} tracks
                </span>
                <span className="text-white/40">·</span>
                <span className="flex items-center gap-1.5">
                  <i className="ri-album-line text-[12px]" />
                  {releaseCount} releases
                </span>
              </div>

              {/* Bio tagline */}
              <p className="hero-text-reveal hero-text-reveal-d4 mb-8 max-w-2xl text-[15px] leading-[1.6] text-white/60 md:text-[17px]">
                {bio}
              </p>

              {/* Actions */}
              <div className="hero-text-reveal hero-text-reveal-d5 flex items-center gap-3">
                {spotifyUrl && (
                  <a
                    href={spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-full bg-[#1DB954] px-7 py-3.5 text-[13px] font-bold text-white transition-all hover:bg-[#1ed760] hover:scale-[1.02]"
                  >
                    <i className="ri-spotify-fill text-lg" />
                    Listen on Spotify
                  </a>
                )}
                <button className="flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3.5 text-[13px] font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:scale-[1.02]">
                  <i className="ri-user-add-line text-[15px]" />
                  Follow
                </button>
                <button className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:scale-[1.02]">
                  <i className="ri-share-line text-[16px]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}