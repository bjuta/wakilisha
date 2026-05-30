import { Link } from "react-router-dom";
import { WkTag } from "@/components/design-system/primitives/Tag";

export interface RisingArtist {
  slug: string;
  name: string;
  imageUrl?: string;
  genres: string[];
  trackCount: number;
  releaseCount: number;
  country: string;
  debutYear: number;
  monthlyStreams: number;
  spotlightBio: string;
}

interface RisingArtistsProps {
  artists: RisingArtist[];
}

export function RisingArtists({ artists }: RisingArtistsProps) {
  return (
    <section className="wk-container px-6 py-14 md:py-20">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <div className="wk-eyebrow mb-3">On the rise</div>
          <h3 className="wk-h-section">Emerging voices</h3>
        </div>
        <div className="hidden text-[13px] md:block" style={{ color: "var(--wk-text-muted)" }}>
          {artists.length} artists gaining momentum
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {artists.map((artist) => (
          <Link
            key={artist.slug}
            to={`/artists/${artist.slug}`}
            className="group flex gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 transition-all hover:border-[var(--wk-border-2)]"
          >
            <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
              {artist.imageUrl ? (
                <img
                  src={artist.imageUrl}
                  alt={artist.name}
                  className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-standard)] group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <i className="ri-user-3-line text-2xl text-[var(--wk-text-faint)]" />
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-col justify-center">
              <h4 className="mb-0.5 truncate text-[14px] font-bold text-[var(--wk-text)]">{artist.name}</h4>
              <p className="mb-2 line-clamp-2 text-[12px] leading-[1.5]" style={{ color: "var(--wk-text-muted)" }}>
                {artist.spotlightBio}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {artist.genres.slice(0, 2).map((g) => (
                  <WkTag key={g}>{g}</WkTag>
                ))}
                <span className="text-[11px]" style={{ color: "var(--wk-text-faint)" }}>
                  {artist.monthlyStreams}M streams
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}