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
          {podium.map((artist) => {
            return (
              <Link
                key={artist.slug}
                to={`/artists/${artist.slug}`}
                className="group relative flex min-h-[340px] flex-col overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all duration-[var(--wk-d-standard)] hover:-translate-y-2 hover:border-[var(--wk-brand)]/35"
              >
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
                  <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1.5 text-white backdrop-blur-md">
                    <i className="ri-bar-chart-line text-[11px]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.08em]">
                      Peak #{artist.topChartPosition}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    <h4 className="text-[18px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)] md:text-[20px]">
                      {artist.name}
                    </h4>
                    {(artist.trackCount > 0 || artist.releaseCount > 0) && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--wk-text-muted)]">
                        {artist.trackCount > 0 && (
                          <span>
                            {artist.trackCount} {artist.trackCount === 1 ? "track" : "tracks"}
                          </span>
                        )}
                        {artist.trackCount > 0 && artist.releaseCount > 0 && (
                          <span className="opacity-40">·</span>
                        )}
                        {artist.releaseCount > 0 && (
                          <span>
                            {artist.releaseCount} {artist.releaseCount === 1 ? "release" : "releases"}
                          </span>
                        )}
                      </div>
                    )}
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
            {rest.map((artist) => (
              <Link
                key={artist.slug}
                to={`/artists/${artist.slug}`}
                className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--wk-bg-subtle)] md:gap-6 md:px-6 md:py-5 border-b border-[var(--wk-divider)] last:border-b-0"
              >
                <div className="w-12 shrink-0 text-center">
                  <span className="block font-black text-[20px] leading-none tracking-[-0.04em] text-[var(--wk-text)] md:text-[22px]">
                    #{artist.topChartPosition}
                  </span>
                  <span className="mt-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">
                    Peak
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
                  {(artist.trackCount > 0 || artist.releaseCount > 0) && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[var(--wk-text-muted)]">
                      {artist.trackCount > 0 && (
                        <span>
                          {artist.trackCount} {artist.trackCount === 1 ? "track" : "tracks"}
                        </span>
                      )}
                      {artist.trackCount > 0 && artist.releaseCount > 0 && (
                        <span className="opacity-40">·</span>
                      )}
                      {artist.releaseCount > 0 && (
                        <span>
                          {artist.releaseCount} {artist.releaseCount === 1 ? "release" : "releases"}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Genres — desktop */}
                <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
                  {artist.genres.slice(0, 2).map((g) => (
                    <span key={g} className="rounded-full border border-[var(--wk-border-2)] bg-[var(--wk-bg-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--wk-text-soft)]">
                      {g}
                    </span>
                  ))}
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