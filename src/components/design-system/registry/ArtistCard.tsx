import { Link } from "react-router-dom";
import { WkTag } from "@/components/design-system/primitives/Tag";

export interface ArtistCardProps {
  slug: string;
  name: string;
  imageUrl?: string;
  genres?: string[];
  trackCount?: number;
  releaseCount?: number;
  isChartArtist?: boolean;
}

export function ArtistCard({
  slug,
  name,
  imageUrl,
  genres = [],
  trackCount,
  releaseCount,
  isChartArtist,
}: ArtistCardProps) {
  return (
    <Link
      to={`/artists/${slug}`}
      className="group block rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden transition-all hover:border-[var(--wk-border-2)]"
    >
      <div className="relative aspect-[4/3] bg-[var(--wk-surface-raised)]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-standard)] group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <i className="ri-user-3-line text-4xl text-[var(--wk-text-faint)]" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        {isChartArtist && (
          <div className="absolute right-2 top-2">
            <WkTag variant="brand">
              <i className="ri-bar-chart-line" />
              Charts
            </WkTag>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="truncate text-[14px] font-bold text-[var(--wk-text)]">{name}</h3>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--wk-text-muted)]">
          {trackCount !== undefined && <span>{trackCount} tracks</span>}
          {trackCount !== undefined && releaseCount !== undefined && (
            <span className="text-[var(--wk-text-faint)]">·</span>
          )}
          {releaseCount !== undefined && <span>{releaseCount} releases</span>}
        </div>
        {genres.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {genres.slice(0, 2).map((g) => (
              <WkTag key={g}>{g}</WkTag>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}