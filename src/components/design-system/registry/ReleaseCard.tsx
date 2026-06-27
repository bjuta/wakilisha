import { Link } from "react-router-dom";
import { WkTag } from "@/components/design-system/primitives/Tag";
import { releaseUrl } from "@/services/publicContent/client";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import { buildReleaseCardBlurb } from "@/services/cultureContext/releaseAdapters";
import { trackEvent } from "@/services/analytics";

export interface ReleaseCardProps {
  slug: string;
  title: string;
  artist: string;
  artistSlug?: string;
  artworkUrl?: string;
  releaseType?: string;
  year?: string | number;
  trackCount?: number;
  labelName?: string;
  contextText?: string;
  onQuickView?: () => void;
  sourceSection?: string;
  sourceEntity?: string;
  clickPosition?: number;
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
  contextText,
  onQuickView,
  sourceSection,
  sourceEntity,
  clickPosition,
}: ReleaseCardProps) {
  const blurb = contextText || buildReleaseCardBlurb({
    slug,
    title,
    artist,
    releaseType,
    year: year ? String(year) : "",
    trackCount: trackCount ?? 0,
    labelName: labelName || "",
    artworkUrl: artworkUrl || "",
  });

  const handleClick = () => {
    if (sourceSection) {
      trackEvent("card_click", {
        entityType: "release",
        entitySlug: slug,
        context: {
          source_section: sourceSection,
          ...(sourceEntity ? { source_entity: sourceEntity } : {}),
          ...(clickPosition !== undefined ? { click_position: clickPosition } : {}),
        },
      });
    }
  };

  return (
    <div className="group relative rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden transition-all hover:border-[var(--wk-border-2)]">
      <Link to={releaseUrl({ slug, artist })} onClick={handleClick} className="block">
        <div className="relative aspect-square bg-[var(--wk-surface-raised)]">
          {artworkUrl ? (
            <img
              src={artworkUrl}
              alt={title}
              className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-standard)] group-hover:scale-105"
            />
          ) : (
            <Ch19GradientImage slug={slug} name={title} />
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
          <p className="mt-2 line-clamp-2 text-[11px] font-semibold leading-snug text-[var(--wk-text-soft)]">
            {blurb}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {releaseType && <WkTag>{releaseType}</WkTag>}
            {year && <WkTag>{year}</WkTag>}
            {trackCount !== undefined && trackCount > 0 && (
              <span className="text-[11px] text-[var(--wk-text-faint)]">
                {trackCount} {trackCount === 1 ? "track" : "tracks"}
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
