import { Link } from "react-router-dom";
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
  isPlayable?: boolean;
}

interface ChartNewEntriesProps {
  entries: ChartEntry[];
}

export function ChartNewEntries({ entries }: ChartNewEntriesProps) {
  return (
    <section className="wk-container px-6 py-12 md:py-16"
    >
      <div className="mb-6"
      >
        <div className="wk-eyebrow mb-2"
        >This week&apos;s arrivals</div>
        <h3 className="wk-h-section"
        >New entries</h3>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {entries.map((entry) => (
          <div
            key={entry.rank}
            className="group relative overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all hover:border-[var(--wk-border-2)]"
          >
            {/* NEW badge */}
            <div className="absolute left-3 top-3 z-10"
            >
              <span className="rounded-full bg-[var(--wk-brand)] px-3 py-1 text-[11px] font-black text-[var(--wk-brand-on)]"
              >
                NEW
              </span>
            </div>

            <div className="relative aspect-square bg-[var(--wk-surface-raised)]"
            >
              {entry.artworkUrl ? (
                <img
                  src={entry.artworkUrl}
                  alt={entry.title}
                  className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-standard)] group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center"
                >
                  <i className="ri-music-2-line text-4xl text-[var(--wk-text-faint)]" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            </div>

            <div className="p-3"
            >
              <div className="mb-1 flex items-center gap-2"
              >
                <span className="text-[18px] font-black text-[var(--wk-brand)]"
                >
                  #{entry.rank}
                </span>
                <span className="text-[11px]" style={{ color: "var(--wk-text-faint)" }}
                >
                  debut
                </span>
              </div>
              <h4 className="mb-0.5 truncate text-[14px] font-bold text-[var(--wk-text)]"
              >
                {entry.title}
              </h4>
              <p className="truncate text-[12px]" style={{ color: "var(--wk-text-muted)" }}
              >
                {entry.artist}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2"
              >
                {entry.genre && <WkTag>{entry.genre}</WkTag>}
                <span className="text-[11px]" style={{ color: "var(--wk-text-faint)" }}
                >
                  {entry.label}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}