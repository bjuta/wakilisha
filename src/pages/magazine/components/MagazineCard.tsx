import { Link } from "react-router-dom";
import { getAuthorMeta } from "@/services/authorProfiles";
import type { MagazineArticle } from "@/services/magazineArticles";

interface MagazineCardProps {
  story: MagazineArticle;
  variant?: "hero" | "standard" | "compact" | "featured";
  rank?: number;
}

function AuthorBadge({ author }: { author: string }) {
  return (
    <div className="w-5 h-5 rounded-full bg-[var(--wk-brand)] flex items-center justify-center text-[8px] font-black text-[var(--wk-brand-on)] shrink-0">
      {author
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)}
    </div>
  );
}

export function MagazineCard({ story, variant = "standard", rank }: MagazineCardProps) {
  const authorMeta = getAuthorMeta(story.author);
  const url = `/magazine/${story.slug}`;
  const authorUrl = `/authors/${authorMeta.slug}`;

  /* ── hero: large dark-overlay card, for primary featured spots ── */
  if (variant === "hero") {
    return (
      <Link
        to={url}
        className="group relative overflow-hidden rounded-2xl bg-[#0a0a0a] flex flex-col h-full"
        style={{ minHeight: "clamp(340px, 42vw, 480px)" }}
      >
        <img
          src={story.heroUrl}
          alt={story.title}
          className="absolute inset-0 w-full h-full object-cover object-top opacity-90 transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />

        {rank !== undefined && (
          <span className="absolute top-4 left-4 z-10 w-8 h-8 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[12px] font-black flex items-center justify-center shadow-lg">
            {rank}
          </span>
        )}

        {/* Bookmark icon */}
        <div className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/25 backdrop-blur-sm flex items-center justify-center text-white/60 hover:text-white/90 transition-colors cursor-pointer">
          <i className="ri-bookmark-line text-[14px]" />
        </div>

        <div className="relative z-10 mt-auto p-6 lg:p-8 text-white">
          <span className="inline-block mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)] bg-black/20 backdrop-blur-sm px-2.5 py-1 rounded-full">
            {story.section}
          </span>
          <h3 className="text-[clamp(20px,2.6vw,30px)] font-black tracking-[-0.04em] leading-[1.06] mb-3 line-clamp-3 group-hover:text-white/90 transition-colors">
            {story.title}
          </h3>
          {story.dek && (
            <p className="text-[13px] lg:text-[14px] leading-relaxed text-white/55 mb-4 line-clamp-2 max-w-[48ch]">
              {story.dek}
            </p>
          )}
          <div className="flex items-center gap-2.5 text-[12px] text-white/45">
            <Link
              to={authorUrl}
              className="flex items-center gap-2 hover:text-white/80 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <AuthorBadge author={story.author} />
              <span className="font-semibold text-white/70">{story.author}</span>
            </Link>
            <span className="text-white/20">·</span>
            <span>{story.readingTime} min read</span>
          </div>
        </div>
      </Link>
    );
  }

  /* ── featured: horizontal split card, image left / content right ── */
  if (variant === "featured") {
    return (
      <Link
        to={url}
        className="group flex flex-col sm:flex-row gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 hover:border-[var(--wk-border-strong)] hover:bg-[var(--wk-surface-raised)] transition-all duration-300"
      >
        <div className="sm:w-[45%] shrink-0 aspect-[16/10] sm:aspect-auto sm:h-full rounded-lg overflow-hidden bg-[var(--wk-surface-raised)]">
          <img
            src={story.heroUrl}
            alt=""
            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <div className="flex flex-col gap-2 min-w-0 flex-1 justify-center py-0.5">
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
            {story.section}
          </span>
          <h3 className="text-[16px] lg:text-[17px] font-black tracking-[-0.025em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-3">
            {story.title}
          </h3>
          {story.dek && (
            <p className="text-[12px] lg:text-[13px] leading-relaxed text-[var(--wk-text-soft)] line-clamp-2">
              {story.dek}
            </p>
          )}
          <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)] mt-auto pt-1">
            <Link
              to={authorUrl}
              className="font-semibold hover:text-[var(--wk-brand)] transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {story.author}
            </Link>
            <span className="text-[var(--wk-border-strong)]">·</span>
            <span>{story.readingTime} min</span>
          </div>
        </div>
      </Link>
    );
  }

  /* ── compact: tight horizontal card for lists, thumb right ── */
  if (variant === "compact") {
    return (
      <Link
        to={url}
        className="group flex gap-3.5 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 hover:border-[var(--wk-border-strong)] hover:bg-[var(--wk-surface-raised)] transition-all duration-300"
      >
        {rank !== undefined && (
          <span className="text-[20px] font-black text-[var(--wk-brand)] opacity-25 leading-none shrink-0 pt-1 w-5 text-center">
            {rank}
          </span>
        )}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
            {story.section}
          </span>
          <h4 className="text-[14px] font-bold tracking-[-0.02em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-2">
            {story.title}
          </h4>
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--wk-text-faint)]">
            <Link
              to={authorUrl}
              className="font-semibold hover:text-[var(--wk-brand)] transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {story.author}
            </Link>
            <span className="text-[var(--wk-border-strong)]">·</span>
            <span>{story.readingTime} min</span>
          </div>
        </div>
        <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-[var(--wk-surface-raised)]">
          <img
            src={story.heroUrl}
            alt=""
            className="w-full h-full object-cover object-top transition-transform duration-400 group-hover:scale-110"
          />
        </div>
      </Link>
    );
  }

  /* ── standard: vertical card, image top, default workhorse ── */
  return (
    <Link
      to={url}
      className="group flex flex-col rounded-xl overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-surface)] hover:border-[var(--wk-border-strong)] hover:-translate-y-0.5 transition-all duration-300 h-full"
    >
      <div className="aspect-[16/10] overflow-hidden bg-[var(--wk-surface-raised)]">
        <img
          src={story.heroUrl}
          alt=""
          className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="p-4 lg:p-5 flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
            {story.section}
          </span>
          {rank !== undefined && (
            <span className="text-[10px] font-bold text-[var(--wk-text-faint)]">
              #{rank}
            </span>
          )}
        </div>
        <h3 className="text-[15px] lg:text-[16px] font-black tracking-[-0.02em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-2">
          {story.title}
        </h3>
        {story.dek && (
          <p className="text-[12px] leading-relaxed text-[var(--wk-text-soft)] line-clamp-2 hidden lg:block">
            {story.dek}
          </p>
        )}
        <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)] mt-auto pt-1">
          <Link
            to={authorUrl}
            className="font-semibold hover:text-[var(--wk-brand)] transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {story.author}
          </Link>
          <span className="text-[var(--wk-border-strong)]">·</span>
          <span>{story.readingTime} min</span>
        </div>
      </div>
    </Link>
  );
}