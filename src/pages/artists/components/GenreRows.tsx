import { useRef } from "react";
import { Link } from "react-router-dom";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";

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
  onGenreSelect?: (genre: string) => void;
}

const GENRE_COLORS: Record<string, string> = {
  Afrobeats: "rgba(132,194,65,0.06)",
  Amapiano: "rgba(168,72,60,0.06)",
  "Bongo Flava": "rgba(45,107,181,0.06)",
  Gengetone: "rgba(160,104,0,0.06)",
  "R&B": "rgba(158,56,121,0.06)",
  "Hip-hop": "rgba(100,82,199,0.06)",
  "Afro-soul": "rgba(132,194,65,0.05)",
  "Afro-pop": "rgba(132,194,65,0.05)",
};

function getGenreColor(genre: string): string {
  for (const [key, color] of Object.entries(GENRE_COLORS)) {
    if (genre.includes(key) || key.includes(genre)) return color;
  }
  return "rgba(132,194,65,0.04)";
}

function GenreShelfRow({ genre, artists, index, onGenreSelect }: GenreShelf & { index: number; onGenreSelect?: (genre: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -360 : 360, behavior: "smooth" });
  };

  const bgColor = getGenreColor(genre);

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl last:mb-0" style={{ background: bgColor }}>
      {/* Header */}
      <div className="flex items-end justify-between px-5 pt-5 md:px-6 md:pt-6">
        <div className="flex items-baseline gap-3">
          <h4 className="text-[22px] font-black tracking-[-0.025em] text-[var(--wk-text)] md:text-[28px]">
            {genre}
          </h4>
          <span className="text-[13px] font-semibold text-[var(--wk-text-muted)]">
            {artists.length} artists
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onGenreSelect && (
            <button
              type="button"
              onClick={() => onGenreSelect(genre)}
              className="hidden rounded-full border border-[var(--wk-border-2)] bg-[var(--wk-surface)] px-3.5 py-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--wk-text-muted)] transition-all hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] md:inline-flex md:items-center md:gap-1.5"
            >
              Browse sound
              <i className="ri-arrow-down-line text-[12px]" />
            </button>
          )}
          <button
            type="button"
            aria-label={`Scroll ${genre} artists left`}
            onClick={() => scroll("left")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--wk-border-2)] bg-[var(--wk-surface)] text-[var(--wk-text-soft)] transition-all hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]"
          >
            <i className="ri-arrow-left-s-line text-base" />
          </button>
          <button
            type="button"
            aria-label={`Scroll ${genre} artists right`}
            onClick={() => scroll("right")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--wk-border-2)] bg-[var(--wk-surface)] text-[var(--wk-text-soft)] transition-all hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]"
          >
            <i className="ri-arrow-right-s-line text-base" />
          </button>
        </div>
      </div>

      {/* Scrollable row */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto px-5 pb-5 pt-4 scrollbar-hide md:px-6 md:pb-6 md:pt-5"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", scrollSnapType: "x mandatory" }}
      >
        {artists.map((artist) => (
          <Link
            key={artist.slug}
            to={`/artists/${artist.slug}`}
            className="group relative shrink-0 overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all duration-[var(--wk-d-standard)] hover:-translate-y-1.5 hover:border-[var(--wk-border-2)] hover:shadow-lg"
            style={{ width: "200px", aspectRatio: "3/4", scrollSnapAlign: "start" }}
          >
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h5 className="text-[14px] font-extrabold leading-tight text-white md:text-[15px]">
                {artist.name}
              </h5>
              {(artist.trackCount > 0 || artist.releaseCount > 0) && (
                <div className="mt-1 flex items-center gap-x-2 text-[11px] text-white/50">
                  {artist.trackCount > 0 && <span>{artist.trackCount} tracks</span>}
                  {artist.trackCount > 0 && artist.releaseCount > 0 && <span>·</span>}
                  {artist.releaseCount > 0 && <span>{artist.releaseCount} releases</span>}
                </div>
              )}
            </div>

            {/* Hover play button */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-[var(--wk-d-standard)] group-hover:bg-black/20">
              <div className="flex h-11 w-11 translate-y-3 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-0 transition-all duration-[var(--wk-d-standard)] group-hover:translate-y-0 group-hover:opacity-100">
                <i className="ri-arrow-right-line text-lg" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function GenreRows({ shelves, onGenreSelect }: GenreRowsProps) {
  if (shelves.length === 0) return null;

  return (
    <section className="px-4 py-14 md:px-6 md:py-20">
      <div className="wk-container-wide">
        <div className="mb-10">
          <div className="wk-eyebrow mb-3">Explore by sound</div>
          <h3 className="wk-h-page max-w-[16ch]">Find your frequency</h3>
        </div>
        {shelves.map((shelf, i) => (
          <GenreShelfRow key={shelf.genre} genre={shelf.genre} artists={shelf.artists} index={i} onGenreSelect={onGenreSelect} />
        ))}
      </div>
    </section>
  );
}