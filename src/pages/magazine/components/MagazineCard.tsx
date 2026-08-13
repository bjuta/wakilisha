import { Link, useNavigate } from "react-router-dom";
import { getAuthorMeta } from "@/services/authorProfiles";
import type { MagazineArticle } from "@/services/magazineArticles";
import { Chapter19FallbackImage } from "@/components/media/Chapter19FallbackImage";
import { ResponsiveMediaImage } from "@/components/media/ResponsiveMediaImage";

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

function whyThisStoryMatters(story: MagazineArticle) {
  if (story.dek) return story.dek;
  if (story.section) return `This opens a ${story.section.toLowerCase()} thread inside the magazine.`;
  return "This story gives the issue another way in.";
}

export function MagazineCard({ story, variant = "standard", rank }: MagazineCardProps) {
  const authorMeta = getAuthorMeta(story.author);
  const url = `/magazine/${story.slug}`;
  const authorUrl = `/authors/${authorMeta.slug}`;
  const why = whyThisStoryMatters(story);
  const navigate = useNavigate();

  const handleAuthorClick = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    navigate(authorUrl);
  };

  const handleAuthorKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    navigate(authorUrl);
  };

  /* ── hero: large dark-overlay card, for primary featured spots ── */
  if (variant === "hero") {
    return (
      <Link
        to={url}
        className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-[#0a0a0a] outline-none transition-transform duration-500 hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:ring-2 focus-visible:ring-[var(--wk-brand)]"
        style={{ minHeight: "clamp(340px, 42vw, 480px)" }}
      >
        {story.heroUrl ? (
          <ResponsiveMediaImage
            src={story.heroUrl}
            preset="lead"
            alt={story.title}
            loading="lazy"
            fetchPriority="low"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-top opacity-90 transition-transform duration-700 group-hover:scale-105 group-hover:rotate-[0.35deg] group-focus-visible:scale-105"
          />
        ) : (
          <Chapter19FallbackImage
            id={story.id}
            slug={story.slug}
            name={story.title}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />

        {rank !== undefined && (
          <span className="absolute left-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[12px] font-black text-[var(--wk-brand-on)] shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6">
            {rank}
          </span>
        )}

        {/* Bookmark icon */}
        <div className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/25 text-white/60 backdrop-blur-sm transition-colors hover:text-white/90">
          <i className="ri-bookmark-line text-[14px]" />
        </div>

        <div className="relative z-10 mt-auto p-6 text-white lg:p-8">
          <span className="inline-block rounded-full bg-black/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)] backdrop-blur-sm transition-transform duration-300 group-hover:-translate-y-0.5">
            {story.section}
          </span>
          <h3 className="mb-3 mt-3 line-clamp-3 text-[clamp(20px,2.6vw,30px)] font-black leading-[1.06] tracking-[-0.04em] transition-colors group-hover:text-white/90">
            {story.title}
          </h3>
          <p className="max-w-[52ch] text-[13px] leading-relaxed text-white/55 line-clamp-2 lg:text-[14px]">
            {why}
          </p>
          <div className="mt-4 flex items-center gap-2.5 text-[12px] text-white/45">
            <span
              role="link"
              tabIndex={0}
              className="flex items-center gap-2 transition-colors hover:text-white/80 cursor-pointer"
              onClick={handleAuthorClick}
              onKeyDown={handleAuthorKeyDown}
            >
              <AuthorBadge author={story.author} />
              <span className="font-semibold text-white/70">{story.author}</span>
            </span>
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
        className="group flex flex-col gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--wk-border-strong)] hover:bg-[var(--wk-surface-raised)] focus-visible:-translate-y-1 focus-visible:ring-2 focus-visible:ring-[var(--wk-brand)] sm:flex-row"
      >
        <div className="aspect-[16/10] shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)] sm:h-full sm:w-[45%] sm:aspect-auto">
          {story.heroUrl ? (
            <ResponsiveMediaImage
              src={story.heroUrl}
              preset="feature"
              alt={story.title}
              loading="lazy"
            fetchPriority="low"
            decoding="async"
              className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105 group-hover:rotate-[0.3deg]"
            />
          ) : (
            <Chapter19FallbackImage
              id={story.id}
              slug={story.slug}
              name={story.title}
              className="rounded-lg"
            />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 py-0.5">
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
            {story.section}
          </span>
          <h3 className="line-clamp-3 text-[16px] font-black leading-snug tracking-[-0.025em] text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)] lg:text-[17px]">
            {story.title}
          </h3>
          <p className="line-clamp-2 text-[12px] leading-relaxed text-[var(--wk-text-soft)] lg:text-[13px]">
            {why}
          </p>
          <div className="mt-auto flex items-center gap-2 pt-1 text-[11px] text-[var(--wk-text-faint)]">
            <span
              role="link"
              tabIndex={0}
              className="font-semibold transition-colors hover:text-[var(--wk-brand)] cursor-pointer"
              onClick={handleAuthorClick}
              onKeyDown={handleAuthorKeyDown}
            >
              {story.author}
            </span>
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
        className="group flex gap-3.5 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--wk-border-strong)] hover:bg-[var(--wk-surface-raised)] focus-visible:ring-2 focus-visible:ring-[var(--wk-brand)]"
      >
        {rank !== undefined && (
          <span className="w-5 shrink-0 pt-1 text-center text-[20px] font-black leading-none text-[var(--wk-brand)] opacity-25 transition-all duration-300 group-hover:opacity-70">
            {rank}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
            {story.section}
          </span>
          <h4 className="line-clamp-3 text-[14px] font-bold leading-snug tracking-[-0.02em] text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)]">
            {story.title}
          </h4>
          <span className="hidden text-[10px] font-bold text-[var(--wk-brand)] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 sm:inline">
            Why it matters: {why}
          </span>
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--wk-text-faint)]">
            <span
              role="link"
              tabIndex={0}
              className="font-semibold transition-colors hover:text-[var(--wk-brand)] cursor-pointer"
              onClick={handleAuthorClick}
              onKeyDown={handleAuthorKeyDown}
            >
              {story.author}
            </span>
            <span className="text-[var(--wk-border-strong)]">·</span>
            <span>{story.readingTime} min</span>
          </div>
        </div>
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
          {story.heroUrl ? (
            <ResponsiveMediaImage
              src={story.heroUrl}
              preset="thumbnail"
              alt={story.title}
              loading="lazy"
            fetchPriority="low"
            decoding="async"
              className="h-full w-full object-cover object-top transition-transform duration-400 group-hover:scale-110 group-hover:rotate-[1deg]"
            />
          ) : (
            <Chapter19FallbackImage
              id={story.id}
              slug={story.slug}
              name={story.title}
            />
          )}
        </div>
      </Link>
    );
  }

  /* ── standard: vertical card, image top, default workhorse ── */
  return (
    <Link
      to={url}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--wk-border-strong)] hover:shadow-xl focus-visible:ring-2 focus-visible:ring-[var(--wk-brand)]"
    >
      <div className="aspect-[16/10] overflow-hidden bg-[var(--wk-surface-raised)]">
        {story.heroUrl ? (
          <ResponsiveMediaImage
            src={story.heroUrl}
            preset="card"
            alt={story.title}
            loading="lazy"
            fetchPriority="low"
            decoding="async"
            className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105 group-hover:rotate-[0.35deg]"
          />
        ) : (
          <Chapter19FallbackImage
            id={story.id}
            slug={story.slug}
            name={story.title}
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4 lg:p-5">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)] transition-transform duration-300 group-hover:-translate-y-0.5">
            {story.section}
          </span>
          {rank !== undefined && (
            <span className="text-[10px] font-bold text-[var(--wk-text-faint)] transition-colors duration-300 group-hover:text-[var(--wk-brand)]">
              #{rank}
            </span>
          )}
        </div>
        <h3 className="line-clamp-3 text-[15px] font-black leading-snug tracking-[-0.02em] text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)] lg:text-[16px]">
          {story.title}
        </h3>
        <p className="hidden text-[12px] leading-relaxed text-[var(--wk-text-soft)] line-clamp-2 lg:block">
          {why}
        </p>
        <div className="mt-auto flex items-center gap-2 pt-1 text-[11px] text-[var(--wk-text-faint)]">
          <span
            role="link"
            tabIndex={0}
            className="font-semibold transition-colors hover:text-[var(--wk-brand)] cursor-pointer"
            onClick={handleAuthorClick}
            onKeyDown={handleAuthorKeyDown}
          >
            {story.author}
          </span>
          <span className="text-[var(--wk-border-strong)]">·</span>
          <span>{story.readingTime} min</span>
        </div>
      </div>
    </Link>
  );
}
