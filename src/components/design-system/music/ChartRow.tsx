import { Link } from "react-router-dom";
import { WkTag } from "@/components/design-system/primitives/Tag";
import { usePlayer } from "@/context/PlayerContext";

export interface ChartRowProps {
  rank: number;
  artworkUrl?: string;
  title: string;
  artist: string;
  movement?: "up" | "down" | "new" | "same";
  movementAmount?: number;
  weeksOnChart?: number;
  peakPosition?: number;
  isPlayable?: boolean;
  source?: string;
  onPlay?: () => void;
  isPlaying?: boolean;
  genre?: string;
  label?: string;
  previousWeek?: number;
  slug?: string;
  artistSlug?: string;
  compact?: boolean;
}

const MOVEMENT_CONFIG = {
  up: { icon: "ri-arrow-up-line", color: "var(--wk-success)", bg: "var(--wk-success-soft)", label: "Up" },
  down: { icon: "ri-arrow-down-line", color: "var(--wk-danger)", bg: "var(--wk-danger-soft)", label: "Down" },
  new: { icon: "ri-star-smile-line", color: "var(--wk-brand)", bg: "var(--wk-brand-soft)", label: "New" },
  same: { icon: "ri-subtract-line", color: "var(--wk-text-faint)", bg: "transparent", label: "Same" },
};

const RANK_COLORS: Record<number, string> = {
  1: "#C9A96E",
  2: "#A8A8A8",
  3: "#B87333",
};

export function ChartRow({
  rank,
  artworkUrl,
  title,
  artist,
  movement,
  movementAmount,
  weeksOnChart,
  peakPosition,
  isPlayable,
  source,
  onPlay,
  genre,
  label,
  previousWeek,
  slug,
  compact,
}: ChartRowProps) {
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const trackId = slug || `${title}-${artist}`.toLowerCase().replace(/\s+/g, "-");
  const isCurrentTrack = currentTrack?.id === trackId;
  const mvt = movement ? MOVEMENT_CONFIG[movement] : null;
  const isTop3 = rank <= 3;
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

  if (compact) {
    return (
      <div className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--wk-surface-raised)]">
        <div className="flex w-6 shrink-0 flex-col items-center">
          <span className="text-sm font-black leading-none" style={{ color: RANK_COLORS[rank] || "var(--wk-text-muted)" }}>
            {rank}
          </span>
        </div>
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
          {artworkUrl ? (
            <img src={artworkUrl} alt="" className="h-full w-full object-cover object-top" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--wk-text-faint)]">
              <i className="ri-music-2-line text-sm" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-bold text-[var(--wk-text)]">{title}</div>
          <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{artist}</div>
        </div>
        {mvt && (
          <span className="flex items-center text-[10px] font-bold" style={{ color: mvt.color }}>
            <i className={`${mvt.icon} text-[10px]`} />
            {movementAmount && movementAmount > 0 ? movementAmount : ""}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-[var(--wk-d-fast)] hover:bg-[var(--wk-surface-raised)] ${isTop3 ? "bg-[var(--wk-surface-raised)]/50" : ""}`}>
      {/* Rank */}
      <div className="flex w-12 shrink-0 flex-col items-center">
        <span
          className="text-[22px] font-black leading-none"
          style={{ color: RANK_COLORS[rank] || "var(--wk-text-muted)" }}
        >
          {rank}
        </span>
        {mvt && (
          <span
            className="mt-0.5 flex items-center gap-0.5 text-[11px] font-bold"
            style={{ color: mvt.color }}
          >
            <i className={`${mvt.icon} text-[11px]`} />
            {movementAmount && movementAmount > 0 ? movementAmount : ""}
          </span>
        )}
      </div>

      {/* Artwork */}
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
        {artworkUrl ? (
          <img src={artworkUrl} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--wk-text-faint)]">
            <i className="ri-music-2-line text-xl" />
          </div>
        )}
        <button
          onClick={handlePlay}
          disabled={!playable}
          aria-label={isCurrentTrack && isPlaying ? "Pause" : "Play"}
          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-[var(--wk-d-fast)] group-hover:opacity-100 disabled:opacity-0"
        >
          <i className={`text-white ${isCurrentTrack && isPlaying ? "ri-pause-fill" : "ri-play-fill"}`} />
        </button>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          {slug ? (
            <Link to={`/tracks/${slug}`} className="truncate text-[14px] font-bold text-[var(--wk-text)] hover:underline">
              {title}
            </Link>
          ) : (
            <span className="truncate text-[14px] font-bold text-[var(--wk-text)]">{title}</span>
          )}
          {peakPosition !== undefined && peakPosition === rank && (
            <span className="shrink-0 rounded-full bg-[var(--wk-brand-soft)] border border-[var(--wk-brand)]/30 px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">
              PEAK
            </span>
          )}
          {!playable && (
            <span className="shrink-0 rounded-full bg-[var(--wk-surface-raised)] border border-[var(--wk-border)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-text-faint)]">
              Preview
            </span>
          )}
        </div>
        <div className="truncate text-[12px] text-[var(--wk-text-muted)]">{artist}</div>
        {(genre || label || previousWeek !== undefined) && (
          <div className="mt-1 hidden items-center gap-2 text-[11px] md:flex" style={{ color: "var(--wk-text-faint)" }}>
            {genre && <span>{genre}</span>}
            {genre && label && <span>·</span>}
            {label && <span>{label}</span>}
            {previousWeek !== undefined && previousWeek > 0 && (
              <>
                <span>·</span>
                <span>Was #{previousWeek}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="hidden shrink-0 flex-col items-end gap-1 md:flex">
        {weeksOnChart !== undefined && (
          <WkTag>{weeksOnChart} wk{weeksOnChart !== 1 ? "s" : ""}</WkTag>
        )}
        {peakPosition !== undefined && (
          <span className="text-[11px] text-[var(--wk-text-faint)]">
            Peak #{peakPosition}
          </span>
        )}
      </div>

      {/* Play button */}
      <button
        onClick={handlePlay}
        disabled={!playable}
        aria-label={isCurrentTrack && isPlaying ? "Pause" : "Play"}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] transition-all duration-[var(--wk-d-fast)] disabled:opacity-40 disabled:cursor-not-allowed ${isCurrentTrack ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
      >
        <i className={`text-sm ${isCurrentTrack && isPlaying ? "ri-pause-fill" : "ri-play-mini-fill"}`} />
      </button>
    </div>
  );
}