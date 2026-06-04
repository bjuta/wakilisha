import { useState } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";

export interface Top3Entry {
  rank: number;
  title: string;
  artist: string;
  artworkUrl?: string;
  artistImage?: string;
  movement?: "up" | "down" | "new" | "same";
  movementAmount?: number;
  weeksOnChart?: number;
  peakPosition?: number;
  genre?: string;
  label?: string;
  previousWeek?: number;
  slug?: string;
  artistSlug?: string;
  isPlayable?: boolean;
  source?: string;
}

const MOVEMENT_CONFIG = {
  up: { icon: "ri-arrow-up-line", color: "#4FD98E", label: "Up" },
  down: { icon: "ri-arrow-down-line", color: "#FF6B6B", label: "Down" },
  new: { icon: "ri-star-smile-line", color: "#84C241", label: "New" },
  same: { icon: "ri-subtract-line", color: "#7E7C74", label: "Same" },
};

const RANK_STYLES: Record<
  number,
  {
    border: string;
    badgeBg: string;
    badgeText: string;
    gradient: string;
    glow: string;
  }
> = {
  1: {
    border: "border-[#C9A96E]/30",
    badgeBg: "#C9A96E",
    badgeText: "#0C0D0A",
    gradient: "from-[#C9A96E]/20 via-transparent to-transparent",
    glow: "shadow-[0_0_40px_-12px_rgba(201,169,110,0.25)]",
  },
  2: {
    border: "border-[#A8A8A8]/30",
    badgeBg: "#A8A8A8",
    badgeText: "#0C0D0A",
    gradient: "from-[#A8A8A8]/15 via-transparent to-transparent",
    glow: "shadow-[0_0_40px_-12px_rgba(168,168,168,0.20)]",
  },
  3: {
    border: "border-[#B87333]/30",
    badgeBg: "#B87333",
    badgeText: "#0C0D0A",
    gradient: "from-[#B87333]/15 via-transparent to-transparent",
    glow: "shadow-[0_0_40px_-12px_rgba(184,115,51,0.20)]",
  },
};

export function ChartTop3({
  entries,
  onPlayTrack,
}: {
  entries: Top3Entry[];
  onPlayTrack?: (entry: Top3Entry) => void;
}) {
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const [hoveredRank, setHoveredRank] = useState<number | null>(null);

  const handlePlay = (entry: Top3Entry) => {
    if (onPlayTrack) {
      onPlayTrack(entry);
      return;
    }
    if (entry.isPlayable === false) return;
    const track = {
      id: entry.slug || `${entry.title}-${entry.artist}`.toLowerCase().replace(/\s+/g, "-"),
      title: entry.title,
      artist: entry.artist,
      artworkUrl: entry.artworkUrl,
      isPlayable: entry.isPlayable !== false,
      source: entry.source,
    };
    playTrack(track, [track]);
  };

  return (
    <section className="wk-container px-4 py-6 md:px-6 md:py-10">
      <div className="mb-5 flex items-center gap-3">
        <div className="wk-eyebrow">Top 3</div>
        <span className="text-[11px] text-[var(--wk-text-faint)]">
          {entries.length} spotlight positions
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {entries.map((entry) => {
          const styles = RANK_STYLES[entry.rank] || {
            border: "border-[var(--wk-border)]",
            badgeBg: "var(--wk-brand)",
            badgeText: "var(--wk-brand-on)",
            gradient: "from-transparent to-transparent",
            glow: "",
          };
          const mvt = entry.movement ? MOVEMENT_CONFIG[entry.movement] : null;
          const trackId = entry.slug || `${entry.title}-${entry.artist}`.toLowerCase().replace(/\s+/g, "-");
          const isCurrentTrack = currentTrack?.id === trackId;
          const isPlayingCurrent = isCurrentTrack && isPlaying;
          const isHovered = hoveredRank === entry.rank;
          const isPlayable = entry.isPlayable !== false;

          return (
            <div
              key={entry.rank}
              className={`group relative overflow-hidden rounded-2xl border bg-[var(--wk-surface)] transition-all duration-[var(--wk-d-standard)] ${styles.border} ${styles.glow} ${isHovered ? "scale-[1.02]" : ""}`}
              onMouseEnter={() => setHoveredRank(entry.rank)}
              onMouseLeave={() => setHoveredRank(null)}
            >
              {/* Gradient glow */}
              <div
                className={`absolute inset-0 bg-gradient-to-b ${styles.gradient} pointer-events-none`}
              />

              {/* Artwork area */}
              <div className="relative aspect-[4/3] overflow-hidden bg-[var(--wk-surface-raised)]">
                {entry.artworkUrl ? (
                  <img
                    src={entry.artworkUrl}
                    alt={entry.title}
                    className={`h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-slow)] ${isHovered ? "scale-110" : "scale-100"}`}
                  />
                ) : (
                  <Ch19GradientImage slug={entry.slug || `top3-${entry.rank}`} name={entry.title} />
                )}

                {/* Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Play overlay */}
                {isPlayable && (
                  <button
                    onClick={() => handlePlay(entry)}
                    className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-[var(--wk-d-standard)] ${isHovered ? "opacity-100" : "opacity-0"}`}
                  >
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-[var(--wk-d-fast)]"
                      style={{ background: styles.badgeBg, transform: isHovered ? "scale(1)" : "scale(0.8)" }}
                    >
                      <i className={`${isPlayingCurrent ? "ri-pause-fill" : "ri-play-fill"} text-xl`} style={{ color: styles.badgeText }} />
                    </div>
                  </button>
                )}

                {/* Top bar: rank + movement */}
                <div className="absolute left-3 right-3 top-3 flex items-start justify-between">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[18px] font-black shadow-lg"
                    style={{ background: styles.badgeBg, color: styles.badgeText }}
                  >
                    {entry.rank}
                  </div>
                  {mvt && (
                    <div
                      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-md"
                      style={{ background: mvt.color, color: "#0C0D0A" }}
                    >
                      <i className={mvt.icon} />
                      {entry.movementAmount && entry.movementAmount > 0 ? entry.movementAmount : mvt.label}
                    </div>
                  )}
                </div>

                {/* Title/artist at bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="flex items-end gap-3">
                    {entry.artistImage && (
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-white/20">
                        <img src={entry.artistImage} alt={entry.artist} className="h-full w-full object-cover" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[17px] font-bold text-white md:text-[19px]">
                        {entry.title}
                      </h3>
                      <p className="truncate text-[13px] text-white/75">
                        {entry.artist}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info strip */}
              <div className="flex items-center justify-between border-t border-[var(--wk-border)] p-3">
                <div className="flex items-center gap-2">
                  {entry.genre && (
                    <span className="rounded-full bg-[var(--wk-surface-raised)] border border-[var(--wk-border-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-text-soft)]">
                      {entry.genre}
                    </span>
                  )}
                  {entry.weeksOnChart !== undefined && entry.weeksOnChart > 0 && (
                    <span className="text-[12px] text-[var(--wk-text-muted)]">
                      {entry.weeksOnChart} wk{entry.weeksOnChart !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {entry.peakPosition !== undefined && entry.peakPosition === entry.rank && (
                    <span className="rounded-full bg-[var(--wk-brand-soft)] border border-[var(--wk-brand)]/30 px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">
                      PEAK
                    </span>
                  )}
                  {entry.label && (
                    <span className="hidden truncate text-[11px] text-[var(--wk-text-faint)] md:block">
                      {entry.label}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}