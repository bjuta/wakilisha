import type { MagazineArticle } from "@/services/magazineArticles";
import { ArticleAuthorIdentity } from "@/components/design-system/editorial/ArticleAuthorIdentity";

type ArticleEndCreditsProps = {
  article: MagazineArticle;
  actionsOpen: boolean;
  onOpenActions: () => void;
};

/**
 * End-of-article author credit and the existing contextual actions gateway.
 * Keep author routing and sharing governance identical to the opening byline.
 */
export function ArticleEndCredits({
  article,
  actionsOpen,
  onOpenActions,
}: ArticleEndCreditsProps) {
  const initials = article.author
    .split(" ")
    .map((name) => name[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      data-wk-article-end-credits
      className="flex items-center justify-between gap-3"
      aria-label="Article end credits and actions"
    >
      <div className="flex min-w-0 items-center gap-3">
        <ArticleAuthorIdentity
          name={article.author}
          personPath={article.authorPersonPath}
          organizationPath={article.authorOrganizationPath}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] text-[12px] font-bold text-[var(--wk-text)]"
        >
          {initials}
        </ArticleAuthorIdentity>
        <div className="min-w-0">
          <ArticleAuthorIdentity
            name={article.author}
            personPath={article.authorPersonPath}
            organizationPath={article.authorOrganizationPath}
            className="block truncate text-[13px] font-bold leading-tight text-[var(--wk-text)]"
          >
            {article.author}
          </ArticleAuthorIdentity>
          <p className="mt-1 text-[11px] text-[var(--wk-text-muted)]">{article.date}</p>
        </div>
      </div>
      <button
        type="button"
        data-wk-article-actions-trigger="footer"
        aria-label="Article actions"
        aria-haspopup="dialog"
        aria-expanded={actionsOpen}
        onClick={onOpenActions}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] transition-colors hover:bg-[var(--wk-surface-raised)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wk-brand)]"
      >
        <i className="ri-more-2-line text-[18px]" aria-hidden="true" />
      </button>
    </div>
  );
}
