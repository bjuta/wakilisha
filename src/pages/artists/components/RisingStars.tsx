import { Link } from "react-router-dom";

interface RisingArtist {
  slug: string;
  name: string;
  imageUrl?: string;
  genres: string[];
  trackCount: number;
  releaseCount: number;
  country: string;
  debutYear: number;
  monthlyStreams: number;
}

interface RisingStarsProps {
  artists: RisingArtist[];
}

export function RisingStars({ artists }: RisingStarsProps) {
  if (artists.length === 0) return null;

  return (
    <section className="bg-[var(--wk-surface)]">
      <div className="wk-container px-6 py-14 md:py-20">
        <div className="mb-8">
          <div className="wk-eyebrow mb-3">Fresh voices</div>
          <h3 className="text-[clamp(28px,3.5vw,48px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
            On the rise
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {artists.map((artist) => (
            <Link
              key={artist.slug}
              to={`/artists/${artist.slug}`}
              className="group relative block overflow-hidden rounded-xl border border-[var(--wk-border)] transition-all hover:border-[var(--wk-border-2)]"
              style={{ aspectRatio: "3/4" }}
            >
              {/* Image */}
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

              {/* Fire badge */}
              <div className="absolute right-3 top-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-brand-2)] px-2.5 py-1 text-[10px] font-bold text-[var(--wk-brand-2-on)] uppercase tracking-wider">
                  <i className="ri-fire-line text-[9px]" />
                  Rising
                </span>
              </div>

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h4 className="text-[16px] font-bold leading-tight text-white">{artist.name}</h4>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/60">
                  <span>{artist.country}</span>
                  <span>·</span>
                  <span>{artist.monthlyStreams}M streams</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {artist.genres.slice(0, 2).map((g) => (
                    <span
                      key={g}
                      className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/80 backdrop-blur-sm"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>

              {/* Hover arrow */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/30">
                <div className="flex h-11 w-11 translate-y-4 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                  <i className="ri-arrow-right-line text-lg" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}