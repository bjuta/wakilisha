import { useRef } from "react";
import { Link } from "react-router-dom";

interface DiscoRelease {
  slug: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  releaseType?: string;
  year?: string | number;
  trackCount?: number;
}

interface ArtistDiscographyProps {
  releases: DiscoRelease[];
}

export function ArtistDiscography({ releases }: ArtistDiscographyProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" });
  };

  return (
    <section className="py-10 md:py-14">
      <div className="wk-container px-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="wk-eyebrow mb-2">Discography</div>
            <h3 className="text-[clamp(24px,3vw,40px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
              Releases
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
        {releases.map((release) => (
          <Link
            key={release.slug}
            to={`/releases/${release.slug}`}
            className="group block shrink-0 overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all hover:border-[var(--wk-border-2)]"
            style={{ width: "200px" }}
          >
            <div className="relative aspect-square bg-[var(--wk-surface-raised)]">
              {release.artworkUrl ? (
                <img
                  src={release.artworkUrl}
                  alt={release.title}
                  className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <i className="ri-album-line text-4xl text-[var(--wk-text-faint)]" />
                </div>
              )}
            </div>
            <div className="p-3">
              <h4 className="truncate text-[14px] font-bold text-[var(--wk-text)]">{release.title}</h4>
              <div className="mt-1 flex items-center gap-2 text-[12px] text-[var(--wk-text-muted)]">
                {release.releaseType && (
                  <span className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-text-soft)]">
                    {release.releaseType}
                  </span>
                )}
                {release.year && <span>{release.year}</span>}
                {release.trackCount !== undefined && (
                  <span>· {release.trackCount} tracks</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}