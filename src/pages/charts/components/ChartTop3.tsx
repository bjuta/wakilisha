import { useState } from "react";
import { Link } from "react-router-dom";
import { WkTag } from "@/components/design-system/primitives/Tag";

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
}

const MOVEMENT_CONFIG = {
  up: { icon: "ri-arrow-up-line", color: "var(--wk-success)", label: "Up" },
  down: { icon: "ri-arrow-down-line", color: "var(--wk-danger)", label: "Down" },
  new: { icon: "ri-star-smile-line", color: "var(--wk-brand)", label: "New" },
  same: { icon: "ri-subtract-line", color: "var(--wk-text-faint)", label: "Same" },
};

const RANK_GRADIENTS: Record<number, string> = {
  1: "from-[#C9A96E]/25 via-transparent to-transparent",
  2: "from-[#A8A8A8]/20 via-transparent to-transparent",
  3: "from-[#B87333]/15 via-transparent to-transparent",
};

const RANK_COLORS: Record<number, string> = {
  1: "#C9A96E",
  2: "#A8A8A8",
  3: "#B87333",
};

export function ChartTop3({ entries }: { entries: Top3Entry[] }) {
  return (
    <section className="wk-container px-6 py-8 md:py-12">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {entries.map((entry, i) => {
          const mvt = entry.movement ? MOVEMENT_CONFIG[entry.movement] : null;
          const isEven = i % 2 === 0;
          return (
            <div
              key={entry.rank}
              className="group relative overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all hover:border-[var(--wk-border-2)]"
              style={{ order: isEven ? undefined : 0 }}
            >
              {/* Rank gradient glow */}
              <div className={`absolute inset-0 bg-gradient-to-b ${RANK_GRADIENTS[entry.rank] || "from-transparent to-transparent"} pointer-events-none`} />

              {/* Rank badge */}
              <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[18px] font-black"
                  style={{
                    background: RANK_COLORS[entry.rank] || "var(--wk-brand)",
                    color: "#0C0D0A",
                  }}
                >
                  {entry.rank}
                </div>
                {mvt && (
                  <div
                    className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={{ background: mvt.color, color: "#0C0D0A" }}
                  >
                    <i className={mvt.icon} />
                    {entry.movementAmount && entry.movementAmount > 0 ? entry.movementAmount : mvt.label}
                  </div>
                )}
              </div>

              {/* Artwork */}
              <div className="relative aspect-[4/3] bg-[var(--wk-surface-raised)]">
                {entry.artworkUrl ? (
                  <img
                    src={entry.artworkUrl}
                    alt={entry.title}
                    className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-standard)] group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <i className="ri-music-2-line text-4xl text-[var(--wk-text-faint)]" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                {/* Artist image overlay (small circle) */}
                {entry.artistImage && (
                  <div className="absolute bottom-3 left-3">
                    <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-white/20">
                      <img src={entry.artistImage} alt={entry.artist} className="h-full w-full object-cover" />
                    </div>
                  </div>
                )}

                {/* Title/artist overlay */}
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="ml-14">
                    <h3 className="truncate text-[16px] font-bold text-white md:text-[18px]">
                      {entry.title}
                    </h3>
                    <p className="truncate text-[13px] text-white/80">
                      {entry.artist}
                    </p>
                  </div>
                </div>
              </div>

              {/* Metadata row */}
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                  {entry.genre && <WkTag>{entry.genre}</WkTag>}
                  {entry.weeksOnChart !== undefined && (
                    <span className="text-[12px]" style={{ color: "var(--wk-text-muted)" }}>
                      {entry.weeksOnChart} wk{entry.weeksOnChart !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {entry.peakPosition !== undefined && entry.peakPosition === entry.rank && (
                    <span className="rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">
                      PEAK
                    </span>
                  )}
                  <span className="text-[11px]" style={{ color: "var(--wk-text-faint)" }}>
                    {entry.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}