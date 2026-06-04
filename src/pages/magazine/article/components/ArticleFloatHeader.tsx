import { useState } from "react";
import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { getAuthorMeta } from "@/services/authorProfiles";
import type { MagazineArticle } from "@/services/magazineArticles";

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
  const [copyDone, setCopyDone] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2500);
  };

  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(`${article.title} ${typeof window !== "undefined" ? window.location.href : ""}`)}`;
  const authorMeta = getAuthorMeta(article.author);
  const initials = article.author.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

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
            to={`/authors/${authorMeta.slug}`}
            className="w-11 h-11 rounded-full bg-[var(--wk-brand)] flex items-center justify-center text-[13px] font-black text-[var(--wk-brand-on)] hover:opacity-80 transition-opacity shrink-0"
          >
            {initials}
          </Link>
          <div>
            <Link
              to={`/authors/${authorMeta.slug}`}
              className="text-[14px] font-bold text-[var(--wk-text)] hover:text-[var(--wk-brand)] transition-colors block leading-tight"
            >
              {article.author}
            </Link>
            <span className="text-[12px] text-[var(--wk-text-muted)]">{article.date}</span>
          </div>
        </div>

        {/* Share actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="h-8 px-3.5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[12px] font-semibold text-[var(--wk-text-soft)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <i className="ri-link-m text-[13px]" />
            {copyDone ? "Copied!" : "Copy link"}
          </button>
          <a
            href={tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 w-8 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] flex items-center justify-center text-[var(--wk-text-soft)] hover:border-[#000] hover:text-[#000] transition-all"
            aria-label="Share on X"
          >
            <i className="ri-twitter-x-line text-[12px]" />
          </a>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 w-8 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] flex items-center justify-center text-[var(--wk-text-soft)] hover:border-[#25D366] hover:text-[#25D366] transition-all"
            aria-label="Share on WhatsApp"
          >
            <i className="ri-whatsapp-line text-[12px]" />
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 w-8 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] flex items-center justify-center text-[var(--wk-text-soft)] hover:border-[#1877F2] hover:text-[#1877F2] transition-all"
            aria-label="Share on Facebook"
          >
            <i className="ri-facebook-circle-line text-[12px]" />
          </a>
        </div>
      </div>
    </div>
  );
}