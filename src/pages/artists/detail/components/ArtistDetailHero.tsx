import { useState } from "react";
import { Link } from "react-router-dom";
import { ShareSheet } from "@/components/design-system/share/ShareSheet";
import { useEntityActions } from "@/hooks/useCommunityActions";
import { getCountryFlagUrl, getCountryLabel } from "@/utils/countries";

export interface ArtistDetailHeroProps {
  name: string;
  artistId: string;
  slug: string;
  userId?: string;
  imageUrl?: string;
  profileImageUrl?: string;
  bio: string;
  isRising?: boolean;
  spotifyUrl?: string;
  artistType?: string | null;
  country?: string | null;
  genres?: string[];
  trackCount?: number;
  releaseCount?: number;
  chartEntryCount?: number;
}

export function ArtistDetailHero({
  name,
  artistId,
  slug,
  userId,
  imageUrl,
  profileImageUrl,
  bio,
  isRising,
  spotifyUrl,
  artistType,
  country,
  genres = [],
  trackCount = 0,
  releaseCount = 0,
  chartEntryCount = 0,
}: ArtistDetailHeroProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [following, setFollowing] = useState(false);
  const { follow, loading: actionLoading } = useEntityActions(userId);

  const avatarSrc = profileImageUrl || imageUrl;
  const artistUrl = typeof window !== "undefined" ? window.location.href : `/artists/${slug}`;
  const countryFlagUrl = getCountryFlagUrl(country, 40);
  const countryLabel = getCountryLabel(country);
  const visibleGenres = genres.slice(0, 3);

  const handleFollow = async () => {
    const result = await follow("artist", artistId, slug);
    if (result) setFollowing(result.followed ?? true);
  };

  const handleShare = () => setShareOpen(true);

  return (
    <>
    <section className="relative -mt-16 pt-16 min-h-[420px] md:min-h-[600px] flex items-end overflow-hidden">

      {/* Background image — full bleed, acts as artist photo on mobile */}
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/40" />

      {/* ─── Content ─── */}
      <div className="relative w-full">
        <div className="wk-container px-4 pb-7 md:px-6 md:pb-16 md:pt-24">

          {/* Breadcrumb — desktop only (mobile has floating back button) */}
          <div className="hero-text-reveal mb-4 md:mb-6 hidden md:flex items-center gap-3">
            <Link
              to="/artists"
              className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] transition-opacity hover:opacity-70"
            >
              Artists
            </Link>
            <i className="ri-arrow-right-line text-[10px] text-white/40" />
            <span className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/50">
              Profile
            </span>
          </div>

          {/* Main row: profile card + text block */}
          <div className="flex flex-col md:flex-row gap-5 md:gap-8 md:items-end">

            {/* Profile picture — desktop only */}
            {avatarSrc && (
              <div className="hidden md:block shrink-0">
                <div className="relative overflow-hidden rounded-2xl border border-white/20 shadow-2xl">
                  <img
                    src={avatarSrc}
                    alt={`${name} portrait`}
                    loading="lazy"
                    className="h-56 w-44 object-cover object-top"
                  />
                </div>
              </div>
            )}

            {/* Text content */}
            <div className="flex-1 min-w-0">

              {/* Artist name */}
              <h1
                className="hero-text-reveal hero-text-reveal-d1 mb-4 md:mb-5 font-black leading-[0.88] tracking-[-0.04em] text-[#F0EFE8]"
                style={{ fontSize: "clamp(34px, 7vw, 96px)" }}
              >
                {name}
              </h1>

              {/* ════ MOBILE ONLY: minimal action bar ════
                  Country label + Spotify + Follow + Share — all in one line */}
              <div className="hero-text-reveal hero-text-reveal-d2 flex md:hidden items-center gap-2 flex-wrap">
                {countryFlagUrl && (
                  <span className="flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3.5 py-1.5 text-[12px] font-bold text-white backdrop-blur-sm whitespace-nowrap">
                    <img src={countryFlagUrl} alt={`${countryLabel} flag`} loading="lazy" className="h-3.5 w-5 rounded-[2px] object-cover" />
                    {countryLabel}
                  </span>
                )}
                {spotifyUrl && (
                  <a
                    href={spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full bg-[#1DB954] px-3.5 py-1.5 text-[12px] font-bold text-white whitespace-nowrap transition-all active:scale-95"
                  >
                    <i className="ri-spotify-fill text-[13px]" />
                    Spotify
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleFollow}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3.5 py-1.5 text-[12px] font-bold text-white backdrop-blur-sm whitespace-nowrap transition-all active:scale-95 disabled:opacity-60"
                >
                  <i className={following ? "ri-user-follow-line text-[12px]" : "ri-user-add-line text-[12px]"} />
                  {following ? "Following" : "Follow"}
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur-sm transition-all active:scale-95"
                  aria-label={`Share ${name}`}
                >
                  <i className="ri-share-line text-[13px]" />
                </button>
              </div>

              {/* ════ DESKTOP ONLY: badges + meta + bio + full actions ════ */}

              {/* Badges row */}
              <div className="hero-text-reveal hero-text-reveal-d2 hidden md:flex mb-5 flex-wrap items-center gap-3">
                {countryFlagUrl && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/90 backdrop-blur-sm uppercase tracking-wider">
                    <img src={countryFlagUrl} alt={`${countryLabel} flag`} loading="lazy" className="h-3.5 w-5 rounded-[2px] object-cover" />
                    {countryLabel}
                  </span>
                )}

                {artistType && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/90 backdrop-blur-sm uppercase tracking-wider">
                    <i className="ri-mic-line text-[10px]" />
                    {artistType}
                  </span>
                )}

                {visibleGenres.map((genre) => (
                  <span key={genre} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/90 backdrop-blur-sm uppercase tracking-wider">
                    {genre}
                  </span>
                ))}

                {isRising && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wk-brand-2)] px-3 py-1.5 text-[11px] font-bold text-[var(--wk-brand-on)] uppercase tracking-wider">
                    <i className="ri-fire-line text-[10px]" />
                    Rising
                  </span>
                )}
              </div>

              <div className="hero-text-reveal hero-text-reveal-d3 mb-5 hidden md:flex flex-wrap items-center gap-3 text-[12px] font-bold text-white/70">
                <span>{trackCount.toLocaleString()} tracks</span>
                <span className="text-white/35">·</span>
                <span>{releaseCount.toLocaleString()} releases</span>
                {chartEntryCount > 0 && (
                  <>
                    <span className="text-white/35">·</span>
                    <span>{chartEntryCount.toLocaleString()} chart moments</span>
                  </>
                )}
              </div>



              {/* Bio tagline — tablet 2-line clamp, full on desktop */}
              {bio && (
                <p className="hero-text-reveal hero-text-reveal-d4 mb-8 hidden sm:block w-full md:max-w-2xl text-[13px] leading-[1.65] text-white/60 md:text-[17px]">
                  <span className="sm:block line-clamp-2 md:line-clamp-none">{bio}</span>
                </p>
              )}

              {/* Desktop actions */}
              <div className="hero-text-reveal hero-text-reveal-d5 hidden md:flex items-center gap-3">
                {spotifyUrl && (
                  <a
                    href={spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-full bg-[#1DB954] px-7 py-3.5 text-[13px] font-bold text-white transition-all hover:bg-[#1ed760] hover:scale-[1.02] whitespace-nowrap"
                  >
                    <i className="ri-spotify-fill text-lg" />
                    Listen on Spotify
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleFollow}
                  disabled={actionLoading}
                  className="flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3.5 text-[13px] font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:scale-[1.02] whitespace-nowrap disabled:opacity-60"
                >
                  <i className={following ? "ri-user-follow-line text-[15px]" : "ri-user-add-line text-[15px]"} />
                  {following ? "Following" : "Follow"}
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:scale-[1.02]"
                  aria-label={`Share ${name}`}
                >
                  <i className="ri-share-line text-[16px]" />
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
    <ShareSheet
      item={{
        title: name,
        subtitle: countryLabel || "Artist",
        description: bio || `Explore ${name} on WAKILISHA.`,
        imageUrl: avatarSrc,
        url: artistUrl,
        type: "artist",
      }}
      open={shareOpen}
      onClose={() => setShareOpen(false)}
    />
    </>
  );
}