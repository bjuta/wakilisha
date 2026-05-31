import { Link } from "react-router-dom";
import { WkTag } from "@/components/design-system/primitives/Tag";

export interface LabelCardProps {
  slug: string;
  name: string;
  country?: string;
  artistCount?: number;
  releaseCount?: number;
  logoUrl?: string;
  isFeatured?: boolean;
}

export function LabelCard({
  slug,
  name,
  country,
  artistCount,
  releaseCount,
  logoUrl,
  isFeatured,
}: LabelCardProps) {
  const monogram = name.split(/[\s&]/)[0].charAt(0);

  return (
    <Link
      to={`/labels/${slug}`}
      className="group block overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all hover:border-[var(--wk-border-2)]"
    >
      {/* Top bar with color */}
      <div className="h-2 bg-[var(--wk-brand)]" />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--wk-brand)] text-[22px] font-black text-[var(--wk-brand-on)]">
            {logoUrl ? (
              <img src={logoUrl} alt={name} className="h-full w-full rounded-xl object-contain p-1" />
            ) : (
              monogram
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[15px] font-bold text-[var(--wk-text)]">{name}</h3>
              {isFeatured && <WkTag variant="brand">Featured</WkTag>}
            </div>
            {country && (
              <div className="text-[12px] text-[var(--wk-text-muted)]">{country}</div>
            )}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4 border-t border-[var(--wk-border)] pt-3 text-[12px] text-[var(--wk-text-muted)]">
          {releaseCount !== undefined && (
            <span className="inline-flex items-center gap-1">
              <i className="ri-album-line text-[11px] text-[var(--wk-brand)]" />
              {releaseCount} releases
            </span>
          )}
          {artistCount !== undefined && (
            <span className="inline-flex items-center gap-1">
              <i className="ri-user-line text-[11px] text-[var(--wk-brand)]" />
              {artistCount} artists
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-[var(--wk-text-faint)] transition-colors group-hover:text-[var(--wk-brand)]">
            View
            <i className="ri-arrow-right-line text-[11px]" />
          </span>
        </div>
      </div>
    </Link>
  );
}