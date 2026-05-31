import { Link } from "react-router-dom";

interface ChartArtist {
  slug: string;
  name: string;
  imageUrl?: string;
  genres: string[];
  trackCount: number;
  releaseCount: number;
  monthlyStreams: number;
  topChartPosition: number;
}

interface ChartListProps {
  artists: ChartArtist[];
}

export function ChartList({ artists }: ChartListProps) {
  const sorted = [...artists].sort((a, b) => a.topChartPosition - b.topChartPosition).slice(0, 8);
  if (sorted.length === 0) return null;

  return (
    <section className="bg-[var(--wk-surface)]">
      <div className="wk-container px-6 py-14 md:py-20">
        <div className="mb-8">
          <div className="wk-eyebrow mb-3">The charts</div>
          <h3 className="text-[clamp(28px,3.5vw,48px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
            Who runs the numbers
          </h3>
        </div>

        <div className="divide-y divide-[var(--wk-border)] border-y border-[var(--wk-border)]">
          {sorted.map((artist, index) => (
            <Link
              key={artist.slug}
              to={`/artists/${artist.slug}`}
              className="group flex items-center gap-4 px-4 py-4 transition-all hover:bg-[var(--wk-bg)] md:gap-6 md:px-6 md:py-5"
            >
              {/* Rank number */}
              <div className="w-10 shrink-0 text-right md:w-12">
                <span className="text-[28px] font-black leading-none tracking-[-0.04em] text-[var(--wk-text-faint)] md:text-[36px]">
                  {index + 1}
                </span>
              </div>

              {/* Image */}
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)] md:h-16 md:w-16">
                {artist.imageUrl ? (
                  <img
                    src={artist.imageUrl}
                    alt={artist.name}
                    className="h-full w-full object-cover object-top"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <i className="ri-user-3-line text-xl text-[var(--wk-text-faint)]" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <h4 className="text-[15px] font-bold text-[var(--wk-text)] md:text-[16px]">{artist.name}</h4>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-[var(--wk-text-muted)]">
                  <span>{artist.trackCount} tracks</span>
                  <span>·</span>
                  <span>{artist.releaseCount} releases</span>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">{artist.monthlyStreams}M streams</span>
                </div>
              </div>

              {/* Genres */}
              <div className="hidden shrink-0 flex-wrap items-center gap-1 sm:flex">
                {artist.genres.slice(0, 2).map((g) => (
                  <span
                    key={g}
                    className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-text-soft)]"
                  >
                    {g}
                  </span>
                ))}
              </div>

              {/* Peak */}
              <div className="hidden shrink-0 text-right md:block">
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-brand-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--wk-brand)]">
                  <i className="ri-bar-chart-line text-[10px]" />
                  #{artist.topChartPosition}
                </span>
              </div>

              {/* Arrow */}
              <div className="shrink-0">
                <i className="ri-arrow-right-line text-[var(--wk-text-faint)] transition-colors group-hover:text-[var(--wk-brand)]" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}