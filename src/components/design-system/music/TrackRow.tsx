import { usePlayer } from "@/context/PlayerContext";
import { WkTag } from "@/components/design-system/primitives/Tag";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";

export interface TrackRowProps {
  position?: number;
  artworkUrl?: string;
  title: string;
  artist: string;
  duration?: string;
  isPlayable?: boolean;
  source?: string;
  onPlay?: () => void;
  isPlaying?: boolean;
  compact?: boolean;
  id?: string;
}

export function TrackRow({
  position,
  artworkUrl,
  title,
  artist,
  duration,
  isPlayable,
  source,
  onPlay,
  isPlaying: isPlayingProp,
  compact = false,
  id,
}: TrackRowProps) {
  const { currentTrack, isPlaying: isPlayingCtx, playTrack } = usePlayer();
  const trackId = id || `${title}-${artist}`.toLowerCase().replace(/\s+/g, "-");
  const isCurrentTrack = currentTrack?.id === trackId;
  const isPlaying = isPlayingProp ?? (isCurrentTrack && isPlayingCtx);
  const playable = isPlayable !== false;

  const handlePlay = () => {
    if (!playable) return;
    if (onPlay) {
      onPlay();
      return;
    }
    const track = {
      id: trackId,
      title,
      artist,
      artworkUrl,
      isPlayable: playable,
      source,
    };
    playTrack(track, [track]);
  };

  return (
    <div
      className={`group flex items-center gap-3 rounded-lg px-3 transition-colors hover:bg-[var(--wk-surface-raised)] ${compact ? "py-2" : "py-3"}`}
    >
      {position !== undefined && (
        <span className="w-6 shrink-0 text-center text-sm font-bold text-[var(--wk-brand)]">
          {position}
        </span>
      )}

      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
        {artworkUrl ? (
          <img src={artworkUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Ch19GradientImage slug={trackId} name={title} />
        )}
        <button
            onClick={handlePlay}
            disabled={!playable}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-0"
          >
            <i className={`text-white ${isPlaying ? "ri-pause-fill" : "ri-play-fill"}`} />
          </button>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-[13px] font-bold text-[var(--wk-text)]">{title}</div>
          {!playable && (
            <span className="shrink-0 rounded-full bg-[var(--wk-surface-raised)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-text-faint)]">
              Preview
            </span>
          )}
        </div>
        <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{artist}</div>
      </div>

      {duration && (
        <span className="shrink-0 text-[12px] tabular-nums text-[var(--wk-text-faint)]">
          {duration}
        </span>
      )}

      <button
        onClick={handlePlay}
        disabled={!playable}
        aria-label={isPlaying ? "Pause" : "Play"}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isCurrentTrack ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
      >
        <i className={`text-sm ${isPlaying ? "ri-pause-fill" : "ri-play-mini-fill"}`} />
      </button>
    </div>
  );
}