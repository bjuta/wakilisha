import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { StoryCard } from "@/components/design-system/editorial/StoryCard";
import { STORIES } from "@/mocks/magazine";

function formatReadCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const article = STORIES.find((s) => s.slug === slug);
  const [copyToast, setCopyToast] = useState(false);
  const [showFullLyrics, setShowFullLyrics] = useState(false);

  useEffect(() => {
    setCopyToast(false);
    window.scrollTo(0, 0);
  }, [slug]);

  if (!article) {
    return (
      <div className="wk-container px-6 py-20 text-center">
        <i className="ri-article-line mb-4 block text-5xl text-[var(--wk-text-faint)]" />
        <h1 className="wk-h-section mb-2">Article not found</h1>
        <p className="text-[var(--wk-text-muted)]">This story does not exist in the registry.</p>
        <Link to="/magazine" className="mt-6 inline-block">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-4 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)] transition-all hover:brightness-110 whitespace-nowrap">
            Back to magazine
          </span>
        </Link>
      </div>
    );
  }

  const relatedStories = STORIES.filter(
    (s) => s.slug !== article.slug && s.section === article.section
  ).slice(0, 3);

  const pullQuotes = article.body
    ?.map((p, i) => (i === 1 || i === 3 || i === 5 ? p : null))
    .filter(Boolean) || [];

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2000);
  };

  return (
    <article>
      {/* ============================================================ */}
      {/*  ARTICLE HERO — split layout, image as design element        */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden">
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-10">
          <div className="wk-container flex items-center justify-between px-6 py-5">
            <Link
              to="/magazine"
              className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-white/60 transition-colors hover:text-white"
            >
              <i className="ri-arrow-left-line" />
              WAKILISHA Magazine
            </Link>
            <div className="flex items-center gap-3">
              <button
                onClick={handleShare}
                className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/80 backdrop-blur-sm transition-colors hover:bg-white/20 whitespace-nowrap"
              >
                <i className="ri-share-line" />
                Share
              </button>
              {copyToast && (
                <span className="rounded-full bg-[var(--wk-brand)] px-3 py-1 text-[11px] font-bold text-[var(--wk-brand-on)]">
                  Copied
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Split hero */}
        <div className="grid min-h-[80vh] lg:grid-cols-[1fr_1.2fr]">
          {/* Left: text content */}
          <div className="flex flex-col justify-end bg-[var(--wk-bg)] p-6 pb-12 pt-24 lg:pb-16 lg:pl-12 lg:pr-10">
            <div className="mb-5 flex items-center gap-3">
              <span className="rounded-full bg-[var(--wk-brand)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-brand-on)]">
                {article.section}
              </span>
              {article.readingTime && (
                <span className="text-[12px] font-medium text-[var(--wk-text-muted)]">
                  {article.readingTime} min read
                </span>
              )}
            </div>
            <h1
              className="mb-6 max-w-3xl font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]"
              style={{ fontSize: "clamp(32px, 5vw, 64px)" }}
            >
              {article.title}
            </h1>
            {article.dek && (
              <p className="max-w-2xl text-[17px] leading-relaxed text-[var(--wk-text-muted)]">
                {article.dek}
              </p>
            )}
            <div className="mt-8 flex items-center gap-4 text-[13px] text-[var(--wk-text-faint)]">
              <div className="flex items-center gap-2">
                {article.authorPhoto && (
                  <img src={article.authorPhoto} alt={article.author} className="h-8 w-8 rounded-full object-cover" />
                )}
                <span className="font-semibold text-[var(--wk-text)]">{article.author}</span>
              </div>
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

          {/* Right: image */}
          {article.heroUrl && (
            <div className="relative min-h-[40vh] lg:min-h-full">
              <img
                src={article.heroUrl}
                alt={article.title}
                className="h-full w-full object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--wk-bg)] via-transparent to-transparent lg:hidden" />
            </div>
          )}
        </div>
      </section>

      {/* ============================================================ */}
      {/*  ARTICLE BODY — editorial layout                             */}
      {/* ============================================================ */}
      <div className="wk-container px-6 py-14 md:py-20">
        <div className="mx-auto max-w-[var(--wk-w-text)]">
          {/* Lead paragraph with drop cap */}
          {article.body && article.body.length > 0 && (
            <p className="text-[17px] leading-[1.8] text-[var(--wk-text)]">
              <span
                className="float-left mr-3 mt-1 font-black leading-none text-[var(--wk-brand)]"
                style={{ fontSize: "clamp(48px, 5vw, 72px)" }}
              >
                {article.body[0].charAt(0)}
              </span>
              {article.body[0].slice(1)}
            </p>
          )}

          {/* Rest of body with interspersed pull quotes */}
          <div className="mt-8 space-y-8">
            {article.body?.slice(1).map((paragraph, index) => {
              const pq = pullQuotes[index];
              return (
                <div key={index}>
                  <p className="text-[16px] leading-[1.8] text-[var(--wk-text-soft)]">
                    {paragraph}
                  </p>
                  {/* Pull quote after every other paragraph, if we have one */}
                  {pq && index % 2 === 0 && (
                    <blockquote className="my-10 border-l-4 border-[var(--wk-brand)] pl-6">
                      <p className="text-[22px] font-bold leading-snug tracking-[-0.01em] text-[var(--wk-text)]">
                        &ldquo;{pq}&rdquo;
                      </p>
                    </blockquote>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="mt-14 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
                Topics
              </span>
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-1 text-[12px] font-semibold text-[var(--wk-text-soft)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Related Entities — graph sidebar feel */}
          {article.relatedEntities && article.relatedEntities.length > 0 && (
            <div className="mt-14 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 md:p-8">
              <h3 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
                Related in the graph
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
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
                    className="group flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 transition-all hover:border-[var(--wk-brand)]"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
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
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-[var(--wk-text)] group-hover:text-[var(--wk-brand)]">
                        {entity.name}
                      </span>
                      <span className="text-[11px] capitalize text-[var(--wk-text-faint)]">
                        {entity.type}
                      </span>
                    </div>
                    <i className="ri-arrow-right-line text-[var(--wk-text-faint)] transition-colors group-hover:text-[var(--wk-brand)]" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Share + subscribe row */}
          <div className="mt-14 flex flex-col items-center gap-4 border-t border-[var(--wk-divider)] pt-10 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <p className="text-[14px] font-semibold text-[var(--wk-text)]">
                Enjoyed this story?
              </p>
              <p className="text-[13px] text-[var(--wk-text-muted)]">
                Share it or explore more from the WAKILISHA editorial graph.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2.5 text-[13px] font-semibold text-[var(--wk-text)] transition-colors hover:bg-[var(--wk-surface-raised)] whitespace-nowrap"
              >
                <i className="ri-share-line" />
                Copy link
              </button>
              <Link
                to="/magazine"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-4 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)] transition-all hover:brightness-110 whitespace-nowrap"
              >
                More stories
                <i className="ri-arrow-right-line" />
              </Link>
            </div>
          </div>

          {/* Author bio */}
          {article.authorPhoto && (
            <div className="mt-14 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 md:p-8">
              <div className="flex items-center gap-4">
                <img
                  src={article.authorPhoto}
                  alt={article.author}
                  className="h-14 w-14 rounded-full object-cover"
                />
                <div>
                  <h3 className="text-[15px] font-bold text-[var(--wk-text)]">{article.author}</h3>
                  <p className="text-[13px] text-[var(--wk-text-muted)]">
                    Contributor to WAKILISHA Editorial
                  </p>
                </div>
              </div>
              <p className="mt-4 text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
                This story is part of the WAKILISHA editorial graph. Every article is linked to the
                registry — artists, releases, tracks, and charts — so you can follow the connections.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/*  READ NEXT — editorial section                                */}
      {/* ============================================================ */}
      {relatedStories.length > 0 && (
        <section className="border-t border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] py-16 md:py-24">
          <div className="wk-container px-6">
            <div className="mb-10 flex items-center gap-4">
              <div className="wk-eyebrow">Read next</div>
              <div className="h-px flex-1 bg-[var(--wk-divider)]" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {relatedStories.map((story) => (
                <StoryCard key={story.slug} {...story} />
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}