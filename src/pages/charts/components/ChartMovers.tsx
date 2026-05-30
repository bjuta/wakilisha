import { WkTag } from "@/components/design-system/primitives/Tag";

export interface ChartEntry {
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
  isPlayable?: boolean;
}

interface ChartMoversProps {
  entries: ChartEntry[];
}

const MOVEMENT_CONFIG = {
  up: { icon: "ri-arrow-up-line", color: "var(--wk-success)", label: "Up" },
  down: { icon: "ri-arrow-down-line", color: "var(--wk-danger)", label: "Down" },
  new: { icon: "ri-star-smile-line", color: "var(--wk-brand)", label: "New" },
  same: { icon: "ri-subtract-line", color: "var(--wk-text-faint)", label: "Same" },
};

export function ChartMovers({ entries }: ChartMoversProps) {
  return (
    <section className="bg-[var(--wk-surface)]"
    >
      <div className="wk-container px-6 py-12 md:py-16"
      >
        <div className="mb-6"
        >
          <div className="wk-eyebrow mb-2"
          >Gaining ground</div>
          <h3 className="wk-h-section"
          >Biggest movers</h3>
        </div>

        <div className="space-y-3"
        >
          {entries.map((entry) => {
            const mvt = entry.movement ? MOVEMENT_CONFIG[entry.movement] : null;
            return (
              <div
                key={entry.rank}
                className="group flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3 transition-all hover:border-[var(--wk-border-2)]"
              >
                {/* Rank */}
                <div className="flex w-10 shrink-0 flex-col items-center"
                >
                  <span className="text-[20px] font-black leading-none text-[var(--wk-brand)]"
                  >
                    {entry.rank}
                  </span>
                  {mvt && (
                    <span className="mt-0.5 flex items-center gap-0.5 text-[10px] font-bold" style={{ color: mvt.color }}
                    >
                      <i className={mvt.icon} />
                      {entry.movementAmount}
                    </span>
                  )}
                </div>

                {/* Artwork */}
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]"
                >
                  {entry.artworkUrl ? (
                    <img
                      src={entry.artworkUrl}
                      alt={entry.title}
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"
                    >
                      <i className="ri-music-2-line text-xl text-[var(--wk-text-faint)]" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1"
                >
                  <div className="mb-0.5 flex items-center gap-2"
                  >
                    <h4 className="truncate text-[14px] font-bold text-[var(--wk-text)]"
                    >
                      {entry.title}
                    </h4>
                    {entry.peakPosition !== undefined && entry.peakPosition === entry.rank && (
                      <span className="shrink-0 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]"
                      >
                        PEAK
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[12px]" style={{ color: "var(--wk-text-muted)" }}
                  >
                    {entry.artist}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px]" style={{ color: "var(--wk-text-faint)" }}
                  >
                    <span
                    >
                      {entry.weeksOnChart} wk{entry.weeksOnChart !== 1 ? "s" : ""}
                    </span>
                    <span
                    >
                      ·
                    </span>
                    <span
                    >
                      Peak #{entry.peakPosition}
                    </span>
                    {entry.previousWeek !== undefined && entry.previousWeek > 0 && (
                      <>
                        <span
                        >
                          ·
                        </span>
                        <span
                        >
                          Was #{entry.previousWeek}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Movement indicator */}
                <div className="hidden shrink-0 flex-col items-end md:flex"
                >
                  {mvt && (
                    <div
                      className="flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] font-bold"
                      style={{ background: `${mvt.color}20`, color: mvt.color }}
                    >
                      <i className={mvt.icon} />
                      {entry.movementAmount}
                      <span className="ml-1 text-[10px] font-medium uppercase opacity-70"
                      >
                        {mvt.label}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}