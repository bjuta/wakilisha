import { Link } from "react-router-dom";
import { getAuthorMeta } from "@/services/authorProfiles";
import { WkTag } from "@/components/design-system/primitives/Tag";

interface EditorPick {
  slug: string;
  title: string;
  section: string;
  date: string;
  readingTime?: number;
  heroUrl?: string;
  author: string;
  readCount: number;
  pickReason: string;
}

interface WkEditorialPicksProps {
  picks: EditorPick[];
}

export function WkEditorialPicks({ picks }: WkEditorialPicksProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="wk-eyebrow">Editor's picks</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {picks.map((pick) => (
          <Link
            key={pick.slug}
            to={`/magazine/${pick.slug}`}
            className="group flex flex-col gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 transition-all hover:border-[var(--wk-border-2)]"
          >
            {pick.heroUrl && (
              <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                <img
                  src={pick.heroUrl}
                  alt={pick.title}
                  className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-standard)] group-hover:scale-105"
                />
                <div className="absolute left-2 top-2">
                  <WkTag variant="brand">{pick.pickReason}</WkTag>
                </div>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <WkTag>{pick.section}</WkTag>
                <span className="text-[11px] text-[var(--wk-text-faint)]">
                  {pick.readingTime} min
                </span>
              </div>
              <h3 className="line-clamp-2 text-[13px] font-bold leading-snug text-[var(--wk-text)]">
                {pick.title}
              </h3>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
                <Link
                  to={`/authors/${getAuthorMeta(pick.author).slug}`}
                  className="hover:text-[var(--wk-brand)] transition-colors"
                >
                  {pick.author}
                </Link>
                <span>·</span>
                <span>{pick.date}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}