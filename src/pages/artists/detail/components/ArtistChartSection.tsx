import { Link } from "react-router-dom";

interface ChartEntry {
  rank: number;
  title: string;
  artist: string;
  movement?: "up" | "down" | "new" | "same";
  movementAmount?: number;
  weeksOnChart?: number;
  peakPosition?: number;
  isPlayable?: boolean;
  slug?: string;
}

interface ArtistChartSectionProps {
  entries: ChartEntry[];
}

function Movement({ movement, amount }: { movement: ChartEntry["movement"]; amount?: number }) {
  if (movement === "up") {
    return (
      <span className="flex items-center gap-0.5 text-[12px] font-bold text-[var(--wk-delta-up)]">
        <i className="ri-arrow-up-line" />
        {amount}
      </span>
    );
  }
  if (movement === "down") {
    return (
      <span className="flex items-center gap-0.5 text-[12px] font-bold text-[var(--wk-delta-down)]">
        <i className="ri-arrow-down-line" />
        {amount}
      </span>
    );
  }
  if (movement === "new") {
    return (
      <span className="rounded bg-[var(--wk-brand-soft)] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--wk-brand)]">
        NEW
      </span>
    );
  }
  return (
    <span className="text-[12px] font-bold text-[var(--wk-text-faint)]">—</span>
  );
}

export function ArtistChartSection({ entries }: ArtistChartSectionProps) {
  return (
    <section className="py-10 md:py-14">
      <div className="wk-container px-6">
        <div className="mb-6">
          <div className="wk-eyebrow mb-2">Chart performance</div>
          <h3 className="text-[clamp(24px,3vw,40px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
            Chart entries
          </h3>
        </div>

        <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
          <div className="grid grid-cols-[48px_1fr_80px_80px_80px_60px] items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--wk-text-faint)] hidden md:grid">
            <span className="text-center">#</span>
            <span>Title</span>
            <span className="text-center">Peak</span>
            <span className="text-center">Weeks</span>
            <span className="text-center">Move</span>
            <span className="text-center"></span>
          </div>
          <div className="divide-y divide-[var(--wk-divider)]">
            {entries.map((entry) => {
              const trackSlug = entry.slug || entry.title.toLowerCase().replace(/\s+/g, "-");
              return (
                <Link
                  key={entry.rank}
                  to={`/tracks/${trackSlug}`}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--wk-surface-raised)] md:grid md:grid-cols-[48px_1fr_80px_80px_80px_60px] md:gap-2"
                >
                  {/* Rank */}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[13px] font-black text-[var(--wk-brand)] md:mx-auto">
                    {entry.rank}
                  </span>

                  {/* Title */}
                  <div className="min-w-0 flex-1 md:flex-none">
                    <div className="truncate text-[13px] font-bold text-[var(--wk-text)]">{entry.title}</div>
                    <div className="truncate text-[11px] text-[var(--wk-text-muted)] md:hidden">
                      {entry.artist} · Peak #{entry.peakPosition} · {entry.weeksOnChart}w
                    </div>
                  </div>

                  {/* Peak — desktop only */}
                  <span className="hidden text-center text-[13px] font-bold text-[var(--wk-text)] md:block">
                    #{entry.peakPosition}
                  </span>

                  {/* Weeks — desktop only */}
                  <span className="hidden text-center text-[13px] font-semibold text-[var(--wk-text-muted)] md:block">
                    {entry.weeksOnChart}w
                  </span>

                  {/* Movement — desktop only */}
                  <span className="hidden md:flex items-center justify-center">
                    <Movement movement={entry.movement} amount={entry.movementAmount} />
                  </span>

                  {/* Play button */}
                  <span className="hidden md:flex items-center justify-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-0 transition-all group-hover:opacity-100">
                      <i className="ri-play-mini-fill text-sm" />
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}