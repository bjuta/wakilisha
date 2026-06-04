import { Link } from "react-router-dom";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";

export interface ArtistCardProps {
  slug: string;
  name: string;
  imageUrl?: string;
  genres?: string[];
  trackCount?: number;
  releaseCount?: number;
  isChartArtist?: boolean;
  country?: string;
}

export function ArtistCard({
  slug,
  name,
  imageUrl,
  genres = [],
  trackCount,
  releaseCount,
  isChartArtist,
  country,
}: ArtistCardProps) {
  return (
    <Link
      to={`/artists/${slug}`}
      className="group relative block overflow-hidden rounded-xl border border-[var(--wk-border)] transition-all hover:border-[var(--wk-border-2)]"
      style={{ aspectRatio: "3/4" }}
    >
      {/* Image fills entire card */}
      <div className="absolute inset-0 bg-[var(--wk-surface-raised)]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-standard)] group-hover:scale-105"
          />
        ) : (
          <Ch19GradientImage slug={slug} name={name} />
        )}
      </div>

      {/* Dark gradient overlay for text */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

      {/* Text overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="text-[16px] font-bold leading-tight text-white">{name}</h3>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/60">
          {country && <span>{country}</span>}
          {country && (trackCount !== undefined || releaseCount !== undefined) && <span>·</span>}
          {trackCount !== undefined && <span>{trackCount} tracks</span>}
          {trackCount !== undefined && releaseCount !== undefined && <span>·</span>}
          {releaseCount !== undefined && <span>{releaseCount} releases</span>}
        </div>
        {genres.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {genres.slice(0, 2).map((g) => (
              <span
                key={g}
                className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/80 backdrop-blur-sm"
              >
                {g}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/30">
        <div className="flex h-11 w-11 translate-y-4 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
          <i className="ri-arrow-right-line text-lg" />
        </div>
      </div>
    </Link>
  );
}