import { Link } from "react-router-dom";
import type { MagazineArticle } from "@/services/magazineArticles";
import { ResponsiveMediaImage } from "@/components/media/ResponsiveMediaImage";
import { Chapter19FallbackImage } from "@/components/media/Chapter19FallbackImage";

interface ArticleRelatedProps {
  stories: MagazineArticle[];
  loading: boolean;
  issueContext?: {
    href: string;
    label: string;
    blurb: string;
  };
}

/**
 * Workbook P11: the story ends before the next story begins.
 * Real related articles only, flat editorial rows and predictable spacing.
 */
export function ArticleRelated({ stories, loading, issueContext }: ArticleRelatedProps) {
  if (!loading && stories.length === 0 && !issueContext) return null;

  return (
    <section
      data-wk-workbook-related="articles"
      className="border-t border-[var(--wk-border)] bg-[var(--wk-bg)]"
      aria-label="Related articles"
    >
      <div className="mx-auto w-full max-w-[1060px] px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-6 flex items-end justify-between gap-4 border-b border-[var(--wk-border)] pb-4 sm:mb-8">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--wk-brand)]">
              Read next
            </p>
            <h2 className="text-[clamp(24px,3vw,32px)] font-black leading-tight tracking-[-0.035em] text-[var(--wk-text)]">
              More from Magazine
            </h2>
          </div>
          <Link
            to="/magazine"
            className="shrink-0 text-[12px] font-semibold text-[var(--wk-brand)] hover:underline"
          >
            All stories <span aria-hidden="true">→</span>
          </Link>
        </div>

        {issueContext ? (
          <Link
            to={issueContext.href}
            className="mb-6 block border-b border-[var(--wk-border)] pb-5"
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--wk-brand)]">
              {issueContext.label}
            </span>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--wk-text-soft)]">
              {issueContext.blurb}
            </p>
          </Link>
        ) : null}

        {loading ? (
          <p className="py-8 text-[13px] text-[var(--wk-text-muted)]" aria-live="polite">
            Loading related stories…
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((story) => (
              <Link
                key={story.slug}
                to={`/magazine/${story.slug}`}
                className="group block min-w-0"
              >
                <div className="relative aspect-[3/2] overflow-hidden bg-[var(--wk-surface-raised)]">
                  {story.heroUrl ? (
                    <ResponsiveMediaImage
                      src={story.heroUrl}
                      preset="thumbnail"
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <Chapter19FallbackImage id={story.id} slug={story.slug} name={story.title} />
                  )}
                </div>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--wk-brand)]">
                  {story.section}
                </p>
                <h3 className="mt-1 text-[17px] font-black leading-[1.2] tracking-[-0.025em] text-[var(--wk-text)] group-hover:text-[var(--wk-brand)]">
                  {story.title}
                </h3>
                <p className="mt-2 text-[11px] text-[var(--wk-text-muted)]">
                  {story.author} · {story.readingTime} min read
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
