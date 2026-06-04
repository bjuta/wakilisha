import { useRef } from "react";
import { Link } from "react-router-dom";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";

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
  const { ref, revealed } = useScrollReveal<HTMLElement>(0.1);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" });
  };

  return (
    <section ref={ref} className={`${revealed ? "is-visible" : ""} reveal-up`}>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="wk-eyebrow mb-2">Connections</div>
          <h2 className="text-[clamp(26px,3vw,40px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
            Related Artists
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll("left")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
          >
            <i className="ri-arrow-left-line text-sm" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
          >
            <i className="ri-arrow-right-line text-sm" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {artists.map((artist) => (
          <Link
            key={artist.slug}
            to={`/artists/${artist.slug}`}
            className="group block shrink-0 overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all hover:border-[var(--wk-brand)]"
            style={{ width: "180px" }}
          >
            <div className="relative aspect-[3/4] bg-[var(--wk-surface-raised)] overflow-hidden">
              {artist.imageUrl ? (
                <img
                  src={artist.imageUrl}
                  alt={artist.name}
                  className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <Ch19GradientImage slug={artist.slug} name={artist.name} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h4 className="text-[15px] font-bold text-white leading-[1.2]">{artist.name}</h4>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-white/60 font-semibold opacity-0 transition-opacity group-hover:opacity-100">
                  <span>View artist</span>
                  <i className="ri-arrow-right-line text-[10px]" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}