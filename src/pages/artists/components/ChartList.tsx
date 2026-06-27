import { Link } from "react-router-dom";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";

interface ChartArtist {
  slug: string;
  name: string;
  imageUrl?: string;
  genres: string[];
  trackCount: number;
  releaseCount: number;
  topChartPosition: number;
}

interface ChartListProps {
  artists: ChartArtist[];
}

export function ChartList({ artists }: ChartListProps) {
  const sorted = [...artists].sort((a, b) => a.topChartPosition - b.topChartPosition).slice(0, 10);
  if (sorted.length === 0) return null;

  const podium = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <section className="px-4 py-14 md:px-6 md:py-20">
      <div className="wk-container-wide">
        <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="wk-eyebrow mb-3">Chart leaders</div>
            <h3 className="wk-h-page">Who runs the numbers</h3>
          </div>
          <p className="wk-copy max-w-[44ch] text-[13px]">
            The artists dominating the WAKILISHA charts with the highest peak positions.
          </p>
        </div>

        {/* PODIUM — Top 3 cards in a dramatic horizontal layout */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
          {podium.map((artist, idx) => {
            const isFirst = idx === 0;
            const medalColors = ["text-yellow-400", "text-slate-300", "text-amber-600"];
            const borderColors = [
              "border-yellow-400/30 hover:border-yellow-400/60",
              "border-slate-400/20 hover:border-slate-400/50",
              "border-amber-600/30 hover:border-amber-600/60",
            ];

            return (
              <Link
                key={artist.slug}
                to={`/artists/${artist.slug}`}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-[var(--wk-surface)] transition-all duration-[var(--wk-d-standard)] hover:-translate-y-2 ${borderColors[idx]} ${isFirst ? "sm:-mt-4 sm:min-h-[380px]" : "sm:min-h-[340px]"}`}
              >
                {/* Rank number — huge, behind content */}
                <div className="absolute -right-4 -top-6 select-none font-black text-[120px] leading-none tracking-[-0.07em] text-[var(--wk-border)] opacity-40">
                  {String(idx + 1).padStart(2, "0")}
                </div>

                {/* Image */}
                <div className="relative aspect-[4/5] overflow-hidden bg-[var(--wk-surface-raised)]">
                  {artist.imageUrl ? (
                    <img
                      src={artist.imageUrl}
                      alt={artist.name}
                      className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-slow)] group-hover:scale-105"
                    />
                  ) : (
                    <Ch19GradientImage slug={artist.slug} name={artist.name} />
                  )}
                  {/* Medal badge */}
                  <div className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-md">
                    <span className={`font-black text-xl ${medalColors[idx]}`}>#{idx + 1}</span>
                  </div>
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    <h4 className="text-[18px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)] md:text-[20px]">
                      {artist.name}
                    </h4>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--wk-text-muted)]">
                      <span>{artist.trackCount} tracks</span>
                      <span className="opacity-40">·</span>
                      <span>{artist.releaseCount} releases</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wk-brand-soft)] px-3 py-1.5 text-[11px] font-bold text-[var(--wk-brand)]">
                      <i className="ri-bar-chart-line text-[10px]" />
                      Peak #{artist.topChartPosition}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* REST OF CHART — clean bordered list */}
        {rest.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
            {rest.map((artist, index) => (
              <Link
                key={artist.slug}
                to={`/artists/${artist.slug}`}
                className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--wk-bg-subtle)] md:gap-6 md:px-6 md:py-5 border-b border-[var(--wk-divider)] last:border-b-0"
              >
                {/* Rank */}
                <div className="w-9 shrink-0 text-right">
                  <span className="font-black text-[24px] leading-none tracking-[-0.04em] text-[var(--wk-text-faint)] md:text-[28px]">
                    {String(index + 4).padStart(2, "0")}
                  </span>
                </div>

                {/* Image */}
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)] md:h-16 md:w-16">
                  {artist.imageUrl ? (
                    <img src={artist.imageUrl} alt={artist.name} className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-slow)] group-hover:scale-110" />
                  ) : (
                    <Ch19GradientImage slug={artist.slug} name={artist.name} />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <h4 className="text-[15px] font-bold text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)] md:text-[16px]">
                    {artist.name}
                  </h4>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[var(--wk-text-muted)]">
                    <span>{artist.trackCount} tracks</span>
                    <span className="opacity-40">·</span>
                    <span>{artist.releaseCount} releases</span>
                  </div>
                </div>

                {/* Genres — desktop */}
                <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
                  {artist.genres.slice(0, 2).map((g) => (
                    <span key={g} className="rounded-full border border-[var(--wk-border-2)] bg-[var(--wk-bg-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--wk-text-soft)]">
                      {g}
                    </span>
                  ))}
                </div>

                {/* Peak badge */}
                <div className="hidden shrink-0 md:block">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wk-brand-soft)] px-3 py-1.5 text-[11px] font-bold text-[var(--wk-brand)]">
                    <i className="ri-bar-chart-line text-[11px]" />
                    #{artist.topChartPosition}
                  </span>
                </div>

                <div className="shrink-0 text-[var(--wk-text-faint)] transition-all group-hover:translate-x-1 group-hover:text-[var(--wk-brand)]">
                  <i className="ri-arrow-right-s-line text-lg" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}