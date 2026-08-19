import { Link } from "react-router-dom";
import type { MagazineArticle } from "@/services/magazineArticles";
import { ArticleAuthorIdentity } from "@/components/design-system/editorial/ArticleAuthorIdentity";

interface SectionRowBlockProps {
  section: string;
  stories: MagazineArticle[];
  onViewAll: () => void;
  /** "large" = 1 big + small grid | "list" = horizontal list | "grid" = 3 col grid */
  variant: "large" | "list" | "grid";
}

function SectionHeader({ section, count, onViewAll }: { section: string; count: number; onViewAll: () => void }) {
  return (
    <div className="flex items-end justify-between mb-7 gap-4 flex-wrap border-b border-[var(--wk-border)] pb-4">
      <div className="flex items-center gap-3">
        <div className="w-1 h-7 rounded-full bg-[var(--wk-brand)]" />
        <h2 className="text-[22px] lg:text-[26px] font-black tracking-[-0.035em] text-[var(--wk-text)]">
          {section}
        </h2>
        <span className="text-[12px] font-semibold text-[var(--wk-text-faint)] bg-[var(--wk-surface)] border border-[var(--wk-border)] px-2.5 py-0.5 rounded-full">
          {count}
        </span>
      </div>
      <button
        onClick={onViewAll}
        className="text-[12px] font-bold text-[var(--wk-brand)] hover:text-[var(--wk-brand-2)] transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
      >
        View all
        <i className="ri-arrow-right-line" />
      </button>
    </div>
  );
}

