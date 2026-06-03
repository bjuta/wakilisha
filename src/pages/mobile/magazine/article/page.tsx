import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useMagazineArticle, useMagazineArticles, type MagazineArticle } from "@/services/magazineArticles";

function formatReadCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

export default function MobileArticle() {
  const { slug } = useParams<{ slug: string }>();
  const { article, loading, error } = useMagazineArticle(slug);
  const { articles: allArticles } = useMagazineArticles();
  const [copyToast, setCopyToast] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setCopyToast(false);
  }, [slug]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--wk-brand)] border-t-transparent" />
          <p className="text-sm text-[var(--wk-text-muted)]">Loading article…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="text-center">
          <i className="ri-article-line mb-3 block text-4xl text-[var(--wk-text-faint)]" />
          <p className="text-[var(--wk-text-muted)]">{error}</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="text-center">
          <i className="ri-article-line mb-3 block text-4xl text-[var(--wk-text-faint)]" />
          <p className="text-[var(--wk-text-muted)]">Article not found</p>
        </div>
      </div>
    );
  }

  const relatedStories = allArticles
    .filter((s) => s.slug !== article.slug && s.section === article.section)
    .slice(0, 3);

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2000);
  };

  return (
    <article className="min-h-screen bg-[var(--wk-bg)]">
      {/* Reading progress */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[2px] bg-transparent">
        <div
          className="h-full bg-[var(--wk-brand)] origin-left"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      {/* Article Hero */}
      <section className="relative min-h-[70dvh] flex items-end overflow-hidden">
        {article.heroUrl && (
          <>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${article.heroUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-black/60 to-black/20" />
          </>
        )}

        <div className="absolute top-0 left-0 right-0 z-10 px-5 py-4">
          <div className="flex items-center justify-between">
            <Link
              to="/magazine"
              className="flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white/80 backdrop-blur-md transition-colors hover:bg-black/40"
            >
              <i className="ri-arrow-left-line" />
              Magazine
            </Link>
            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-[11px] font-bold text-white/80 backdrop-blur-md transition-colors hover:bg-black/40 whitespace-nowrap"
              >
                <i className="ri-share-line" />
                Share
              </button>
              {copyToast && (
                <span className="rounded-full bg-[var(--wk-brand)] px-2 py-1 text-[10px] font-bold text-[var(--wk-brand-on)]">
                  Copied
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="relative w-full px-5 pb-10 pt-20">
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-full bg-[var(--wk-brand)] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--wk-brand-on)]">
              {article.section}
            </span>
            {article.readingTime && (
              <span className="text-[12px] font-medium text-white/60">
                {article.readingTime} min read
              </span>
            )}
          </div>
          <h1
            className="mb-4 max-w-lg font-black leading-[0.92] tracking-[-0.04em] text-white"
            style={{ fontSize: "clamp(32px, 8vw, 48px)" }}
          >
            {article.title}
          </h1>
          {article.dek && (
            <p className="max-w-md text-[16px] leading-relaxed text-white/70">
              {article.dek}
            </p>
          )}
          <div className="mt-6 flex items-center gap-3 text-[12px] text-white/60">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[10px] font-bold text-[var(--wk-brand-on)]">
              {article.author.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <span className="font-semibold text-white/90">{article.author}</span>
            <span>·</span>
            <span>{article.date}</span>
            {article.readCount > 0 && (
              <>
                <span>·</span>
                <span>{formatReadCount(article.readCount)} reads</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Article Body */}
      <div className="px-5 py-10">
        <div
          className="article-content-v2-mobile max-w-none text-[16px] leading-[1.8]"
          style={{ color: "var(--wk-text-soft)" }}
          dangerouslySetInnerHTML={{ __html: article.contentHtml }}
        />

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--wk-text-muted)]">
              Topics
            </span>
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-1 text-[11px] font-semibold text-[var(--wk-text-soft)]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Share + subscribe */}
        <div className="mt-10 flex flex-col items-center gap-4 border-t border-[var(--wk-divider)] pt-8 text-center">
          <div>
            <p className="text-[15px] font-bold text-[var(--wk-text)]">Enjoyed this story?</p>
            <p className="mt-1 text-[13px] text-[var(--wk-text-muted)]">
              Share it or explore more from the WAKILISHA editorial graph.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2.5 text-[13px] font-semibold text-[var(--wk-text)] whitespace-nowrap active:scale-[0.97] transition-transform"
            >
              <i className="ri-share-line" />
              Copy link
            </button>
            <Link
              to="/magazine"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-4 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)] whitespace-nowrap active:scale-[0.97] transition-transform"
            >
              More stories
              <i className="ri-arrow-right-line" />
            </Link>
          </div>
        </div>
      </div>

      {/* Read Next */}
      {relatedStories.length > 0 && (
        <section className="border-t border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] py-10">
          <div className="px-5">
            <div className="mb-6 flex items-center gap-3">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
                <span className="w-5 h-px bg-[var(--wk-brand)]" />
                Read next
              </div>
              <div className="h-px flex-1 bg-[var(--wk-divider)]" />
            </div>
            <div className="space-y-4">
              {relatedStories.map((story) => (
                <Link
                  key={story.slug}
                  to={`/magazine/${story.slug}`}
                  className="group flex gap-3 active:scale-[0.98] active:opacity-80 transition-all"
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                    <img
                      src={story.heroUrl}
                      alt={story.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">
                      {story.section}
                    </span>
                    <h3 className="mt-1 text-[15px] font-bold leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-2">
                      {story.title}
                    </h3>
                    <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">
                      {story.author} · {story.readingTime} min
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer CTA */}
      <section className="py-12 px-5 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)] mb-3">
          WAKILISHA Magazine
        </p>
        <h3 className="text-[20px] font-bold leading-tight tracking-[-0.02em] text-[var(--wk-text)] mb-4">
          Stories that move East African culture forward.
        </h3>
        <Link
          to="/magazine"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] whitespace-nowrap active:scale-[0.97] transition-transform"
        >
          Explore all stories
          <i className="ri-arrow-right-line" />
        </Link>
      </section>
    </article>
  );
}