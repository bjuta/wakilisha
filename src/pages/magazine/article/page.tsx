import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMagazineArticle, useMagazineArticles, getRelatedArticles, type MagazineArticle } from "@/services/magazineArticles";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { WkIcon } from "@/components/design-system/Icon";

function sectionMeta(name: string) {
  const palette: Record<string, string> = {
    Analysis: "#C44A3B",
    Focus: "#D97706",
    Industry: "#78716C",
    Culture: "#BE185D",
    Interview: "#256B5A",
    Article: "#334155",
    Guide: "#4F46E5",
  };
  return { color: palette[name] || "var(--wk-brand)" };
}

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const { article, loading: articleLoading, error: articleError } = useMagazineArticle(slug);
  const { articles: allArticles } = useMagazineArticles();
  const [related, setRelated] = useState<MagazineArticle[]>([]);
  const [progress, setProgress] = useState(0);
  const [relatedLoading, setRelatedLoading] = useState(true);

  useEffect(() => {
    if (!article) return;
    let alive = true;
    setRelatedLoading(true);
    getRelatedArticles(article, 3)
      .then((items) => {
        if (!alive) return;
        setRelated(items);
        setRelatedLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setRelated(allArticles.filter((a) => a.slug !== article.slug).slice(0, 3));
        setRelatedLoading(false);
      });
    return () => { alive = false; };
  }, [article, allArticles]);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? window.scrollY / max : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const meta = article ? sectionMeta(article.section) : { color: "var(--wk-brand)" };

  if (articleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--wk-brand)] border-t-transparent" />
          <p className="text-sm font-medium text-[var(--wk-text-muted)]">Loading article…</p>
        </div>
      </div>
    );
  }

  if (articleError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <WkIcon name="AlertCircle" size={32} className="mx-auto mb-3 text-[var(--wk-danger)]" />
          <p className="text-sm text-[var(--wk-text-muted)]">{articleError}</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <WkIcon name="FileX" size={32} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
          <p className="text-sm text-[var(--wk-text-muted)]">Article not found.</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      {/* Reading progress bar */}
      <div className="article-progress">
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>

      {/* Navigation bar */}
      <nav className="absolute top-0 left-0 right-0 z-30 px-6 py-5">
        <div className="flex items-center justify-between">
          <Link
            to="/magazine"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/80 backdrop-blur-md transition-all hover:bg-black/40 hover:text-white"
          >
            <WkIcon name="ArrowLeft" size={14} />
            WAKILISHA Magazine
          </Link>
          <div className="flex items-center gap-2">
            <ShareButton
              item={{
                title: article.title,
                subtitle: article.author,
                description: article.dek,
                imageUrl: article.heroUrl,
                type: "article",
              }}
            />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="article-hero-v2">
        <div className="article-hero-v2-media">
          <img src={article.heroUrl} alt={article.title} className="article-hero-v2-img" />
          <div className="article-hero-v2-overlay" />
        </div>
        <div className="article-hero-v2-content">
          <div className="mx-auto max-w-[860px] text-center">
            <span
              className="mb-6 inline-block rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em]"
              style={{ background: meta.color, color: '#fff' }}
            >
              {article.section}
            </span>
            <h1 className="article-hero-v2-title">{article.title}</h1>
            {article.dek && (
              <p className="article-hero-v2-dek">{article.dek}</p>
            )}
            <div className="article-hero-v2-byline">
              <div className="article-hero-v2-avatar">
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  {article.author.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div className="article-hero-v2-meta">
                <span className="font-semibold text-white/90">{article.author}</span>
                <span className="text-white/40">·</span>
                <span className="text-white/60">{article.date}</span>
                <span className="text-white/40">·</span>
                <span className="text-white/60">{article.readingTime} min read</span>
                {article.readCount > 0 && (
                  <>
                    <span className="text-white/40">·</span>
                    <span className="text-white/60">{article.readCount.toLocaleString()} reads</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Body + Sidebar */}
      <div className="article-shell-v2">
        <article className="article-body-v2">
          <div
            className="article-content-v2"
            dangerouslySetInnerHTML={{ __html: article.contentHtml }}
          />
        </article>

        <aside className="article-sidebar-v2">
          <div className="article-sidebox-v2">
            <div className="article-sidebox-v2-title">Share</div>
            <ShareButton
              item={{
                title: article.title,
                subtitle: article.author,
                description: article.dek,
                imageUrl: article.heroUrl,
                type: "article",
              }}
            />
          </div>

          <div className="article-sidebox-v2">
            <div className="article-sidebox-v2-title">Reading</div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[var(--wk-text-muted)]">Time</span>
                <span className="font-semibold text-[var(--wk-text)]">{article.readingTime} min</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[var(--wk-text-muted)]">Words</span>
                <span className="font-semibold text-[var(--wk-text)]">{article.body.join(' ').split(/\s+/).length.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[var(--wk-text-muted)]">Published</span>
                <span className="font-semibold text-[var(--wk-text)]">{article.date}</span>
              </div>
            </div>
          </div>

          {article.tags?.length > 0 && (
            <div className="article-sidebox-v2">
              <div className="article-sidebox-v2-title">Topics</div>
              <div className="flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-1 text-[11px] font-semibold text-[var(--wk-text-soft)] transition-colors hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="article-sidebox-v2">
            <div className="article-sidebox-v2-title">Related</div>
            <div className="space-y-3">
              {relatedLoading ? (
                <div className="text-[12px] text-[var(--wk-text-muted)]">Loading…</div>
              ) : related.length > 0 ? (
                related.slice(0, 3).map((story) => (
                  <Link
                    key={story.slug}
                    to={`/magazine/${story.slug}`}
                    className="group flex gap-3"
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                      <img src={story.heroUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">{story.section}</span>
                      <p className="mt-0.5 text-[13px] font-semibold leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-2">
                        {story.title}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-[12px] text-[var(--wk-text-muted)]">No related stories.</div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Related stories */}
      <section className="article-related-v2">
        <div className="article-related-v2-header">
          <div className="wk-eyebrow">Continue reading</div>
          <h2 className="article-related-v2-title">Related stories</h2>
        </div>
        <div className="article-related-v2-grid">
          {relatedLoading ? (
            <div className="col-span-full text-center text-[var(--wk-text-muted)]">Loading related stories…</div>
          ) : related.length > 0 ? (
            related.map((story) => <RelatedStoryV2 key={story.slug} story={story} />)
          ) : (
            <div className="col-span-full text-center text-[var(--wk-text-muted)]">No related stories found.</div>
          )}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="article-footer-cta">
        <div className="article-footer-cta-inner">
          <p className="article-footer-cta-label">WAKILISHA Magazine</p>
          <h3 className="article-footer-cta-title">Stories that move East African culture forward.</h3>
          <Link to="/magazine" className="wk-button wk-button-primary">
            Explore all stories
            <WkIcon name="ArrowRight" size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}

function RelatedStoryV2({ story }: { story: MagazineArticle }) {
  return (
    <Link to={`/magazine/${story.slug}`} className="group block">
      <div className="overflow-hidden rounded-xl bg-[var(--wk-surface)] border border-[var(--wk-border)] transition-all duration-300 hover:border-[var(--wk-border-2)] hover:-translate-y-1">
        <div className="aspect-[16/10] overflow-hidden bg-[var(--wk-surface-raised)]">
          <img
            src={story.heroUrl}
            alt={story.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <div className="p-5">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            {story.section}
          </span>
          <h3 className="mt-2 text-[18px] font-bold leading-snug tracking-[-0.02em] text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-2">
            {story.title}
          </h3>
          <div className="mt-3 flex items-center gap-2 text-[12px] text-[var(--wk-text-muted)]">
            <span className="font-medium">{story.author}</span>
            <span>·</span>
            <span>{story.readingTime} min</span>
          </div>
        </div>
      </div>
    </Link>
  );
}