import { useRef } from "react";
import { Link } from "react-router-dom";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";

export interface ArtistConnection {
  slug: string;
  name: string;
  imageUrl?: string;
  score?: number;
  sharedTracksAll?: number;
  sharedChartTracks?: number;
  featuresThem?: number;
  theyFeature?: number;
  sharedTitles?: string[];
  reviewed?: boolean;
  reviewedReason?: string;
  evidenceCount?: number;
  relationshipLabel?: string;
}

interface RelatedArtistsShelfProps {
  artists: ArtistConnection[];
}

function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 100) return { label: "Strong", color: "bg-emerald-500" };
  if (score >= 10) return { label: "Medium", color: "bg-amber-500" };
  return { label: "Light", color: "bg-zinc-400" };
}

function readableLabel(value: string) {
  return value.replace(/_/g, " ");
}

export function RelatedArtistsShelf({ artists }: RelatedArtistsShelfProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { ref, revealed } = useScrollReveal<HTMLElement>(0.1);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" });
  };

  const hasRichData = artists.some(
    (artist) =>
      artist.reviewed ||
      (artist.score && artist.score > 0) ||
      (artist.sharedTracksAll && artist.sharedTracksAll > 0) ||
      artist.featuresThem ||
      artist.theyFeature,
  );

  return (
    <section ref={ref} className={`${revealed ? "is-visible" : ""} reveal-up`}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="wk-eyebrow mb-2">Connected Through The Music</div>
          <h2 className="text-[clamp(26px,3vw,40px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
            Artist Connections
          </h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[var(--wk-text-muted)]">
            Shared music credits and reviewed connections, brought together without repeats.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll("left")}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
            aria-label="Previous artist connections"
          >
            <i className="ri-arrow-left-line text-sm" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
            aria-label="Next artist connections"
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
          const score = scoreLabel(artist.score || 0);
          const sharedTitles = artist.sharedTitles || [];
          const relationshipLabel = artist.relationshipLabel
            ? readableLabel(artist.relationshipLabel)
            : null;

          return (
            <Link
              key={artist.slug}
              to={`/artists/${artist.slug}`}
              className="group block shrink-0 overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all hover:border-[var(--wk-brand)]"
              style={{ width: "220px" }}
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-[var(--wk-surface-raised)]">
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />

                {artist.reviewed ? (
                  <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 backdrop-blur-sm">
                    <i className="ri-shield-check-line text-[11px] text-emerald-300" />
                    <span className="text-[11px] font-semibold text-white/90">Reviewed</span>
                  </div>
                ) : artist.score && artist.score > 0 ? (
                  <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-sm">
                    <span className={`h-1.5 w-1.5 rounded-full ${score.color}`} />
                    <span className="text-[11px] font-semibold text-white/90">{score.label}</span>
                  </div>
                ) : null}

                <div className="absolute left-3 top-3 flex flex-col gap-1">
                  {relationshipLabel ? (
                    <span className="rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold capitalize text-white backdrop-blur-sm">
                      {relationshipLabel}
                    </span>
                  ) : (
                    <>
                      {artist.featuresThem ? (
                        <span className="rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                          Features
                        </span>
                      ) : null}
                      {artist.theyFeature ? (
                        <span className="rounded-full bg-sky-500/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                          Featured By
                        </span>
                      ) : null}
                    </>
                  )}
                </div>

                <div className="absolute inset-x-0 bottom-0 p-4">
                  <h3 className="text-[16px] font-bold leading-[1.2] text-white">{artist.name}</h3>

                  {artist.reviewedReason ? (
                    <p className="mt-2 line-clamp-3 text-[11px] leading-4 text-white/80">
                      {artist.reviewedReason}
                    </p>
                  ) : null}

                  {hasRichData && artist.sharedTracksAll && artist.sharedTracksAll > 0 ? (
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-white/75">
                      <span className="flex items-center gap-1">
                        <i className="ri-music-line text-[10px]" />
                        {artist.sharedTracksAll} {artist.sharedTracksAll === 1 ? "shared track" : "shared tracks"}
                      </span>
                      {artist.sharedChartTracks && artist.sharedChartTracks > 0 ? (
                        <span className="flex items-center gap-1 text-amber-300">
                          <i className="ri-bar-chart-line text-[10px]" />
                          {artist.sharedChartTracks} chart
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {artist.reviewed && artist.evidenceCount ? (
                    <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-white/65">
                      <i className="ri-shield-check-line" />
                      {artist.evidenceCount} {artist.evidenceCount === 1 ? "source" : "sources"} reviewed
                    </div>
                  ) : null}

                  {!artist.reviewedReason && sharedTitles.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      {sharedTitles.slice(0, 3).map((title) => (
                        <span
                          key={title}
                          className="max-w-[175px] truncate rounded-full bg-white/15 px-2 py-0.5 text-[10px] text-white/80"
                        >
                          {title}
                        </span>
                      ))}
                      {sharedTitles.length > 3 ? (
                        <span className="text-[10px] text-white/50">+{sharedTitles.length - 3} more</span>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-white/60 opacity-0 transition-opacity group-hover:opacity-100">
                    <span>View Artist</span>
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
