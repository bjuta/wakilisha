import { useRef } from "react";
import { Link } from "react-router-dom";

interface ShelfArtist {
  slug: string;
  name: string;
  imageUrl?: string;
  trackCount: number;
  releaseCount: number;
}

interface GenreShelf {
  genre: string;
  artists: ShelfArtist[];
}

interface GenreRowsProps {
  shelves: GenreShelf[];
}

function GenreShelfRow({ genre, artists }: GenreShelf) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" });
  };

  return (
    <div className="mb-10 last:mb-0">
      {/* Header */}
      <div className="mb-4 flex items-end justify-between">
        <div className="flex items-baseline gap-3">
          <h4 className="text-[22px] font-bold text-[var(--wk-text)] md:text-[26px]">{genre}</h4>
          <span className="text-[13px] font-semibold text-[var(--wk-text-muted)]">
            {artists.length} artist{artists.length !== 1 ? "s" : ""}
          </span>
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

      {/* Scrollable row */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {artists.map((artist) => (
          <Link
            key={artist.slug}
            to={`/artists/${artist.slug}`}
            className="group relative block shrink-0 overflow-hidden rounded-xl border border-[var(--wk-border)] transition-all hover:border-[var(--wk-border-2)]"
            style={{ width: "200px", aspectRatio: "3/4" }}
          >
            <div className="absolute inset-0 bg-[var(--wk-surface-raised)]"
            >
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
              <h5 className="text-[14px] font-bold text-white">{artist.name}</h5>
              <div className="mt-0.5 text-[11px] text-white/60">
                {artist.trackCount} tracks · {artist.releaseCount} releases
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function GenreRows({ shelves }: GenreRowsProps) {
  if (shelves.length === 0) return null;

  return (
    <section className="wk-container px-6 py-14 md:py-20">
      <div className="mb-10">
        <div className="wk-eyebrow mb-3">Explore by sound</div>
        <h3 className="text-[clamp(28px,3.5vw,48px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
          Find your frequency
        </h3>
      </div>
      {shelves.map((shelf) => (
        <GenreShelfRow key={shelf.genre} genre={shelf.genre} artists={shelf.artists} />
      ))}
    </section>
  );
}