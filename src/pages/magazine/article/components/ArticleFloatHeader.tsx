import { useState, useEffect, useRef } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { getShareCounts, getTotalShareCount } from "@/services/shareTracking";
import type { MagazineArticle } from "@/services/magazineArticles";
import { SharePopover } from "@/components/design-system/share/ShareSheet";
import { ArticleAuthorIdentity } from "@/components/design-system/editorial/ArticleAuthorIdentity";

interface ArticleFloatHeaderProps {
  article: MagazineArticle;
}

export function ArticleFloatHeader({ article }: ArticleFloatHeaderProps) {
  const [shareCounts, setShareCounts] = useState<Record<string, number>>({});
  const [sharePopoverOpen, setSharePopoverOpen] = useState(false);
  const shareBtnRef = useRef<HTMLButtonElement>(null);

  // Fetch share counts on mount
  useEffect(() => {
    const baseUrl = window.location.href;
    getShareCounts(baseUrl).then(setShareCounts).catch(() => {});
  }, []);

  const totalShares = getTotalShareCount(shareCounts);
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

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
      <div className="mt-5 relative border-t border-[var(--wk-border)] pt-4">
        <button
          type="button"
          ref={shareBtnRef}
          onClick={() => setSharePopoverOpen(!sharePopoverOpen)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--wk-border)] px-4 text-[13px] font-semibold text-[var(--wk-text)] hover:border-[var(--wk-brand)]"
        >
          <WkIcon name="Share2" size={16} /> Share
          {totalShares > 0 && <span className="text-[11px] text-[var(--wk-text-muted)]">{totalShares.toLocaleString()}</span>}
        </button>
        <SharePopover
          open={sharePopoverOpen}
          onClose={() => setSharePopoverOpen(false)}
          item={{ title: article.title, subtitle: article.dek, url: pageUrl, type: "article", imageUrl: article.heroUrl }}
          triggerRef={shareBtnRef as React.RefObject<HTMLElement>}
        />
      </div>
    </aside>
  );
}
