import { useRef } from "react";
import { Link } from "react-router-dom";

interface RelatedArtist {
  slug: string;
  name: string;
  imageUrl?: string;
}

interface RelatedArtistsShelfProps {
  artists: RelatedArtist[];
}

export function RelatedArtistsShelf({ artists }: RelatedArtistsShelfProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  return (
    <section className="bg-[var(--wk-surface)] py-10 md:py-14">
      <div className="wk-container px-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="wk-eyebrow mb-2">Connections</div>
            <h3 className="text-[clamp(24px,3vw,40px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
              Related artists
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
        className="flex gap-4 overflow-x-auto px-6 pb-3 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {artists.map((artist) => (
          <Link
            key={artist.slug}
            to={`/artists/${artist.slug}`}
            className="group block shrink-0 overflow-hidden rounded-xl border border-[var(--wk-border)] relative transition-all hover:border-[var(--wk-border-2)]"
            style={{ width: "160px", aspectRatio: "3/4" }}
          >
            <div className="absolute inset-0 bg-[var(--wk-surface-raised)]">
              {artist.imageUrl ? (
                <img
                  src={artist.imageUrl}
                  alt={artist.name}
                  className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <i className="ri-user-3-line text-3xl text-[var(--wk-text-faint)]" />
                </div>
              )}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <h4 className="text-[14px] font-bold text-white">{artist.name}</h4>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}