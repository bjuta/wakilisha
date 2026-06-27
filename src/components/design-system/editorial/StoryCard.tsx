import { Link } from "react-router-dom";
import { WkTag } from "@/components/design-system/primitives/Tag";
import { getAuthorMeta } from "@/services/authorProfiles";
import { trackEvent } from "@/services/analytics";

export interface StoryCardProps {
  slug: string;
  title: string;
  section?: string;
  date?: string;
  readingTime?: number;
  heroUrl?: string;
  dek?: string;
  author?: string;
  isFeatured?: boolean;
  sourceSection?: string;
  sourceEntity?: string;
  clickPosition?: number;
}

export function StoryCard({
  slug,
  title,
  section,
  date,
  readingTime,
  heroUrl,
  dek,
  author,
  isFeatured = false,
  sourceSection,
  sourceEntity,
  clickPosition,
}: StoryCardProps) {
  const authorUrl = author ? `/authors/${getAuthorMeta(author).slug}` : null;

  const handleClick = () => {
    if (sourceSection) {
      trackEvent("card_click", {
        entityType: "article",
        entitySlug: slug,
        context: {
          source_section: sourceSection,
          ...(sourceEntity ? { source_entity: sourceEntity } : {}),
          ...(clickPosition !== undefined ? { click_position: clickPosition } : {}),
        },
      });
    }
  };

  if (isFeatured) {
    return (
      <Link
        to={`/magazine/${slug}`}
        onClick={handleClick}
        className="group block overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)]"
      >
        {heroUrl && (
          <div className="relative aspect-[16/7] overflow-hidden">
            <img
              src={heroUrl}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            {section && (
              <div className="absolute left-4 top-4">
                <WkTag variant="brand">{section}</WkTag>
              </div>
            )}
          </div>
        )}
        <div className="p-5">
          <h2 className="wk-h-section mb-2">{title}</h2>
          {dek && <p className="wk-copy mb-3">{dek}</p>}
          <div className="flex items-center gap-2 text-[12px] text-[var(--wk-text-faint)]">
            {author && authorUrl && (
              <>
                <Link
                  to={authorUrl}
                  className="font-semibold hover:text-[var(--wk-brand)] transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {author}
                </Link>
                <span>·</span>
              </>
            )}
            {date && <span>{date}</span>}
            {readingTime && <span>· {readingTime} min read</span>}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/magazine/${slug}`}
      onClick={handleClick}
      className="group flex gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 transition-all hover:border-[var(--wk-border-2)]"
    >
      {heroUrl && (
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
          <img
            src={heroUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        {section && <WkTag variant="brand">{section}</WkTag>}
        <h3 className="mt-1 line-clamp-2 text-[13px] font-bold text-[var(--wk-text)]">{title}</h3>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
          {author && authorUrl && (
            <>
              <Link
                to={authorUrl}
                className="font-semibold hover:text-[var(--wk-brand)] transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {author}
              </Link>
              <span>·</span>
            </>
          )}
          {date && <span>{date}</span>}
          {readingTime && <span>· {readingTime} min read</span>}
        </div>
      </div>
    </Link>
  );
}