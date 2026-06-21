import { useRef } from "react";
import { Link } from "react-router-dom";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";

interface RelatedArtist {
  slug: string;
  name: string;
  imageUrl?: string;
  score?: number;
  sharedTracksAll?: number;
  sharedChartTracks?: number;
  featuresThem?: number;
  theyFeature?: number;
  sharedTitles?: string[];
}

interface RelatedArtistsShelfProps {
  artists: RelatedArtist[];
}

function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 100) return { label: "Strong", color: "bg-emerald-500" };
  if (score >= 10) return { label: "Medium", color: "bg-amber-500" };
  return { label: "Light", color: "bg-zinc-400" };
}

export function RelatedArtistsShelf({ artists }: RelatedArtistsShelfProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { ref, revealed } = useScrollReveal<HTMLElement>(0.1);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" });
  };

  const hasRichData = artists.some(
    (a) =>
      (a.score && a.score > 0) ||
      (a.sharedTracksAll && a.sharedTracksAll > 0) ||
      a.featuresThem ||
      a.theyFeature
  );

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
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)] cursor-pointer"
          >
            <i className="ri-arrow-left-line text-sm" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)] cursor-pointer"
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
        {artists.map((artist) => {
          const sc = scoreLabel(artist.score || 0);
          const sharedTitles = artist.sharedTitles || [];

          return (
            <Link
              key={artist.slug}
              to={`/artists/${artist.slug}`}
              className="group block shrink-0 overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all hover:border-[var(--wk-brand)]"
              style={{ width: "200px" }}
            >
              <div className="relative aspect-[3/4] bg-[var(--wk-surface-raised)] overflow-hidden">
                {artist.imageUrl ? (
                  <img
                    src={artist.imageUrl}
                    alt={artist.name}
                    loading="lazy"
                    className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-slow)] group-hover:scale-105"
                  />
                ) : (
                  <Ch19GradientImage slug={artist.slug} name={artist.name} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                {/* Score badge */}
                {artist.score && artist.score > 0 && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${sc.color}`} />
                    <span className="text-[11px] font-semibold text-white/90">{sc.label}</span>
                  </div>
                )}

                {/* Feature badges */}
                <div className="absolute top-3 left-3 flex flex-col gap-1">
                  {artist.featuresThem ? (
                    <span className="rounded-full bg-emerald-500/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-white">
                      Features
                    </span>
                  ) : null}
                  {artist.theyFeature ? (
                    <span className="rounded-full bg-sky-500/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-white">
                      Featured by
                    </span>
                  ) : null}
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h4 className="text-[15px] font-bold text-white leading-[1.2]">{artist.name}</h4>

                  {/* Shared tracks info */}
                  {hasRichData && artist.sharedTracksAll && artist.sharedTracksAll > 0 && (
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-white/70">
                      <span className="flex items-center gap-1">
                        <i className="ri-music-line text-[10px]" />
                        {artist.sharedTracksAll} shared
                      </span>
                      {artist.sharedChartTracks && artist.sharedChartTracks > 0 ? (
                        <span className="flex items-center gap-1 text-amber-400/90">
                          <i className="ri-bar-chart-line text-[10px]" />
                          {artist.sharedChartTracks} chart
                        </span>
                      ) : null}
                    </div>
                  )}

                  {/* Shared track titles */}
                  {sharedTitles.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      {sharedTitles.slice(0, 3).map((title, i) => (
                        <span
                          key={i}
                          className="truncate max-w-[160px] rounded-full bg-white/15 px-2 py-0.5 text-[10px] text-white/80"
                        >
                          {title}
                        </span>
                      ))}
                      {sharedTitles.length > 3 && (
                        <span className="text-[10px] text-white/50">+{sharedTitles.length - 3} more</span>
                      )}
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-1 text-[11px] text-white/60 font-semibold opacity-0 transition-opacity group-hover:opacity-100">
                    <span>View artist</span>
                    <i className="ri-arrow-right-line text-[10px]" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}