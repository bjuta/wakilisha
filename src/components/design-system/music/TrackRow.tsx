import { WkTag } from "@/components/design-system/primitives/Tag";
import { WkButton } from "@/components/design-system/primitives/Button";

export interface TrackRowProps {
  position?: number;
  artworkUrl?: string;
  title: string;
  artist: string;
  duration?: string;
  isPlayable?: boolean;
  onPlay?: () => void;
  isPlaying?: boolean;
  compact?: boolean;
}

export function TrackRow({
  position,
  artworkUrl,
  title,
  artist,
  duration,
  isPlayable,
  onPlay,
  isPlaying,
  compact = false,
}: TrackRowProps) {
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
          <div className="flex h-full w-full items-center justify-center text-[var(--wk-text-faint)]">
            <i className="ri-music-2-line text-lg" />
          </div>
        )}
        {isPlayable && (
          <button
            onClick={onPlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <i className={`text-white ${isPlaying ? "ri-pause-fill" : "ri-play-fill"}`} />
          </button>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold text-[var(--wk-text)]">{title}</div>
        <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{artist}</div>
      </div>

      {duration && (
        <span className="shrink-0 text-[12px] tabular-nums text-[var(--wk-text-faint)]">
          {duration}
        </span>
      )}

      {isPlayable && !duration && (
        <button
          onClick={onPlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-0 transition-all group-hover:opacity-100"
        >
          <i className={`text-sm ${isPlaying ? "ri-pause-fill" : "ri-play-mini-fill"}`} />
        </button>
      )}
    </div>
  );
}