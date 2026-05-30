import { WkTag } from "@/components/design-system/primitives/Tag";

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
  onPlay,
  isPlaying,
  genre,
  label,
  previousWeek,
}: ChartRowProps) {
  const mvt = movement ? MOVEMENT_CONFIG[movement] : null;
  const isTop3 = rank <= 3;

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
        <div className="mb-0.5 flex items-center gap-2">
          <span className="truncate text-[13px] font-bold text-[var(--wk-text)]">{title}</span>
          {peakPosition !== undefined && peakPosition === rank && (
            <span className="shrink-0 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">
              PEAK
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

      {isPlayable && (
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