/* ── Large variant: 1 big card + 3 smaller cards ── */
function LargeVariant({ stories }: { stories: MagazineArticle[] }) {
  const [primary] = stories;
  const rest = stories.slice(1, 4);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Big card with image + overlay text */}
      {primary && (
        <Link
          to={`/magazine/${primary.slug}`}
          className="group relative overflow-hidden rounded-2xl bg-[#0a0a0a] min-h-[320px] flex flex-col"
        >
          <img
            src={primary.heroUrl}
            alt={primary.title}
            className="absolute inset-0 w-full h-full object-cover object-top opacity-75 transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="relative z-10 mt-auto p-6 text-white">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)] mb-2 block">
              {primary.section}
            </span>
            <h3 className="text-[20px] lg:text-[24px] font-black tracking-[-0.035em] leading-snug mb-2 line-clamp-2">
              {primary.title}
            </h3>
            {primary.dek && (
              <p className="text-[13px] text-white/65 line-clamp-2 mb-4 leading-relaxed">{primary.dek}</p>
            )}
            <div className="flex items-center gap-2 text-[11px] text-white/50">
              <span className="font-semibold text-white/75">{primary.author}</span>
              <span>·</span>
              <span>{primary.readingTime} min</span>
            </div>
          </div>
        </Link>
      )}

      {/* Small cards stacked */}
      <div className="flex flex-col gap-3">
        {rest.map((story) => (
          <Link
            key={story.slug}
            to={`/magazine/${story.slug}`}
            className="group flex gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 hover:border-[var(--wk-border-2)] transition-all hover:-translate-y-0.5"
          >
            <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-[var(--wk-surface-raised)]">
              <img
                src={story.heroUrl}
                alt={story.title}
                loading="lazy"
                className="w-full h-full object-cover object-top"
              />
            </div>
            <div className="min-w-0 flex-1 flex flex-col gap-1">
              <h4 className="text-[15px] font-bold tracking-[-0.02em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-2">
                {story.title}
              </h4>
              <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)] mt-auto">
                <span className="font-semibold">{story.author}</span>
                <span>·</span>
                <span>{story.readingTime} min</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── List variant: horizontal scroll of cards ── */
function ListVariant({ stories }: { stories: MagazineArticle[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stories.map((story, idx) => (
        <Link
          key={story.slug}
          to={`/magazine/${story.slug}`}
          className="group flex flex-col gap-3 rounded-xl overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-surface)] hover:border-[var(--wk-border-2)] transition-all hover:-translate-y-1"
        >
          <div className="relative aspect-[4/3] overflow-hidden bg-[var(--wk-surface-raised)]">
            <img
              src={story.heroUrl}
              alt={story.title}
              loading="lazy"
              className="w-full h-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            {/* Rank dot for top 3 */}
            {idx < 3 && (
              <span className="absolute top-2.5 left-2.5 w-6 h-6 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[10px] font-black flex items-center justify-center">
                {idx + 1}
              </span>
            )}
          </div>
          <div className="px-4 pb-4 flex flex-col gap-1.5 flex-1">
            <h4 className="text-[14px] font-bold tracking-[-0.02em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-2">
              {story.title}
            </h4>
            {story.dek && (
              <p className="text-[12px] text-[var(--wk-text-muted)] line-clamp-2 leading-relaxed">
                {story.dek}
              </p>
            )}
            <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)] mt-auto pt-1">
              <ArticleAuthorIdentity name={story.author} personPath={story.authorPersonPath}

                className="font-semibold hover:text-[var(--wk-brand)] transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {story.author}
              </ArticleAuthorIdentity>
              <span>·</span>
              <span>{story.readingTime} min</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ── Grid variant: 3-column with text-heavy cards ── */
function GridVariant({ stories }: { stories: MagazineArticle[] }) {
  const [primary, ...rest] = stories;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Primary with larger image */}
      {primary && (
        <Link
          to={`/magazine/${primary.slug}`}
          className="group lg:col-span-1 flex flex-col rounded-2xl overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-surface)] hover:border-[var(--wk-border-2)] transition-all hover:-translate-y-1"
        >
          <div className="relative aspect-[16/10] overflow-hidden bg-[var(--wk-surface-raised)]">
            <img
              src={primary.heroUrl}
              alt={primary.title}
              loading="lazy"
              className="w-full h-full object-cover object-top"
            />
          </div>
          <div className="p-5 flex flex-col gap-2 flex-1">
            <h4 className="text-[17px] font-black tracking-[-0.025em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors">
              {primary.title}
            </h4>
            {primary.dek && (
              <p className="text-[13px] text-[var(--wk-text-muted)] line-clamp-2 leading-relaxed">
                {primary.dek}
              </p>
            )}
            <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)] mt-auto">
              <span className="font-semibold">{primary.author}</span>
              <span>·</span>
              <span>{primary.readingTime} min</span>
            </div>
          </div>
        </Link>
      )}

      {/* Secondary cards (compact) */}
      <div className="lg:col-span-2 flex flex-col gap-3">
        {rest.slice(0, 3).map((story) => (
          <Link
            key={story.slug}
            to={`/magazine/${story.slug}`}
            className="group flex gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 hover:border-[var(--wk-border-2)] transition-all hover:-translate-x-0 hover:bg-[var(--wk-surface-raised)]"
          >
            <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-[var(--wk-surface-raised)]">
              <img
                src={story.heroUrl}
                alt={story.title}
                loading="lazy"
                className="w-full h-full object-cover object-top"
              />
            </div>
            <div className="min-w-0 flex-1 flex flex-col gap-1">
              <h4 className="text-[15px] font-bold tracking-[-0.02em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-2">
                {story.title}
              </h4>
              {story.dek && (
                <p className="text-[12px] text-[var(--wk-text-muted)] line-clamp-1 leading-relaxed">
                  {story.dek}
                </p>
              )}
              <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)] mt-auto">
                <span className="font-semibold">{story.author}</span>
                <span>·</span>
                <span>{story.readingTime} min</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SectionRowBlock({ section, stories, onViewAll, variant }: SectionRowBlockProps) {
  if (!stories.length) return null;

  return (
    <section>
      <SectionHeader section={section} count={stories.length} onViewAll={onViewAll} />
      {variant === "large" && <LargeVariant stories={stories} />}
      {variant === "list" && <ListVariant stories={stories} />}
      {variant === "grid" && <GridVariant stories={stories} />}
    </section>
  );
}