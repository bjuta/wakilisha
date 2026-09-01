// ... existing imports ...
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { releaseUrl, slugify } from "@/utils/releaseUrl";
import { WkIcon } from "@/components/design-system/Icon";

interface DiscoRelease {
  slug: string;
  title: string;
  artist?: string;
  artworkUrl?: string;
  releaseType?: string;
  year?: string | number;
  trackCount?: number;
  releaseDate?: string;
  labelName?: string;
  tracks?: Array<{
    slug?: string;
    artistSlug?: string;
    title: string;
    duration: string;
    artists?: string;
    previewUrl?: string;
  }>;
}

interface ArtistDiscographyProps {
  releases: DiscoRelease[];
  eyebrow?: string;
  title?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  artistName?: string;
}

type Filter = "All" | "Albums" | "EPs" | "Singles";

function formatYear(dateStr?: string, year?: string | number): string {
  if (year) return String(year);
  if (dateStr) return dateStr.split("-")[0];
  return "";
}

function DiscographyCard({ release, artistName }: { release: DiscoRelease; artistName?: string }) {
  const displayYear = formatYear(release.releaseDate, release.year);
  const releaseArtist = release.artist || artistName || "";
  const singleTrack =
    release.trackCount === 1
      ? release.tracks?.[0]
      : undefined;
  const href = releaseUrl({
    slug: release.slug,
    artist: releaseArtist,
    trackCount: release.trackCount,
    singleTrackSlug: singleTrack?.slug,
    singleTrackArtistSlug: singleTrack?.artistSlug,
  });

  return (
    <Link
      to={href}
      className="group flex flex-col"
    >
      {/* Artwork */}
      <div className="aspect-square rounded-xl overflow-hidden bg-[var(--wk-bg)] border border-[var(--wk-border)] mb-3 relative">
        {release.artworkUrl ? (
          <img
            src={release.artworkUrl}
            alt={`${release.title} artwork`}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[var(--wk-surface-raised)]">
            <WkIcon name="Album" size={32} className="text-[var(--wk-text-faint)]" />
          </div>
        )}

        {/* Type badge */}
        <div className="absolute top-2.5 left-2.5">
          <span className="inline-flex items-center rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
            {release.releaseType || "Release"}
          </span>
        </div>

        {/* Track count badge */}
        {release.trackCount !== undefined && release.trackCount > 0 && (
          <div className="absolute bottom-2.5 right-2.5">
            <span className="inline-flex items-center rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-bold text-white/80 backdrop-blur-sm">
              {release.trackCount} {release.trackCount === 1 ? "track" : "tracks"}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-[13px] font-extrabold text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors leading-tight truncate">
        {release.title}
      </div>
      <div className="text-[11px] font-semibold text-[var(--wk-text-muted)] truncate mt-0.5">
        {release.releaseType || "Release"}{displayYear ? ` · ${displayYear}` : ""}
      </div>
    </Link>
  );
}

const INITIAL_COUNT = 20;

export function ArtistDiscography({
  releases,
  eyebrow = "Discography",
  title = "Releases",
  emptyTitle = "No releases",
  emptyDescription = "No releases listed yet.",
  artistName,
}: ArtistDiscographyProps) {
  const [filter, setFilter] = useState<Filter>("All");
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const { ref, revealed } = useScrollReveal<HTMLElement>(0.1);

  const sortedReleases = useMemo(() => {
    return [...releases].sort((a, b) => {
      const da = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const db = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      return db - da;
    });
  }, [releases]);

  const filtered = sortedReleases.filter((r) => {
    if (filter === "All") return true;
    if (filter === "Albums") return (r.releaseType || "").toLowerCase() === "album";
    if (filter === "EPs") return (r.releaseType || "").toLowerCase() === "ep";
    if (filter === "Singles") return (r.releaseType || "").toLowerCase() === "single";
    return true;
  });

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  const filters: Filter[] = ["All", "Albums", "EPs", "Singles"];
  const counts: Record<Filter, number> = {
    All: sortedReleases.length,
    Albums: sortedReleases.filter((r) => (r.releaseType || "").toLowerCase() === "album").length,
    EPs: sortedReleases.filter((r) => (r.releaseType || "").toLowerCase() === "ep").length,
    Singles: sortedReleases.filter((r) => (r.releaseType || "").toLowerCase() === "single").length,
  };

  const handleFilterChange = (f: Filter) => {
    setFilter(f);
    setVisibleCount(INITIAL_COUNT);
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + INITIAL_COUNT);
  };

  return (
    <section ref={ref} className={`${revealed ? "is-visible" : ""} reveal-up`}>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-3">
            <WkIcon name="Disc3" size={12} />
            {eyebrow}
          </div>
          <h2 className="text-[clamp(26px,3vw,40px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
            {title}
          </h2>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)]">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`rounded-full px-4 py-1.5 text-[12px] font-bold transition-all whitespace-nowrap ${
                filter === f
                  ? "bg-[var(--wk-brand)] text-white"
                  : "text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
              }`}
            >
              {f}
              <span className={`ml-1 text-[11px] ${filter === f ? "text-white/60" : "text-[var(--wk-text-faint)]"}`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-14 text-center">
          <i className="ri-album-line mb-3 block text-5xl text-[var(--wk-text-faint)]" />
          <p className="text-[15px] font-semibold text-[var(--wk-text-muted)]">{emptyTitle}</p>
          <p className="mt-1 text-[13px] text-[var(--wk-text-faint)]">
            {emptyDescription}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4 md:gap-5">
            {visible.map((release) => (
              <DiscographyCard key={release.slug} release={release} artistName={artistName} />
            ))}
          </div>

          {hasMore && (
            <div className="mt-10 flex justify-center">
              <button
                onClick={handleLoadMore}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-6 py-2.5 text-[13px] font-bold text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)] hover:border-[var(--wk-brand)]/30 transition-all whitespace-nowrap"
              >
                <i className="ri-add-line text-[var(--wk-brand)]" />
                Load more
                <span className="text-[11px] font-semibold text-[var(--wk-text-faint)] ml-1">
                  ({filtered.length - visibleCount} remaining)
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}