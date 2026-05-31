import { useRef } from "react";
import { Link } from "react-router-dom";

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
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = dir === "left" ? -360 : 360;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <section className="py-14 md:py-20">
      <div className="wk-container px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="wk-eyebrow mb-3">On the rise</div>
            <h3 className="text-[clamp(28px,3.5vw,48px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
              Emerging voices
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => scroll("left")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--wk-border)] text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
            >
              <i className="ri-arrow-left-line text-sm" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--wk-border)] text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
            >
              <i className="ri-arrow-right-line text-sm" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto px-6 pb-2 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {artists.map((artist) => (
          <Link
            key={artist.slug}
            to={`/artists/${artist.slug}`}
            className="group flex shrink-0 gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 transition-all hover:border-[var(--wk-border-2)]"
            style={{ width: "360px" }}
          >
            {/* Portrait image */}
            <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
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
              <h4 className="mb-1 text-[15px] font-bold text-[var(--wk-text)]">{artist.name}</h4>
              <p className="mb-2 line-clamp-2 text-[12px] leading-[1.5] text-[var(--wk-text-muted)]">
                {artist.spotlightBio}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {artist.genres.slice(0, 2).map((g) => (
                  <span
                    key={g}
                    className="rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)] uppercase tracking-wider"
                  >
                    {g}
                  </span>
                ))}
                <span className="text-[11px] text-[var(--wk-text-faint)]">
                  {artist.monthlyStreams}M streams
                </span>
              </div>
              <div className="mt-2 text-[11px] text-[var(--wk-text-faint)]">
                {artist.country} · Since {artist.debutYear}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}