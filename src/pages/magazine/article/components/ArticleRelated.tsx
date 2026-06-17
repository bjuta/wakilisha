import { Link } from "react-router-dom";
import { getAuthorMeta } from "@/services/authorProfiles";
import type { MagazineArticle } from "@/services/magazineArticles";

interface ArticleRelatedProps {
  stories: MagazineArticle[];
  loading: boolean;
  issueContext?: {
    href: string;
    label: string;
    blurb: string;
  };
}

export function ArticleRelated({ stories, loading, issueContext }: ArticleRelatedProps) {
  if (loading) {
    return (
      <section className="border-t border-[var(--wk-border)] bg-[var(--wk-bg)]">
        <div className="max-w-[1180px] mx-auto px-6 lg:px-8 py-16">
          <div className="text-[12px] text-[var(--wk-text-muted)]">Loading related stories…</div>
        </div>
      </section>
    );
  }

  if (!stories.length && !issueContext) return null;

  const [primary, ...rest] = stories;

  return (
    <section className="border-t border-[var(--wk-border)] bg-[var(--wk-bg)]">
      <div className="max-w-[1180px] mx-auto px-6 lg:px-8 py-14">
        <div className="flex items-end justify-between mb-10 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-2">
              <span className="w-7 h-px bg-[var(--wk-brand)]" />
              Continue the thread
            </div>
            <h2 className="text-[28px] lg:text-[34px] font-black tracking-[-0.04em] text-[var(--wk-text)]">
              {issueContext ? "Open the issue around this story" : "More you might like"}
            </h2>
          </div>
          <Link to="/magazine" className="text-[13px] font-bold text-[var(--wk-brand)] hover:text-[var(--wk-brand-2)] transition-colors flex items-center gap-1.5 whitespace-nowrap">
            All stories <i className="ri-arrow-right-line" />
          </Link>
        </div>

        {issueContext && (
          <Link to={issueContext.href} className="group mb-6 block rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 transition-all hover:-translate-y-0.5 hover:border-[var(--wk-brand)]">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)] mb-2">{issueContext.label}</div>
            <p className="text-[15px] leading-relaxed text-[var(--wk-text-soft)] max-w-[74ch]">{issueContext.blurb}</p>
            <span className="mt-4 inline-flex text-[11px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">Start here</span>
          </Link>
        )}

        {stories.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {primary && (
              <Link to={`/magazine/${primary.slug}`} className="group flex flex-col rounded-2xl overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-surface)] hover:border-[var(--wk-border-2)] transition-all duration-300 hover:-translate-y-1">
                <div className="relative aspect-[16/9] overflow-hidden bg-[var(--wk-surface-raised)]">
                  {primary.heroUrl && <img src={primary.heroUrl} alt={primary.title} className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute top-4 left-4 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[9px] font-black uppercase tracking-[0.18em] px-3 py-1">
                    {primary.section}
                  </span>
                </div>
                <div className="p-6 flex-1 flex flex-col gap-3">
                  <h3 className="text-[20px] font-black tracking-[-0.03em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-2">{primary.title}</h3>
                  {primary.dek && <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)] line-clamp-2">{primary.dek}</p>}
                  <div className="flex items-center gap-2 text-[12px] text-[var(--wk-text-faint)] mt-auto">
                    <Link to={`/authors/${getAuthorMeta(primary.author).slug}`} className="font-semibold hover:text-[var(--wk-brand)] transition-colors">{primary.author}</Link>
                    <span>·</span><span>{primary.readingTime} min read</span><span>·</span><span>{primary.date}</span>
                  </div>
                </div>
              </Link>
            )}

            <div className="flex flex-col gap-5 justify-between">
              {rest.slice(0, 2).map((story) => (
                <Link key={story.slug} to={`/magazine/${story.slug}`} className="group flex gap-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 hover:border-[var(--wk-border-2)] transition-all duration-300 hover:-translate-y-0.5">
                  <div className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-[var(--wk-surface-raised)]">
                    {story.heroUrl && <img src={story.heroUrl} alt={story.title} className="w-full h-full object-cover object-top transition-transform duration-400 group-hover:scale-110" />}
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">{story.section}</span>
                    <h4 className="text-[16px] font-bold tracking-[-0.02em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-2">{story.title}</h4>
                    {story.dek && <p className="text-[12px] text-[var(--wk-text-muted)] line-clamp-1">{story.dek}</p>}
                    <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)] mt-auto"><span className="font-semibold">{story.author}</span><span>·</span><span>{story.readingTime} min</span></div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
