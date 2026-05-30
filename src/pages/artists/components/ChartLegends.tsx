import { Link } from "react-router-dom";
import { WkTag } from "@/components/design-system/primitives/Tag";

export interface LegendArtist {
  slug: string;
  name: string;
  imageUrl?: string;
  genres: string[];
  trackCount: number;
  releaseCount: number;
  topChartPosition: number;
  monthlyStreams: number;
}

interface ChartLegendsProps {
  artists: LegendArtist[];
}

export function ChartLegends({ artists }: ChartLegendsProps) {
  // Sort by chart position (best first)
  const sorted = [...artists].sort((a, b) => a.topChartPosition - b.topChartPosition);

  return (
    <section className="wk-container px-6 py-14 md:py-20">
      <div className="mb-8">
        <div className="wk-eyebrow mb-3">Chart leaders</div>
        <h3 className="wk-h-section">The ones who run the charts</h3>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((artist, index) => (
          <Link
            key={artist.slug}
            to={`/artists/${artist.slug}`}
            className="group relative overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all hover:border-[var(--wk-border-2)]"
          >
            {/* Rank badge */}
            <div className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[13px] font-black text-[var(--wk-brand-on)]">
              {index + 1}
            </div>

            <div className="relative aspect-[16/10] bg-[var(--wk-surface-raised)]">
              {artist.imageUrl ? (
                <img
                  src={artist.imageUrl}
                  alt={artist.name}
                  className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-standard)] group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <i className="ri-user-3-line text-4xl text-[var(--wk-text-faint)]" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            </div>

            <div className="p-4">
              <div className="mb-1 flex items-center justify-between">
                <h4 className="text-[15px] font-bold text-[var(--wk-text)]">{artist.name}</h4>
                <span className="text-[11px] font-bold text-[var(--wk-brand)]">
                  Peak #{artist.topChartPosition}
                </span>
              </div>
              <div className="mb-3 flex items-center gap-2 text-[12px]" style={{ color: "var(--wk-text-muted)" }}>
                <span>{artist.trackCount} tracks</span>
                <span style={{ color: "var(--wk-text-faint)" }}>·</span>
                <span>{artist.releaseCount} releases</span>
                <span style={{ color: "var(--wk-text-faint)" }}>·</span>
                <span>{artist.monthlyStreams}M streams</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {artist.genres.slice(0, 3).map((g) => (
                  <WkTag key={g}>{g}</WkTag>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}