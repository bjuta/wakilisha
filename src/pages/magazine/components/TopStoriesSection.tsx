import { Link } from "react-router-dom";
import { getAuthorMeta } from "@/services/authorProfiles";
import type { MagazineArticle } from "@/services/magazineArticles";

interface TopStoriesSectionProps {
  stories: MagazineArticle[];
}

/**
 * NYT-inspired top stories: big overlay card left + compact list right.
 * Layout: [BIG CARD] [list of 3 compact items]
 */
export function TopStoriesSection({ stories }: TopStoriesSectionProps) {
  if (stories.length < 2) return null;

  const [primary, ...rest] = stories;
  const listItems = rest.slice(0, 3);

  return (
    <section className="px-1">
      {/* Section header */}
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-2">
            <span className="w-7 h-px bg-[var(--wk-brand)]" />
            Top stories
          </div>
          <h2 className="text-[28px] lg:text-[34px] font-black tracking-[-0.04em] text-[var(--wk-text)] leading-tight">
            What you should read
          </h2>
        </div>
        <Link
          to="/magazine"
          className="text-[13px] font-bold text-[var(--wk-brand)] hover:text-[var(--wk-brand-2)] transition-colors flex items-center gap-1.5 whitespace-nowrap"
        >
          Show all
          <i className="ri-arrow-right-line" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-6 items-stretch">
        {/* ── Big overlay card ── */}
        <Link
          to={`/magazine/${primary.slug}`}
          className="group relative overflow-hidden rounded-2xl bg-[#0a0a0a] flex flex-col min-h-[440px] lg:min-h-[520px]"
        >
          <img
            src={primary.heroUrl}
            alt={primary.title}
            className="absolute inset-0 w-full h-full object-cover object-top opacity-80 transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

          {/* Bookmark icon top-right */}
          <div className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/70">
            <i className="ri-bookmark-line text-[14px]" />
          </div>

          {/* Content overlay at bottom */}
          <div className="relative z-10 mt-auto p-6 lg:p-8 text-white">
            <span className="inline-block mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">
              {primary.section}
            </span>
            <h3 className="text-[clamp(22px,3.2vw,36px)] font-black tracking-[-0.04em] leading-[1.02] mb-3 group-hover:text-white/90 transition-colors">
              {primary.title}
            </h3>
            {primary.dek && (
              <p className="text-[14px] leading-relaxed text-white/65 mb-5 line-clamp-2 max-w-[48ch]">
                {primary.dek}
              </p>
            )}
            <div className="flex items-center gap-2.5 text-[12px] text-white/55">
              <Link
                to={`/authors/${getAuthorMeta(primary.author).slug}`}
                className="flex items-center gap-2 hover:text-white/80 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-6 h-6 rounded-full bg-[var(--wk-brand)] flex items-center justify-center text-[9px] font-black text-[var(--wk-brand-on)] shrink-0">
                  {primary.author.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <span className="font-semibold text-white/80">{primary.author}</span>
              </Link>
              <span className="text-white/30">·</span>
              <span className="flex items-center gap-1">
                <i className="ri-time-line" /> {primary.readingTime} min
              </span>
              {primary.date && (
                <>
                  <span className="text-white/30">·</span>
                  <span>{primary.date}</span>
                </>
              )}
            </div>
          </div>
        </Link>

        {/* ── Compact list ── */}
        <div className="flex flex-col gap-0 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
          {listItems.map((story, idx) => (
            <Link
              key={story.slug}
              to={`/magazine/${story.slug}`}
              className={`group flex gap-4 p-5 hover:bg-[var(--wk-surface-raised)] transition-colors ${
                idx < listItems.length - 1 ? "border-b border-[var(--wk-border)]" : ""
              }`}
            >
              {/* Rank number */}
              <div className="shrink-0 w-6 flex items-start pt-0.5">
                <span className="text-[22px] font-black text-[var(--wk-brand)] leading-none opacity-40">
                  {idx + 1}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
                  {story.section}
                </span>
                <h4 className="text-[16px] font-black tracking-[-0.025em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-2">
                  {story.title}
                </h4>
                {story.dek && (
                  <p className="text-[12px] text-[var(--wk-text-muted)] line-clamp-1 leading-relaxed">
                    {story.dek}
                  </p>
                )}
                <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)] mt-1">
                  <span className="font-semibold">{story.author}</span>
                  <span>·</span>
                  <span>{story.readingTime} min read</span>
                </div>
              </div>

              {/* Thumbnail */}
              <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-[var(--wk-surface-raised)]">
                <img
                  src={story.heroUrl}
                  alt=""
                  className="w-full h-full object-cover object-top transition-transform duration-400 group-hover:scale-110"
                />
              </div>
            </Link>
          ))}

          {/* More link at bottom */}
          <div className="p-4 border-t border-[var(--wk-border)]">
            <Link
              to="/magazine"
              className="flex items-center justify-between text-[12px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] transition-colors"
            >
              <span>More stories</span>
              <i className="ri-arrow-right-line" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}