import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { getAuthorMeta, resolveAuthorMeta, type AuthorMeta } from "@/services/authorProfiles";
import { getShareCounts, getTotalShareCount } from "@/services/shareTracking";
import type { MagazineArticle } from "@/services/magazineArticles";
import { SharePopover } from "@/components/design-system/share/ShareSheet";

const SECTION_COLORS: Record<string, string> = {
  Analysis: "#C44A3B",
  Focus: "#D97706",
  Industry: "#78716C",
  Culture: "#BE185D",
  Interview: "#256B5A",
  Music: "#4F46E5",
  Lifestyle: "#0891B2",
  Art: "#DC2626",
  Opinion: "#7C3AED",
  News: "#1D4ED8",
};

function sectionColor(section: string): string {
  return SECTION_COLORS[section] || "var(--wk-brand)";
}

interface ArticleFloatHeaderProps {
  article: MagazineArticle;
}

export function ArticleFloatHeader({ article }: ArticleFloatHeaderProps) {
  const [authorMeta, setAuthorMeta] = useState<AuthorMeta | null>(null);
  const [shareCounts, setShareCounts] = useState<Record<string, number>>({});
  const [sharePopoverOpen, setSharePopoverOpen] = useState(false);
  const shareBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    resolveAuthorMeta(article.author)
      .then((resolved) => {
        if (!alive) return;
        setAuthorMeta(resolved);
      })
      .catch(() => {
        // Fallback to synchronous generated meta
      });
    return () => { alive = false; };
  }, [article.author]);

  // Fetch share counts on mount
  useEffect(() => {
    const baseUrl = window.location.href;
    getShareCounts(baseUrl).then(setShareCounts).catch(() => {});
  }, []);

  const totalShares = getTotalShareCount(shareCounts);
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  // Use resolved author meta when available, fall back to synchronous generation
  const meta = authorMeta ?? getAuthorMeta(article.author);
  const initials = meta.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="max-w-[740px] mx-auto px-6 lg:px-8 pt-12 pb-8">
      {/* Section + stats chips */}
      <div className="flex items-center gap-3 mb-7 flex-wrap">
        <span
          className="rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white"
          style={{ background: sectionColor(article.section) }}
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
          <Link
            to={`/authors/${meta.slug}`}
            className="w-11 h-11 rounded-full bg-[var(--wk-brand)] flex items-center justify-center text-[13px] font-black text-[var(--wk-brand-on)] hover:opacity-80 transition-opacity shrink-0"
          >
            {initials}
          </Link>
          <div>
            <Link
              to={`/authors/${meta.slug}`}
              className="text-[14px] font-bold text-[var(--wk-text)] hover:text-[var(--wk-brand)] transition-colors block leading-tight"
            >
              {meta.displayName}
            </Link>
            <span className="text-[12px] text-[var(--wk-text-muted)]">{article.date}</span>
          </div>
        </div>

        {/* Share actions */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              ref={shareBtnRef}
              onClick={() => setSharePopoverOpen(!sharePopoverOpen)}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-[var(--wk-brand)] text-white text-[13px] font-bold hover:opacity-90 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-share-forward-line text-[15px]" />
              Share
              {totalShares > 0 && (
                <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-[6px] rounded-full bg-white/20 text-white text-[11px] font-bold">
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