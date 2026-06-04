import { useRef } from "react";
import { Link } from "react-router-dom";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";

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
  spotlightBio: string;
}

interface RisingStarsProps {
  artists: RisingArtist[];
}

export function RisingStars({ artists }: RisingStarsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  if (artists.length === 0) return null;

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -340 : 340, behavior: "smooth" });
  };

  return (
    <section className="px-4 py-14 md:px-6 md:py-20">
      <div className="wk-container-wide">
        <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="wk-eyebrow mb-3">Rising voices</div>
            <h3 className="wk-h-page">The next wave</h3>
          </div>
          <div className="flex items-center gap-3">
            <p className="wk-copy hidden max-w-[40ch] text-[13px] md:block">
              Emerging artists making their mark with trajectories pointing straight up.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => scroll("left")}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--wk-border-2)] bg-[var(--wk-surface)] text-[var(--wk-text-soft)] transition-all hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]"
              >
                <i className="ri-arrow-left-s-line text-lg" />
              </button>
              <button
                onClick={() => scroll("right")}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--wk-border-2)] bg-[var(--wk-surface)] text-[var(--wk-text-soft)] transition-all hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]"
              >
                <i className="ri-arrow-right-s-line text-lg" />
              </button>
            </div>
          </div>
        </div>

        {/* Filmstrip scroll */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none", scrollSnapType: "x mandatory" }}
        >
          {artists.map((artist) => (
            <Link
              key={artist.slug}
              to={`/artists/${artist.slug}`}
              className="group relative shrink-0 overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all duration-[var(--wk-d-standard)] hover:-translate-y-2 hover:border-[var(--wk-border-2)]"
              style={{ width: "240px", aspectRatio: "3/4", scrollSnapAlign: "start" }}
            >
              {/* Image */}
              <div className="absolute inset-0 bg-[var(--wk-surface-raised)]">
                {artist.imageUrl ? (
                  <img
                    src={artist.imageUrl}
                    alt={artist.name}
                    className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-slow)] group-hover:scale-105"
                  />
                ) : (
                  <Ch19GradientImage slug={artist.slug} name={artist.name} />
                )}
              </div>

              {/* Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />

              {/* Rising badge */}
              <div className="absolute left-4 top-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wk-brand)] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--wk-brand-on)]">
                  <i className="ri-fire-line text-[10px]" />
                  Rising
                </span>
              </div>

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <h4 className="text-[17px] font-extrabold leading-tight text-white md:text-[18px]">
                  {artist.name}
                </h4>
                <p className="mt-1.5 line-clamp-2 text-[12px] leading-[1.5] text-white/50">
                  {artist.spotlightBio}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/40">
                  <span>{artist.country}</span>
                  <span>·</span>
                  <span>{artist.monthlyStreams}M</span>
                  <span>·</span>
                  <span>Since {artist.debutYear}</span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {artist.genres.slice(0, 2).map((g) => (
                    <span key={g} className="rounded-full border border-white/15 bg-white/8 px-2.5 py-1 text-[10px] font-semibold text-white/70 backdrop-blur-sm">
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}