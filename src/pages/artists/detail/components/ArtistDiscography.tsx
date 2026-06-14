import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { AlbumModal } from "@/components/design-system/releases/AlbumModal";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import type { ModalRelease } from "@/components/design-system/releases/AlbumModal";

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
  tracks?: Array<{ title: string; duration: string; artists?: string; previewUrl?: string }>;
}

interface ArtistDiscographyProps {
  releases: DiscoRelease[];
  eyebrow?: string;
  title?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

type Filter = "All" | "Albums" | "EPs" | "Singles";

function formatYear(dateStr?: string, year?: string | number): string {
  if (year) return String(year);
  if (dateStr) return dateStr.split("-")[0];
  return "";
}

function toModalRelease(r: DiscoRelease): ModalRelease {
  return {
    slug: r.slug,
    title: r.title,
    artist: r.artist || "",
    releaseType: r.releaseType || "Release",
    year: r.year || formatYear(r.releaseDate),
    labelName: r.labelName,
    artworkUrl: r.artworkUrl || "",
    trackCount: r.trackCount || (r.tracks?.length || 0),
    tracks: (r.tracks || []).map((t) => ({
      title: t.title,
      duration: t.duration,
      artists: t.artists || "",
      previewUrl: t.previewUrl,
    })),
  };
}

function ReleaseCard({
  release,
  onOpen,
}: {
  release: DiscoRelease;
  onOpen: (release: DiscoRelease) => void;
}) {
  const trackPreviews = release.tracks?.slice(0, 3) || [];
  const hasMoreTracks = (release.trackCount || 0) > 3;
  const releaseYear = formatYear(release.releaseDate, release.year);

  return (
    <button
      onClick={() => onOpen(release)}
      className="group relative block w-full overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] text-left transition-all duration-500 hover:border-[var(--wk-brand)]"
    >
      {/* Artwork */}
      <div className="relative aspect-square bg-[var(--wk-surface-raised)] overflow-hidden">
        {release.artworkUrl ? (
          <img
            src={release.artworkUrl}
            alt={release.title}
            className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.06]"
          />
        ) : (
          <Ch19GradientImage slug={release.slug} name={release.title} />
        )}

        {/* Type chip on artwork */}
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-white backdrop-blur-sm">
            {release.releaseType || "Release"}
          </span>
        </div>

        {/* Hover overlay with track preview */}
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 transition-all duration-300 group-hover:opacity-100">
          <div className="p-4 pb-5">
            <div className="space-y-1.5">
              {trackPreviews.map((track, idx) => (
                <div key={idx} className="flex items-start gap-2 text-[13px] text-white/90">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-[10px] font-bold shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <span className="truncate block">{track.title}</span>
                    {track.artists && (
                      <span className="text-[10px] text-white/50 truncate block leading-tight">feat. {track.artists}</span>
                    )}
                  </div>
                </div>
              ))}
              {hasMoreTracks && (
                <div className="text-[12px] text-white/60 font-semibold">
                  +{release.trackCount! - 3} more
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info below artwork */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          {releaseYear && (
            <span className="text-[12px] font-bold text-[var(--wk-text-faint)]">
              {releaseYear}
            </span>
          )}
          {release.trackCount !== undefined && (
            <span className="text-[12px] text-[var(--wk-text-faint)]">
              · {release.trackCount} tracks
            </span>
          )}
        </div>

        <h4 className="text-[16px] font-bold leading-tight text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors">
          {release.title}
        </h4>
        {release.artist && (
          <p className="mt-1 text-[12px] text-[var(--wk-text-faint)]">by {release.artist}</p>
        )}
      </div>
    </button>
  );
}

export function ArtistDiscography({
  releases,
  eyebrow = "Discography",
  title = "Releases",
  emptyTitle = "No releases",
  emptyDescription = "{emptyDescription}",
}: ArtistDiscographyProps) {
  const [filter, setFilter] = useState<Filter>("All");
  const [modalRelease, setModalRelease] = useState<DiscoRelease | null>(null);
  const { ref, revealed } = useScrollReveal<HTMLElement>(0.1);

  // Sort releases by date descending (latest first)
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

  const filters: Filter[] = ["All", "Albums", "EPs", "Singles"];
  const counts: Record<Filter, number> = {
    All: sortedReleases.length,
    Albums: sortedReleases.filter((r) => r.releaseType === "Album").length,
    EPs: sortedReleases.filter((r) => r.releaseType === "EP").length,
    Singles: sortedReleases.filter((r) => r.releaseType === "single").length,
  };

  return (
    <section ref={ref} className={`${revealed ? "is-visible" : ""} reveal-up`}>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="wk-eyebrow mb-2">{eyebrow}</div>
          <h2 className="text-[clamp(26px,3vw,40px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
            {title}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-[12px] font-bold transition-all ${
                filter === f
                  ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                  : "border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text-muted)] hover:border-[var(--wk-border-2)] hover:text-[var(--wk-text)]"
              }`}
            >
              {f}
              <span className={`ml-1.5 text-[11px] ${filter === f ? "text-[var(--wk-brand-on)]/70" : "text-[var(--wk-text-faint)]"}`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-14 text-center">
          <i className="ri-album-line mb-3 block text-5xl text-[var(--wk-text-faint)]" />
          <p className="text-[15px] font-semibold text-[var(--wk-text-muted)]">{emptyTitle}</p>
          <p className="mt-1 text-[13px] text-[var(--wk-text-faint)]">
            {emptyDescription}
          </p>
        </div>
      )}

      {/* Gallery wall — all releases, equal size */}
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
        {filtered.map((release) => (
          <ReleaseCard key={release.slug} release={release} onOpen={setModalRelease} />
        ))}
      </div>

      <AlbumModal
        open={Boolean(modalRelease)}
        release={modalRelease ? toModalRelease(modalRelease) : null}
        onClose={() => setModalRelease(null)}
      />
    </section>
  );
}