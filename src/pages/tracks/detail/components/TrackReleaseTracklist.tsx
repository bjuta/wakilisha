import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { usePlayer } from "@/context/PlayerContext";
import { trackUrl } from "@/utils/trackUrl";

export interface ReleaseTrackData {
  id: string;
  slug: string;
  title: string;
  artist: string;
  duration: number;
  trackNumber: number;
  artworkUrl: string;
  previewUrl?: string;
}

function formatDuration(seconds: number): string {
  if (!seconds) return "\u2014";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface TrackReleaseTracklistProps {
  artistSlug: string;
  currentTrackSlug: string;
  albumTitle: string;
  tracks: ReleaseTrackData[];
}

export default function TrackReleaseTracklist({
  artistSlug,
  currentTrackSlug,
  albumTitle,
  tracks,
}: TrackReleaseTracklistProps) {
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer();

  if (!tracks || tracks.length === 0) return null;

  const displayTitle = albumTitle || "Tracklist";
  const displayCount = tracks.length;

  const handlePlayTrack = (track: ReleaseTrackData, trackIndex: number) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
      return;
    }

    const queueTracks = tracks.slice(trackIndex).map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      artworkUrl: t.artworkUrl,
      duration: t.duration,
      previewUrl: t.previewUrl || undefined,
      album: albumTitle,
      artistSlug,
      trackSlug: t.slug,
    }));

    const remainingTracks = tracks.slice(0, trackIndex).map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      artworkUrl: t.artworkUrl,
      duration: t.duration,
      previewUrl: t.previewUrl || undefined,
      album: albumTitle,
      artistSlug,
      trackSlug: t.slug,
    }));

    const fullQueue = [...queueTracks, ...remainingTracks];
    playTrack(queueTracks[0], fullQueue, {
      pageType: "track_detail",
      entitySlug: currentTrackSlug,
      recordType: "track",
      sourceSection: "album_tracklist",
    });
  };

  return (
    <section>
      <div className="flex items-center gap-3 mb-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
          <WkIcon name="ListMusic" size={12} />
          Tracklist
        </div>
        <h2 className="text-[18px] md:text-[22px] font-black text-[var(--wk-text)] tracking-[-0.02em]">
          {displayTitle}
          <span className="text-[var(--wk-text-faint)] font-semibold text-[14px] ml-2">
            {displayCount} track{displayCount !== 1 ? "s" : ""}
          </span>
        </h2>
      </div>

      <div className="border border-[var(--wk-border)] rounded-2xl overflow-hidden bg-[var(--wk-surface)]">
        {tracks.map((track, index) => {
          const isCurrentTrack = currentTrack?.id === track.id;
          const isThisPlaying = isCurrentTrack && isPlaying;
          const isCurrentPage = track.slug === currentTrackSlug;

          return (
            <div
              key={track.id}
              className={`group grid items-center gap-3 px-4 py-3.5 border-b border-[var(--wk-divider)] last:border-b-0 transition-colors ${
                isCurrentPage ? "bg-[var(--wk-brand-soft)]/20" : "hover:bg-[var(--wk-surface-raised)]"
              }`}
              style={{ gridTemplateColumns: "44px 1fr 72px 40px" }}
            >
              {/* Track number / play button / current indicator */}
              <div className="flex items-center justify-center w-8 h-8 rounded-full text-[13px] font-extrabold transition-colors">
                {isCurrentPage ? (
                  <span className="w-2 h-2 rounded-full bg-[var(--wk-brand)]" aria-hidden="true" />
                ) : isThisPlaying ? (
                  <span className="animate-pulse text-[var(--wk-brand)]">
                    <WkIcon name="Volume2" size={14} />
                  </span>
                ) : (
                  <span className="text-[var(--wk-text-faint)] group-hover:text-[var(--wk-brand)] transition-colors group-hover:hidden">
                    {index + 1}
                  </span>
                )}
                {!isCurrentPage && (
                  <button
                    className="hidden group-hover:inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--wk-brand)] text-white cursor-pointer"
                    onClick={() => handlePlayTrack(track, index)}
                    aria-label={isCurrentTrack ? (isPlaying ? "Pause" : "Play") : `Play ${track.title}`}
                  >
                    <WkIcon name={isCurrentTrack && isPlaying ? "Pause" : "Play"} size={13} />
                  </button>
                )}
              </div>

              {/* Track info */}
              <Link
                to={trackUrl(track.slug, [artistSlug])}
                className="min-w-0 block"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button")) {
                    e.preventDefault();
                  }
                }}
              >
                <div className={`text-[14px] font-extrabold truncate transition-colors ${isCurrentPage ? "text-[var(--wk-brand)]" : "text-[var(--wk-text)] group-hover:text-[var(--wk-brand)]"}`}>
                  {track.title}
                </div>
                <div className="text-[11px] font-semibold text-[var(--wk-text-muted)] mt-0.5 truncate">
                  {track.artist}
                </div>
              </Link>

              {/* Duration */}
              <div className="text-[12px] font-bold text-[var(--wk-text-faint)] text-right tabular-nums">
                {formatDuration(track.duration)}
              </div>

              {/* Chevron to detail page */}
              <Link
                to={trackUrl(track.slug, [artistSlug])}
                className="flex items-center justify-center"
              >
                <WkIcon
                  name="ChevronRight"
                  size={14}
                  className={`transition-colors ${isCurrentPage ? "text-[var(--wk-brand)]" : "text-[var(--wk-text-faint)] group-hover:text-[var(--wk-text-muted)]"}`}
                />
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}