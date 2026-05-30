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
}

const MOVEMENT_CONFIG = {
  up: { icon: "ri-arrow-up-line", color: "var(--wk-success)", label: "Up" },
  down: { icon: "ri-arrow-down-line", color: "var(--wk-danger)", label: "Down" },
  new: { icon: "ri-star-smile-line", color: "var(--wk-brand)", label: "New" },
  same: { icon: "ri-subtract-line", color: "var(--wk-text-faint)", label: "Same" },
};

const RANK_COLORS: Record<number, string> = {
  1: "var(--wk-brand)",
  2: "var(--wk-brand)",
  3: "var(--wk-brand)",
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

  return (
    <div className={`group flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-[var(--wk-surface-raised)] ${isTop3 ? "bg-[var(--wk-brand-soft)]/30" : ""}`}>
      <div className="flex w-8 shrink-0 flex-col items-center">
        <span
          className="text-lg font-black leading-none"
          style={{ color: RANK_COLORS[rank] || "var(--wk-text-muted)" }}
        >
          {rank}
        </span>
        {mvt && (
          <span
            className="mt-0.5 flex items-center text-[10px] font-bold"
            style={{ color: mvt.color }}
          >
            <i className={`${mvt.icon} text-[10px]`} />
            {movementAmount && movementAmount > 0 ? movementAmount : ""}
          </span>
        )}
      </div>

      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
        {artworkUrl ? (
          <img src={artworkUrl} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--wk-text-faint)]">
            <i className="ri-music-2-line text-lg" />
          </div>
        )}
        <button
          onClick={handlePlay}
          disabled={!playable}
          aria-label={isCurrentTrack && isPlaying ? "Pause" : "Play"}
          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-0"
        >
          <i className={`text-white ${isCurrentTrack && isPlaying ? "ri-pause-fill" : "ri-play-fill"}`} />
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          {slug ? (
            <Link to={`/tracks/${slug}`} className="truncate text-[13px] font-bold text-[var(--wk-text)] hover:underline">
              {title}
            </Link>
          ) : (
            <span className="truncate text-[13px] font-bold text-[var(--wk-text)]">{title}</span>
          )}
          {peakPosition !== undefined && peakPosition === rank && (
            <span className="shrink-0 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">
              PEAK
            </span>
          )}
          {!playable && (
            <span className="shrink-0 rounded-full bg-[var(--wk-surface-raised)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-text-faint)]">
              Preview
            </span>
          )}
        </div>
        <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{artist}</div>
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

      <button
        onClick={handlePlay}
        disabled={!playable}
        aria-label={isCurrentTrack && isPlaying ? "Pause" : "Play"}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isCurrentTrack ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
      >
        <i className={`text-sm ${isCurrentTrack && isPlaying ? "ri-pause-fill" : "ri-play-mini-fill"}`} />
      </button>
    </div>
  );
}