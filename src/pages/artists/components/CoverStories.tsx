import { Link } from "react-router-dom";

interface CoverArtist {
  slug: string;
  name: string;
  imageUrl?: string;
  genres: string[];
  monthlyStreams: number;
  topChartPosition: number;
  spotlightBio: string;
}

interface CoverStoriesProps {
  artists: CoverArtist[];
}

export function CoverStories({ artists }: CoverStoriesProps) {
  const featured = artists.slice(0, 4);
  if (featured.length === 0) return null;

  return (
    <section className="wk-container px-6 py-14 md:py-20">
      <div className="mb-8">
        <div className="wk-eyebrow mb-3">Cover stories</div>
        <h3 className="text-[clamp(28px,3.5vw,48px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
          The artists defining the moment
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {featured.map((artist, index) => (
          <Link
            key={artist.slug}
            to={`/artists/${artist.slug}`}
            className="group relative block overflow-hidden rounded-xl border border-[var(--wk-border)] transition-all hover:border-[var(--wk-border-2)]"
            style={{ aspectRatio: index === 0 ? "16/10" : "16/9" }}
          >
            {/* Background image */}
            <div className="absolute inset-0 bg-[var(--wk-surface-raised)]">
              {artist.imageUrl ? (
                <img
                  src={artist.imageUrl}
                  alt={artist.name}
                  className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <i className="ri-user-3-line text-4xl text-[var(--wk-text-faint)]" />
                </div>
              )}
            </div>

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

            {/* Rank badge */}
            <div className="absolute left-4 top-4">
              <span className="text-[48px] font-black leading-none tracking-[-0.04em] text-white/20">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>

            {/* Peak position */}
            <div className="absolute right-4 top-4">
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-brand)] px-2.5 py-1 text-[10px] font-bold text-[var(--wk-brand-on)] uppercase tracking-wider">
                <i className="ri-bar-chart-line text-[10px]" />
                Peak #{artist.topChartPosition}
              </span>
            </div>

            {/* Content at bottom */}
            <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
              <h4 className="mb-1 text-[20px] font-bold leading-tight text-white md:text-[24px]">
                {artist.name}
              </h4>
              <p className="mb-3 line-clamp-2 text-[13px] leading-[1.5] text-white/60">
                {artist.spotlightBio}
              </p>
              <div className="flex items-center gap-3 text-[12px] text-white/50">
                <span>{artist.monthlyStreams}M streams</span>
                <span>·</span>
                <div className="flex gap-1">
                  {artist.genres.slice(0, 2).map((g) => (
                    <span key={g} className="text-white/70">
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}