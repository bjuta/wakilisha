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
    <div className="max-w-[740px] mx-auto px-6 lg:px-8 pt-12 pb-8">
      {/* Section + stats chips */}
      <div className="flex items-center gap-3 mb-7 flex-wrap">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--wk-brand)]"
        >
          {article.section}
        </span>
        <div className="flex items-center gap-1.5 text-[12px] text-[var(--wk-text-faint)] font-medium">
          <div className="w-4 h-4 flex items-center justify-center">
            <WkIcon name="Clock" size={13} />
          </div>
          {article.readingTime} min read
        </div>
        {article.readCount > 0 && (
          <div className="flex items-center gap-1.5 text-[12px] text-[var(--wk-text-faint)] font-medium">
            <div className="w-4 h-4 flex items-center justify-center">
              <WkIcon name="Eye" size={13} />
            </div>
            {article.readCount.toLocaleString()} reads
          </div>
        )}
      </div>

      {/* Title */}
      <h1 className="text-[clamp(30px,4.5vw,52px)] font-black leading-[0.93] tracking-[-0.045em] text-[var(--wk-text)] mb-5">
        {article.title}
      </h1>

      {/* Dek */}
      {article.dek && (
        <p className="text-[17px] lg:text-[19px] leading-relaxed text-[var(--wk-text-soft)] mb-8 font-normal">
          {article.dek}
        </p>
      )}

      {/* Divider */}
      <div className="h-px bg-[var(--wk-border)] mb-7" />

      {/* Author row + share actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Author */}
        <div className="flex items-center gap-3">
          <ArticleAuthorIdentity
            name={article.author}
            personPath={article.authorPersonPath}
            organizationPath={article.authorOrganizationPath}
            className="w-11 h-11 rounded-full bg-[var(--wk-brand)] flex items-center justify-center text-[13px] font-black text-[var(--wk-brand-on)] hover:opacity-80 transition-opacity shrink-0"
            plainClassName="w-11 h-11 rounded-full bg-[var(--wk-brand)] flex items-center justify-center text-[13px] font-black text-[var(--wk-brand-on)] shrink-0"
          >
            {initials}
          </ArticleAuthorIdentity>
          <div>
            <ArticleAuthorIdentity
              name={article.author}
              personPath={article.authorPersonPath}
            organizationPath={article.authorOrganizationPath}
              className="text-[14px] font-bold text-[var(--wk-text)] hover:text-[var(--wk-brand)] transition-colors block leading-tight"
              plainClassName="text-[14px] font-bold text-[var(--wk-text)] block leading-tight"
            >
              {article.author}
            </ArticleAuthorIdentity>
            <span className="text-[12px] text-[var(--wk-text-muted)]">{article.date}</span>
          </div>
        </div>

        {/* Share actions */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              ref={shareBtnRef}
              onClick={() => setSharePopoverOpen(!sharePopoverOpen)}
              className="inline-flex min-h-11 items-center gap-2 border border-[var(--wk-border)] px-4 text-[13px] font-semibold text-[var(--wk-text)] transition-colors hover:border-[var(--wk-brand)] cursor-pointer whitespace-nowrap"
            >
              <i className="ri-share-forward-line text-[15px]" />
              Share
              {totalShares > 0 && (
                <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-[6px] rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)] text-[11px] font-bold">
                  {totalShares.toLocaleString()}
                </span>
              )}
            </button>

            <SharePopover
              open={sharePopoverOpen}
              onClose={() => setSharePopoverOpen(false)}
              item={{
                title: article.title,
                subtitle: article.dek,
                url: pageUrl,
                type: "article",
                imageUrl: article.heroUrl,
              }}
              triggerRef={shareBtnRef as React.RefObject<HTMLElement>}
            />
          </div>
        </div>
      </div>
    </div>
  );
}