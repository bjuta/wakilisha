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
  return (
    <Link
      to={`/labels/${slug}`}
      className="group block rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 transition-all hover:border-[var(--wk-border-2)]"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--wk-surface-raised)]">
          {logoUrl ? (
            <img src={logoUrl} alt={name} className="h-full w-full rounded-lg object-contain p-1" />
          ) : (
            <i className="ri-building-2-line text-xl text-[var(--wk-text-faint)]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[14px] font-bold text-[var(--wk-text)]">{name}</h3>
            {isFeatured && <WkTag variant="brand">Featured</WkTag>}
          </div>
          {country && (
            <div className="text-[12px] text-[var(--wk-text-muted)]">{country}</div>
          )}
          <div className="mt-2 flex gap-3 text-[11px] text-[var(--wk-text-faint)]">
            {releaseCount !== undefined && (
              <span>{releaseCount} releases</span>
            )}
            {artistCount !== undefined && (
              <span>{artistCount} artists</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}