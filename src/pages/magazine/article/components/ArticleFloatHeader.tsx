import type { MagazineArticle } from "@/services/magazineArticles";
import { ArticleAuthorIdentity } from "@/components/design-system/editorial/ArticleAuthorIdentity";

interface ArticleFloatHeaderProps {
  article: MagazineArticle;
}

export function ArticleFloatHeader({ article }: ArticleFloatHeaderProps) {
  const initials = article.author
    .split(" ")
    .map((name) => name[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="wk-reference-article-byline" aria-label="Article author and actions">
      <div className="flex items-center gap-3">
        <ArticleAuthorIdentity
          name={article.author}
          personPath={article.authorPersonPath}
          organizationPath={article.authorOrganizationPath}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] text-[13px] font-bold text-[var(--wk-text)]"
          plainClassName="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] text-[13px] font-bold text-[var(--wk-text)]"
        >{initials}</ArticleAuthorIdentity>
        <div className="min-w-0">
          <ArticleAuthorIdentity
            name={article.author}
            personPath={article.authorPersonPath}
            organizationPath={article.authorOrganizationPath}
            className="block truncate text-[13px] font-bold text-[var(--wk-text)]"
            plainClassName="block truncate text-[13px] font-bold text-[var(--wk-text)]"
          >{article.author}</ArticleAuthorIdentity>
          <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">{article.date}</p>
        </div>
      </div>
      <div className="mt-4 text-[12px] leading-[1.5] text-[var(--wk-text-muted)]">
        {article.readingTime} min read
        {article.readCount > 0 ? ` · ${article.readCount.toLocaleString()} reads` : ""}
      </div>
    </aside>
  );
}
