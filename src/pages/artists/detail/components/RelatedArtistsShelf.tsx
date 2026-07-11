import { useRef, useState } from "react";
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

function readableLabel(value: string) {
  return value.replace(/_/g, " ");
}

export function RelatedArtistsShelf({ artists }: RelatedArtistsShelfProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { ref, revealed } = useScrollReveal<HTMLElement>(0.1);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" });
  };

  return (
    <section ref={ref} className={`${revealed ? "is-visible" : ""} reveal-up`}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="wk-eyebrow mb-2">Connected Through The Music</div>
          <h2 className="text-[clamp(26px,3vw,40px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">Artist Connections</h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[var(--wk-text-muted)]">Shared tracks, features, and reviewed connections.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => scroll("left")} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]" aria-label="Previous artist connections">
            <i className="ri-arrow-left-line text-sm" />
          </button>
          <button onClick={() => scroll("right")} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]" aria-label="Next artist connections">
            <i className="ri-arrow-right-line text-sm" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {artists.map((artist) => {
          const sharedTitles = artist.sharedTitles || [];
          const relationshipLabel = artist.relationshipLabel ? readableLabel(artist.relationshipLabel) : null;
          const isOpen = openSlug === artist.slug;
          const hasRevealContent = Boolean(artist.reviewedReason || artist.evidenceCount || sharedTitles.length);
          const toggle = () => setOpenSlug((current) => current === artist.slug ? null : artist.slug);

          return (
            <article
              key={artist.slug}
              className="group relative block shrink-0 overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all hover:border-[var(--wk-brand)] focus-within:border-[var(--wk-brand)]"
              style={{ width: "220px" }}
              onMouseLeave={() => setOpenSlug((current) => current === artist.slug ? null : current)}
            >
              <div
                role="button"
                tabIndex={0}
                className="block w-full cursor-pointer text-left"
                aria-expanded={isOpen}
                aria-label={`${isOpen ? "Hide" : "Show"} details for ${artist.name}`}
                onClick={toggle}
                onFocus={() => setOpenSlug(artist.slug)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    toggle();
                  }
                }}
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-[var(--wk-surface-raised)]">
                  {artist.imageUrl ? (
                    <img src={artist.imageUrl} alt={artist.name} loading="lazy" className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-slow)] group-hover:scale-105" />
                  ) : (
                    <Ch19GradientImage slug={artist.slug} name={artist.name} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />

                  {artist.reviewed ? (
                    <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 backdrop-blur-sm">
                      <i className="ri-shield-check-line text-[11px] text-emerald-300" />
                      <span className="text-[11px] font-semibold text-white/90">Reviewed</span>
                    </div>
                  ) : null}

                  <div className="absolute left-3 top-3 flex flex-col gap-1">
                    {relationshipLabel ? (
                      <span className="rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold capitalize text-white backdrop-blur-sm">{relationshipLabel}</span>
                    ) : (
                      <>
                        {artist.featuresThem ? <span className="rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">Features</span> : null}
                        {artist.theyFeature ? <span className="rounded-full bg-sky-500/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">Featured By</span> : null}
                      </>
                    )}
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <h3 className="text-[16px] font-bold leading-[1.2] text-white">{artist.name}</h3>
                    {artist.sharedTracksAll && artist.sharedTracksAll > 0 ? (
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-white/75">
                        <span className="flex items-center gap-1"><i className="ri-music-line text-[10px]" />{artist.sharedTracksAll} {artist.sharedTracksAll === 1 ? "shared track" : "shared tracks"}</span>
                        {artist.sharedChartTracks && artist.sharedChartTracks > 0 ? <span className="flex items-center gap-1 text-amber-300"><i className="ri-bar-chart-line text-[10px]" />{artist.sharedChartTracks} chart</span> : null}
                      </div>
                    ) : null}
                    {hasRevealContent ? (
                      <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-white/60 md:hidden">
                        <span>{isOpen ? "Hide Details" : "Tap For Details"}</span>
                        <i className={isOpen ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} />
                      </div>
                    ) : null}
                  </div>

                  <div className={`absolute inset-0 flex flex-col justify-end bg-black/80 p-4 backdrop-blur-[2px] transition-all duration-200 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100 ${isOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0 md:pointer-events-auto"}`}>
                    <p className="text-[16px] font-bold text-white">{artist.name}</p>
                    {artist.reviewedReason ? <p className="mt-3 text-[12px] leading-5 text-white/85">{artist.reviewedReason}</p> : null}
                    {!artist.reviewedReason && sharedTitles.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {sharedTitles.slice(0, 3).map((title) => <span key={title} className="max-w-[175px] truncate rounded-full bg-white/15 px-2 py-0.5 text-[10px] text-white/85">{title}</span>)}
                      </div>
                    ) : null}
                    {artist.reviewed && artist.evidenceCount ? (
                      <div className="mt-3 flex items-center gap-1 text-[10px] font-semibold text-white/70"><i className="ri-shield-check-line" />{artist.evidenceCount} {artist.evidenceCount === 1 ? "source" : "sources"} reviewed</div>
                    ) : null}
                    <Link to={`/artists/${artist.slug}`} className="mt-4 inline-flex items-center gap-1 text-[12px] font-bold text-white" onClick={(event) => event.stopPropagation()}>
                      <span>View Artist</span><i className="ri-arrow-right-line text-[11px]" />
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
