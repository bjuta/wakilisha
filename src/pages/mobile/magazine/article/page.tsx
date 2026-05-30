import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { STORIES } from "@/mocks/magazine";

function formatReadCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

export default function MobileArticle() {
  const { slug } = useParams<{ slug: string }>();
  const article = STORIES.find((s) => s.slug === slug);
  const [copyToast, setCopyToast] = useState(false);

  useEffect(() => {
    setCopyToast(false);
  }, [slug]);

  if (!article) {
    return (
      <div className="px-5 py-20 text-center">
        <i className="ri-article-line mb-3 block text-4xl text-[var(--wk-text-faint)]" />
        <p className="text-[var(--wk-text-muted)]">Article not found</p>
      </div>
    );
  }

  const relatedStories = STORIES.filter(
    (s) => s.slug !== article.slug && s.section === article.section
  ).slice(0, 3);

  const pullQuotes = article.body
    ?.map((p, i) => (i === 1 || i === 3 ? p : null))
    .filter(Boolean) || [];

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2000);
  };

  return (
    <article className="min-h-screen">
      {/* Article Hero — full cinematic, same as desktop */}
      <section className="relative min-h-[60dvh] flex items-end overflow-hidden">
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/15" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />
          </>
        )}

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-10 px-5 py-4">
          <div className="flex items-center justify-between">
            <Link
              to="/magazine"
              className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-white/60 transition-colors hover:text-white"
            >
              <i className="ri-arrow-left-line" />
              Magazine
            </Link>
            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/80 backdrop-blur-sm transition-colors hover:bg-white/20 whitespace-nowrap"
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
            <span className="rounded-full bg-[var(--wk-brand)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-brand-on)]">
              {article.section}
            </span>
            {article.readingTime && (
              <span className="text-[12px] font-medium text-white/60">
                {article.readingTime} min read
              </span>
            )}
          </div>
          <h1
            className="mb-4 max-w-lg font-black leading-[0.92] tracking-[-0.04em]"
            style={{ color: "#F0EFE8", fontSize: "clamp(28px, 8vw, 44px)" }}
          >
            {article.title}
          </h1>
          {article.dek && (
            <p className="max-w-md text-[15px] leading-relaxed" style={{ color: "rgba(240,239,232,.75)" }}>
              {article.dek}
            </p>
          )}
          <div className="mt-6 flex items-center gap-3 text-[12px]" style={{ color: "rgba(240,239,232,.55)" }}>
            <span className="font-semibold" style={{ color: "rgba(240,239,232,.85)" }}>
              {article.author}
            </span>
            <span>·</span>
            <span>{article.date}</span>
            {article.readCount && (
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
        {/* Lead paragraph with drop cap */}
        {article.body && article.body.length > 0 && (
          <p className="text-[16px] leading-[1.8] text-[var(--wk-text)]">
            <span
              className="float-left mr-3 mt-1 font-black leading-none text-[var(--wk-brand)]"
              style={{ fontSize: "clamp(40px, 8vw, 56px)" }}
            >
              {article.body[0].charAt(0)}
            </span>
            {article.body[0].slice(1)}
          </p>
        )}

        {/* Rest of body */}
        <div className="mt-6 space-y-6">
          {article.body?.slice(1).map((paragraph, index) => {
            const pq = pullQuotes[index];
            return (
              <div key={index}>
                <p className="text-[15px] leading-[1.8] text-[var(--wk-text-soft)]">
                  {paragraph}
                </p>
                {pq && index % 2 === 0 && (
                  <blockquote className="my-6 border-l-4 border-[var(--wk-brand)] pl-4">
                    <p className="text-[18px] font-bold leading-snug tracking-[-0.01em] text-[var(--wk-text)]">
                      "{pq}"
                    </p>
                  </blockquote>
                )}
              </div>
            );
          })}
        </div>

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
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

        {/* Related in the graph */}
        {article.relatedEntities && article.relatedEntities.length > 0 && (
          <div className="mt-10 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
            <h3 className="mb-4 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
              Related in the graph
            </h3>
            <div className="flex flex-wrap gap-2">
              {article.relatedEntities.map((entity) => (
                <Link
                  key={entity.slug}
                  to={`/${
                    entity.type === "track"
                      ? "tracks"
                      : entity.type === "release"
                      ? "releases"
                      : entity.type === "chart"
                      ? "charts"
                      : entity.type === "genre"
                      ? "genres"
                      : "artists"
                  }/${entity.slug}`}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-1.5 text-[12px] font-semibold text-[var(--wk-text)]"
                >
                  <i
                    className={
                      entity.type === "artist"
                        ? "ri-user-line"
                        : entity.type === "release"
                        ? "ri-album-line"
                        : entity.type === "track"
                        ? "ri-music-2-line"
                        : entity.type === "genre"
                        ? "ri-folder-music-line"
                        : "ri-bar-chart-line"
                    }
                  />
                  {entity.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Share + subscribe */}
        <div className="mt-10 flex flex-col items-center gap-4 border-t border-[var(--wk-divider)] pt-8 text-center">
          <div>
            <p className="text-[14px] font-semibold text-[var(--wk-text)]">Enjoyed this story?</p>
            <p className="text-[13px] text-[var(--wk-text-muted)]">
              Share it or explore more from the WAKILISHA editorial graph.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2.5 text-[13px] font-semibold text-[var(--wk-text)] whitespace-nowrap"
            >
              <i className="ri-share-line" />
              Copy link
            </button>
            <Link
              to="/magazine"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-4 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)] whitespace-nowrap"
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
                  className="group flex gap-3"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                    <img src={story.heroUrl} alt={story.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">{story.section}</span>
                    <h3 className="mt-0.5 text-[14px] font-bold leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors">
                      {story.title}
                    </h3>
                    <div className="mt-1 text-[10px] text-[var(--wk-text-faint)]">
                      {story.author} · {story.readingTime} min
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}