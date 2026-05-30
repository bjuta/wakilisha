import { useParams, Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { WkTag } from "@/components/design-system/primitives/Tag";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkButton } from "@/components/design-system/primitives/Button";
import { TRACK_DETAILS } from "@/mocks/trackDetails";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function MovementBadge({ movement, amount }: { movement?: string; amount?: number }) {
  if (movement === "new") {
    return <span className="rounded bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)] uppercase tracking-wider">New</span>;
  }
  if (movement === "up") {
    return <span className="flex items-center gap-0.5 text-[12px] font-bold text-[var(--wk-brand)]"><i className="ri-arrow-up-line" /> {amount}</span>;
  }
  if (movement === "down") {
    return <span className="flex items-center gap-0.5 text-[12px] font-bold text-[var(--wk-danger)]"><i className="ri-arrow-down-line" /> {amount}</span>;
  }
  return <span className="text-[12px] text-[var(--wk-text-faint)]">—</span>;
}

export default function TrackDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const track = TRACK_DETAILS.find((t) => t.slug === slug);

  if (!track) {
    return (
      <div className="wk-container px-6 py-20 text-center">
        <i className="ri-music-2-line mb-4 block text-5xl text-[var(--wk-text-faint)]" />
        <h1 className="wk-h-section mb-2">Track not found</h1>
        <p className="text-[var(--wk-text-muted)]">This track does not exist in the charts.</p>
        <Link to="/charts" className="mt-6 inline-block">
          <WkButton variant="primary">Back to charts</WkButton>
        </Link>
      </div>
    );
  }

  const isCurrentTrack = currentTrack?.id === track.slug;
  const isTrackPlaying = isCurrentTrack && isPlaying;

  const handlePlay = () => {
    if (!track.isPlayable) return;
    if (isCurrentTrack) {
      togglePlay();
      return;
    }
    playTrack(
      {
        id: track.slug,
        title: track.title,
        artist: track.artist,
        artworkUrl: track.artworkUrl,
        isPlayable: track.isPlayable,
        source: track.source,
        duration: track.duration,
      },
      TRACK_DETAILS
        .filter((t) => t.isPlayable)
        .map((t) => ({
          id: t.slug,
          title: t.title,
          artist: t.artist,
          artworkUrl: t.artworkUrl,
          isPlayable: t.isPlayable,
          source: t.source,
          duration: t.duration,
        }))
    );
  };

  return (
    <>
      {/* Track Hero */}
      <section className="relative min-h-[360px] md:min-h-[440px] flex items-end overflow-hidden">
        {track.artworkUrl && (
          <>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${track.artworkUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
          </>
        )}
        <div className="relative wk-container px-6 pb-10 pt-16 w-full">
          <div className="mb-3 flex items-center gap-2">
            <div className="wk-eyebrow" style={{ color: "var(--wk-brand)" }}>Charts</div>
            <WkTag variant="brand">#{track.rank}</WkTag>
          </div>
          <h1 className="wk-h-page mb-3" style={{ color: "#F0EFE8" }}>
            {track.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-[14px]" style={{ color: "rgba(240,239,232,.7)" }}>
            {track.artistSlug ? (
              <Link to={`/artists/${track.artistSlug}`} className="font-semibold hover:underline">
                {track.artist}
              </Link>
            ) : (
              <span className="font-semibold">{track.artist}</span>
            )}
            <span>·</span>
            <span>{track.genre}</span>
            <span>·</span>
            <span>{track.label}</span>
            {track.streamCount && (
              <>
                <span>·</span>
                <span>{track.streamCount} streams</span>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="wk-container px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-10">
            {/* Play Actions */}
            <div className="flex items-center gap-4">
              <WkButton
                variant="primary"
                size="lg"
                onClick={handlePlay}
                disabled={!track.isPlayable}
                className="!w-auto"
              >
                <i className={`${isTrackPlaying ? "ri-pause-fill" : "ri-play-fill"}`} />
                {isTrackPlaying ? "Pause" : track.isPlayable ? "Play" : "Preview"}
              </WkButton>
              {track.source && (
                <span className="text-[12px] text-[var(--wk-text-muted)]">
                  Source: {track.source}
                </span>
              )}
            </div>

            {/* Chart Performance */}
            <div>
              <h2 className="mb-4 text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">
                Chart performance
              </h2>
              <WkSurface className="overflow-hidden">
                <div className="divide-y divide-[var(--wk-divider)]">
                  <div className="flex items-center justify-between px-5 py-4">
                    <span className="text-[13px] text-[var(--wk-text-soft)]">Current position</span>
                    <span className="text-[18px] font-black text-[var(--wk-brand)]">#{track.rank}</span>
                  </div>
                  <div className="flex items-center justify-between px-5 py-4">
                    <span className="text-[13px] text-[var(--wk-text-soft)]">Peak position</span>
                    <span className="text-[14px] font-bold text-[var(--wk-text)]">#{track.peakPosition}</span>
                  </div>
                  <div className="flex items-center justify-between px-5 py-4">
                    <span className="text-[13px] text-[var(--wk-text-soft)]">Weeks on chart</span>
                    <span className="text-[14px] font-bold text-[var(--wk-text)]">{track.weeksOnChart}</span>
                  </div>
                  <div className="flex items-center justify-between px-5 py-4">
                    <span className="text-[13px] text-[var(--wk-text-soft)]">Movement</span>
                    <MovementBadge movement={track.movement} amount={track.movementAmount} />
                  </div>
                  {track.previousWeek && track.previousWeek > 0 && (
                    <div className="flex items-center justify-between px-5 py-4">
                      <span className="text-[13px] text-[var(--wk-text-soft)]">Previous week</span>
                      <span className="text-[14px] font-bold text-[var(--wk-text)]">#{track.previousWeek}</span>
                    </div>
                  )}
                  {track.duration && (
                    <div className="flex items-center justify-between px-5 py-4">
                      <span className="text-[13px] text-[var(--wk-text-soft)]">Duration</span>
                      <span className="text-[14px] font-bold text-[var(--wk-text)]">{formatDuration(track.duration)}</span>
                    </div>
                  )}
                </div>
              </WkSurface>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Track Info */}
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
              <h3 className="mb-3 text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">
                Track info
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Genre</span>
                  <span className="text-[14px] font-bold text-[var(--wk-text)]">{track.genre}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Label</span>
                  <span className="text-[14px] font-bold text-[var(--wk-text)]">{track.label}</span>
                </div>
                {track.releaseYear && (
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[var(--wk-text-soft)]">Year</span>
                    <span className="text-[14px] font-bold text-[var(--wk-text)]">{track.releaseYear}</span>
                  </div>
                )}
                {track.albumTitle && (
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[var(--wk-text-soft)]">Album</span>
                    <span className="text-[14px] font-bold text-[var(--wk-text)]">{track.albumTitle}</span>
                  </div>
                )}
                {track.streamCount && (
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[var(--wk-text-soft)]">Streams</span>
                    <span className="text-[14px] font-bold text-[var(--wk-text)]">{track.streamCount}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Playable</span>
                  <span className={`text-[14px] font-bold ${track.isPlayable ? "text-[var(--wk-brand)]" : "text-[var(--wk-text-faint)]"}`}>
                    {track.isPlayable ? "Yes" : "Preview only"}
                  </span>
                </div>
              </div>
            </div>

            {/* Artist */}
            {track.artistSlug && (
              <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
                <h3 className="mb-3 text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">
                  Artist
                </h3>
                <Link
                  to={`/artists/${track.artistSlug}`}
                  className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-[var(--wk-surface-raised)]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]">
                    {track.artistImage ? (
                      <img src={track.artistImage} alt={track.artist} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <i className="ri-user-line text-[var(--wk-text-muted)]" />
                    )}
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-[var(--wk-text)]">{track.artist}</div>
                    <div className="text-[11px] text-[var(--wk-text-muted)]">View artist page</div>
                  </div>
                  <i className="ri-arrow-right-s-line ml-auto text-[var(--wk-text-faint)]" />
                </Link>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}