import { useEffect, useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { usePlayer } from "@/context/PlayerContext";
import { slugify } from "@/services/publicContent/client";
import type { PublicReleaseDetail } from "@/services/publicContent/client";
import { buildReleaseSeoDescription } from "@/services/cultureContext/releaseAdapters";

export default function ReleaseDetailHero({
  release,
  minutes,
}: {
  release: PublicReleaseDetail;
  minutes: number;
}) {
  const [hovered, setHovered] = useState(false);
  const [artworkFailed, setArtworkFailed] = useState(false);
  const { currentTrack, isPlaying, playTrack, togglePlay, toggleShuffle, isShuffle } = usePlayer();

  useEffect(() => {
    setArtworkFailed(false);
  }, [release.artworkUrl]);

  const initial = release.title.trim()[0]?.toUpperCase() || "W";
  const canUseArtwork = Boolean(release.artworkUrl && !artworkFailed);
  const shareDescription = buildReleaseSeoDescription(release);

  const tracks = release.tracks || [];
  const isThisReleasePlaying = currentTrack && tracks.some((t) => t.id === currentTrack.id);

  const artistSlug = slugify(release.artist);

  const buildQueue = () =>
    tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      artworkUrl: t.artworkUrl,
      duration: t.duration,
      previewUrl: t.previewUrl,
      album: release.title,
      artistSlug,
      trackSlug: t.slug,
    }));

  const handlePlay = () => {
    if (!tracks.length) return;

    // If already playing something from this release, toggle play/pause
    if (isThisReleasePlaying) {
      togglePlay();
      return;
    }

    const queue = buildQueue();
    playTrack(queue[0], queue, {
      pageType: "release_detail",
      entitySlug: release.slug,
      entityType: "release",
      sourceSection: "release_hero",
    });
  };

  const handleShuffle = () => {
    if (!tracks.length) return;

    if (!isShuffle) {
      toggleShuffle();
    }

    const queue = buildQueue();
    // Pick a random track to start
    const randomIndex = Math.floor(Math.random() * queue.length);
    playTrack(queue[randomIndex], queue, {
      pageType: "release_detail",
      entitySlug: release.slug,
      entityType: "release",
      sourceSection: "release_hero",
    });
  };

  return (
    <section className="relative -mt-16 pt-16 overflow-hidden">
      {/* Ambient blurred background */}
      {canUseArtwork ? (
        <div
          className="absolute inset-0 opacity-20 scale-110"
          style={{
            backgroundImage: `url("${release.artworkUrl}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(90px) saturate(1.4)",
          }}
        />
      ) : (
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_18%_72%,rgba(16,21,16,0.24),transparent_34%),radial-gradient(circle_at_78%_18%,rgba(133,196,65,0.22),transparent_30%)]" />
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--wk-bg)]/40 via-[var(--wk-bg)]/70 to-[var(--wk-bg)]" />

      {/* Content */}
      <div className="relative z-10 wk-container-wide px-6 py-16 md:py-24 lg:py-28">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start lg:items-end">
          {/* Album cover */}
          <div
            className="relative flex-shrink-0 w-[280px] md:w-[340px] lg:w-[380px] aspect-square overflow-hidden"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            {canUseArtwork ? (
              <img
                src={release.artworkUrl}
                alt={`${release.title} album artwork`}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-700 ease-out"
                style={{ transform: hovered ? "scale(1.04)" : "scale(1)" }}
                onError={() => setArtworkFailed(true)}
              />
            ) : (
              <div className="relative h-full w-full overflow-hidden bg-[linear-gradient(135deg,#f7f9f1_0%,#dfe8d6_54%,#7fa64a_100%)] p-8 text-[#101510] transition-transform duration-700 ease-out" style={{ transform: hovered ? "scale(1.04)" : "scale(1)" }}>
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/25" />
                <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-black/10" />
                <div className="relative z-10 flex h-full flex-col justify-between">
                  <div className="text-[13px] font-black uppercase tracking-[0.42em] text-[#30451f]">WAKILISHA</div>
                  <div>
                    <div className="mb-10 text-[96px] font-black leading-none tracking-[-0.08em] md:text-[124px]">{initial}</div>
                    <div className="max-w-[82%] text-[28px] font-black leading-[0.95] tracking-[-0.05em] md:text-[34px]">{release.title}</div>
                    <div className="mt-4 text-[15px] font-extrabold text-[#30451f]">{release.artist}</div>
                  </div>
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pb-2">
            {/* Kicker */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/30 bg-[var(--wk-brand-soft)]/60 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-5">
              <WkIcon name="Album" size={13} />
              {release.releaseType}
            </div>

            {/* Title */}
            <h1
              className="font-[var(--wk-font-display)] font-black text-[var(--wk-text)] leading-[0.9] tracking-[-0.05em]"
              style={{ fontSize: "clamp(40px, 6vw, 84px)" }}
            >
              {release.title}
            </h1>

            {/* Artist / Label */}
            <div className="flex flex-wrap items-center gap-3 mt-4 text-[15px] md:text-[17px] font-bold text-[var(--wk-text-muted)]">
              <a
                href={`/artists/${slugify(release.artist)}`}
                className="text-[var(--wk-text)] hover:text-[var(--wk-brand)] transition-colors"
              >
                {release.artist}
              </a>
              {release.labelName && release.labelName !== "Independent" && release.labelName !== "WAKILISHA" && release.labelName !== "WAKILISHA Registry" && release.labelName !== "Unknown" && (
                <>
                  <span className="text-[var(--wk-text-faint)]">·</span>
                  {release.labelSlug && release.labelSlug !== "wakilisha-registry" ? (
                    <a
                      href={`/labels/${release.labelSlug}`}
                      className="text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] transition-colors text-[14px] md:text-[15px]"
                    >
                      {release.labelName}
                    </a>
                  ) : (
                    <span className="text-[var(--wk-text-muted)] text-[14px] md:text-[15px]">{release.labelName}</span>
                  )}
                </>
              )}
            </div>

            {/* Featured Artists */}
            {release.featuredArtists && release.featuredArtists.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-3 text-[12px] font-semibold text-[var(--wk-text-muted)]">
                <WkIcon name="UserPlus" size={13} />
                <span className="text-[var(--wk-text-faint)]">feat.</span>
                {release.featuredArtists.map((fa, i) => (
                  <span key={fa.slug || fa.name}>
                    <a
                      href={`/artists/${fa.slug || slugify(fa.name)}`}
                      className="text-[var(--wk-text)] hover:text-[var(--wk-brand)] transition-colors"
                    >
                      {fa.name}
                    </a>
                    {i < release.featuredArtists.length - 1 && (
                      <span className="text-[var(--wk-text-faint)] ml-1">,</span>
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-5 mt-6 text-[12px] font-bold text-[var(--wk-text-muted)]">
              <span className="inline-flex items-center gap-2">
                <WkIcon name="Calendar" size={14} />
                {release.year}
              </span>
              <span className="inline-flex items-center gap-2">
                <WkIcon name="ListMusic" size={14} />
                {release.trackCount} tracks
              </span>
              <span className="inline-flex items-center gap-2">
                <WkIcon name="Clock3" size={14} />
                {minutes} min
              </span>
              <span className="inline-flex items-center gap-2">
                <WkIcon name="Disc3" size={14} />
                {release.releaseType}
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 mt-8">
              <button
                onClick={handlePlay}
                className="inline-flex items-center gap-2.5 rounded-xl bg-[var(--wk-brand)] text-white px-6 py-3 text-[14px] font-extrabold hover:bg-[var(--wk-brand)]/90 transition-colors whitespace-nowrap cursor-pointer"
              >
                <WkIcon name={isThisReleasePlaying && isPlaying ? "Pause" : "Play"} size={18} />
                {isThisReleasePlaying && isPlaying ? "Pause" : "Play"}
              </button>
              <button
                onClick={handleShuffle}
                className="inline-flex items-center gap-2.5 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] px-5 py-3 text-[13px] font-bold hover:bg-[var(--wk-surface-raised)] transition-colors whitespace-nowrap cursor-pointer"
              >
                <WkIcon name="Shuffle" size={16} />
                Shuffle
              </button>
              <button className="inline-flex items-center gap-2.5 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] px-5 py-3 text-[13px] font-bold hover:bg-[var(--wk-surface-raised)] transition-colors whitespace-nowrap">
                <WkIcon name="Heart" size={16} />
                Save
              </button>
              <div className="ml-1">
                <ShareButton
                  item={{
                    title: release.title,
                    subtitle: release.artist,
                    description: shareDescription,
                    imageUrl: release.artworkUrl,
                    type: "album",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
