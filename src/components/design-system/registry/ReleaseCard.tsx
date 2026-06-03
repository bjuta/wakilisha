import { Link } from "react-router-dom";
import { WkTag } from "@/components/design-system/primitives/Tag";
import { releaseUrl } from "@/services/repairedContent/client";

export interface ReleaseCardProps {
  slug: string;
  title: string;
  artist: string;
  artistSlug?: string;
  artworkUrl?: string;
  releaseType?: "Album" | "EP" | "Single" | "Compilation";
  year?: string | number;
  trackCount?: number;
  labelName?: string;
  onQuickView?: () => void;
}

export function ReleaseCard({
  slug,
  title,
  artist,
  artistSlug,
  artworkUrl,
  releaseType,
  year,
  trackCount,
  labelName,
  onQuickView,
}: ReleaseCardProps) {
  return (
    <div className="group relative rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden transition-all hover:border-[var(--wk-border-2)]">
      <Link to={releaseUrl({ slug, artist })} className="block">
        <div className="relative aspect-square bg-[var(--wk-surface-raised)]">
          {artworkUrl ? (
            <img
              src={artworkUrl}
              alt={title}
              className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-standard)] group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <i className="ri-album-line text-4xl text-[var(--wk-text-faint)]" />
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="truncate text-[14px] font-bold text-[var(--wk-text)]">{title}</h3>
          <div className="truncate text-[12px] text-[var(--wk-text-muted)]">
            {artistSlug ? (
              <span>{artist}</span>
            ) : (
              artist
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {releaseType && <WkTag>{releaseType}</WkTag>}
            {year && <WkTag>{year}</WkTag>}
            {trackCount !== undefined && (
              <span className="text-[11px] text-[var(--wk-text-faint)]">
                {trackCount} tracks
              </span>
            )}
          </div>
          {labelName && (
            <div className="mt-1 text-[11px] text-[var(--wk-text-faint)]">{labelName}</div>
          )}
        </div>
      </Link>
      {onQuickView && (
        <button
          onClick={onQuickView}
          className="absolute right-2 top-[calc(100%-56px-8px)] flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-0 transition-all group-hover:opacity-100"
          aria-label="Quick view"
        >
          <i className="ri-expand-diagonal-line text-sm" />
        </button>
      )}
    </div>
  );
}