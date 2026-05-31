import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { StoryCard } from "@/components/design-system/editorial/StoryCard";
import { STORIES, SECTIONS } from "@/mocks/magazine";

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */
function formatReadCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

function getSectionMeta(sectionName: string) {
  return SECTIONS.find((s) => s.name === sectionName) || SECTIONS[0];
}

function useArticle(slug: string) {
  const article = STORIES.find((s) => s.slug === slug);
  if (!article) return null;
  const meta = getSectionMeta(article.section);
  const relatedStories = STORIES.filter(
    (s) => s.slug !== article.slug && s.section === article.section
  ).slice(0, 3);
  const pullQuotes =
    article.body
      ?.map((p, i) => (i === 1 || i === 3 || i === 5 ? p : null))
      .filter(Boolean) || [];
  return { article, meta, relatedStories, pullQuotes };
}

/* ------------------------------------------------------------------ */
/*  Shared components                                                   */
/* ------------------------------------------------------------------ */
function SectionBadge({
  section,
  color,
  readingTime,
  label,
}: {
  section: string;
  color: string;
  readingTime?: number;
  label?: string;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span
        className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
        style={{ backgroundColor: color }}
      >
        {label || section}
      </span>
      {readingTime && (
        <span className="text-[12px] font-medium text-white/60">
          {readingTime} min read
        </span>
      )}
    </div>
  );
}

function AuthorByline({
  author,
  authorPhoto,
  date,
  readCount,
  dark = false,
}: {
  author: string;
  authorPhoto?: string;
  date?: string;
  readCount?: number;
  dark?: boolean;
}) {
  const textColor = dark ? "text-white/70" : "text-[var(--wk-text-faint)]";
  const nameColor = dark ? "text-white/90" : "text-[var(--wk-text)]";
  return (
    <div className={`mt-8 flex items-center gap-4 text-[13px] ${textColor}`}>
      <div className="flex items-center gap-2">
        {authorPhoto && (
          <img
            src={authorPhoto}
            alt={author}
            className="h-8 w-8 rounded-full object-cover"
          />
        )}
        <span className={`font-semibold ${nameColor}`}>{author}</span>
      </div>
      <span>·</span>
      <span>{date}</span>
      {readCount && (
        <>
          <span>·</span>
          <span>{formatReadCount(readCount)} reads</span>
        </>
      )}
    </div>
  );
}

function ArticleBody({
  article,
  meta,
  pullQuotes,
}: {
  article: typeof STORIES[0];
  meta: typeof SECTIONS[0];
  pullQuotes: (string | null)[];
}) {
  const accent = meta.color;

  return (
    <div className="mx-auto max-w-[var(--wk-w-text)]">
      {/* Lead paragraph */}
      {article.body && article.body.length > 0 && (
        <p className="text-[17px] leading-[1.8] text-[var(--wk-text)]">
          <span
            className="float-left mr-3 mt-1 font-black leading-none"
            style={{ color: accent, fontSize: "clamp(48px, 5vw, 72px)" }}
          >
            {article.body[0].charAt(0)}
          </span>
          {article.body[0].slice(1)}
        </p>
      )}

      {/* Body with pull quotes */}
      <div className="mt-8 space-y-8">
        {article.body?.slice(1).map((paragraph, index) => (
          <div key={index}>
            <p className="text-[16px] leading-[1.8] text-[var(--wk-text-soft)]">
              {paragraph}
            </p>
            {pullQuotes[index] && index % 2 === 0 && (
              <blockquote className="my-10 border-l-4 pl-6" style={{ borderColor: accent }}>
                <p className="text-[22px] font-bold leading-snug tracking-[-0.01em] text-[var(--wk-text)]">
                  &ldquo;{pullQuotes[index]}&rdquo;
                </p>
              </blockquote>
            )}
          </div>
        ))}
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

      {/* Related Entities */}
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

      {/* Share row */}
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
              <h3 className="text-[15px] font-bold text-[var(--wk-text)]">
                {article.author}
              </h3>
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
  );
}

/* ------------------------------------------------------------------ */
/*  INTERVIEW — portrait layout (full-bleed hero, centered text)       */
/* ------------------------------------------------------------------ */
function InterviewHero({
  article,
  meta,
}: {
  article: typeof STORIES[0];
  meta: typeof SECTIONS[0];
}) {
  return (
    <section className="relative min-h-[88vh] flex items-end overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src={article.heroUrl}
          alt=""
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
      </div>

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
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/80 backdrop-blur-sm">
              Interview
            </span>
          </div>
        </div>
      </div>

      {/* Hero content — centered at bottom */}
      <div className="relative wk-container w-full px-6 pb-16 pt-24 md:pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <SectionBadge
            section={article.section}
            color={meta.color}
            readingTime={article.readingTime}
          />
          <h1
            className="font-black leading-[0.9] tracking-[-0.04em] text-white"
            style={{ fontSize: "clamp(40px, 6vw, 80px)" }}
          >
            {article.title}
          </h1>
          {article.dek && (
            <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-white/60">
              {article.dek}
            </p>
          )}
          <AuthorByline
            author={article.author}
            authorPhoto={article.authorPhoto}
            date={article.date}
            readCount={article.readCount}
            dark
          />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  ANALYSIS — editorial layout (text-heavy, minimal image)             */
/* ------------------------------------------------------------------ */
function AnalysisHero({
  article,
  meta,
}: {
  article: typeof STORIES[0];
  meta: typeof SECTIONS[0];
}) {
  return (
    <section className="relative overflow-hidden border-b border-[var(--wk-border)]">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <div className="wk-container flex items-center justify-between px-6 py-5">
          <Link
            to="/magazine"
            className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-[var(--wk-text-soft)] transition-colors hover:text-[var(--wk-text)]"
          >
            <i className="ri-arrow-left-line" />
            WAKILISHA Magazine
          </Link>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-1.5 text-[12px] font-semibold text-[var(--wk-text-soft)]">
              Analysis
            </span>
          </div>
        </div>
      </div>

      {/* Hero: text-left, thin image strip right */}
      <div className="grid min-h-[60vh] lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col justify-end bg-[var(--wk-bg)] p-6 pb-12 pt-24 lg:pb-16 lg:pl-12 lg:pr-10">
          <div className="mb-5 flex items-center gap-3">
            <span
              className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: meta.color }}
            >
              {article.section}
            </span>
            <span className="text-[12px] font-medium text-[var(--wk-text-muted)]">
              {article.readingTime} min read
            </span>
          </div>
          <h1
            className="mb-6 max-w-3xl font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]"
            style={{ fontSize: "clamp(36px, 5vw, 64px)" }}
          >
            {article.title}
          </h1>
          {article.dek && (
            <p className="max-w-2xl text-[17px] leading-relaxed text-[var(--wk-text-muted)]">
              {article.dek}
            </p>
          )}
          <AuthorByline
            author={article.author}
            authorPhoto={article.authorPhoto}
            date={article.date}
            readCount={article.readCount}
          />
        </div>

        {article.heroUrl && (
          <div className="relative hidden lg:block">
            <img
              src={article.heroUrl}
              alt=""
              className="h-full w-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--wk-bg)] to-transparent" />
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  FOCUS — immersive layout (full-bleed, region-forward)              */
/* ------------------------------------------------------------------ */
function FocusHero({
  article,
  meta,
}: {
  article: typeof STORIES[0];
  meta: typeof SECTIONS[0];
}) {
  return (
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
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/80 backdrop-blur-sm">
              Focus
            </span>
          </div>
        </div>
      </div>

      {/* Full-bleed image with text overlay at bottom */}
      <div className="relative min-h-[70vh] lg:min-h-[75vh]">
        <img
          src={article.heroUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />

        <div className="relative wk-container flex h-full flex-col justify-end px-6 pb-16 pt-24 md:pb-24">
          <div className="max-w-3xl">
            <div className="mb-4 flex items-center gap-3">
              <span
                className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
                style={{ backgroundColor: meta.color }}
              >
                {article.section}
              </span>
              <span className="text-[12px] font-medium text-white/60">
                {article.readingTime} min read
              </span>
            </div>
            <h1
              className="font-black leading-[0.92] tracking-[-0.04em] text-white"
              style={{ fontSize: "clamp(36px, 5vw, 72px)" }}
            >
              {article.title}
            </h1>
            {article.dek && (
              <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-white/60">
                {article.dek}
              </p>
            )}
            <AuthorByline
              author={article.author}
              authorPhoto={article.authorPhoto}
              date={article.date}
              readCount={article.readCount}
              dark
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  INDUSTRY — report layout (minimal, structured, data-forward)       */
/* ------------------------------------------------------------------ */
function IndustryHero({
  article,
  meta,
}: {
  article: typeof STORIES[0];
  meta: typeof SECTIONS[0];
}) {
  return (
    <section className="relative overflow-hidden border-b border-[var(--wk-border)]">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <div className="wk-container flex items-center justify-between px-6 py-5">
          <Link
            to="/magazine"
            className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-[var(--wk-text-soft)] transition-colors hover:text-[var(--wk-text)]"
          >
            <i className="ri-arrow-left-line" />
            WAKILISHA Magazine
          </Link>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-1.5 text-[12px] font-semibold text-[var(--wk-text-soft)]">
              Industry
            </span>
          </div>
        </div>
      </div>

      {/* Minimal header with image as a small strip below */}
      <div className="wk-container px-6 pt-24 pb-10 lg:pt-28 lg:pb-14">
        <div className="mb-6 flex items-center gap-3">
          <span
            className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
            style={{ backgroundColor: meta.color }}
          >
            {article.section}
          </span>
          <span className="text-[12px] font-medium text-[var(--wk-text-muted)]">
            {article.readingTime} min read
          </span>
        </div>
        <h1
          className="max-w-4xl font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]"
          style={{ fontSize: "clamp(32px, 4vw, 56px)" }}
        >
          {article.title}
        </h1>
        {article.dek && (
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-[var(--wk-text-muted)]">
            {article.dek}
          </p>
        )}
        <AuthorByline
          author={article.author}
          authorPhoto={article.authorPhoto}
          date={article.date}
          readCount={article.readCount}
        />
      </div>

      {/* Wide image strip below */}
      {article.heroUrl && (
        <div className="relative h-[320px] w-full lg:h-[400px]">
          <img
            src={article.heroUrl}
            alt=""
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-transparent to-transparent" />
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  CULTURE — visual layout (split, image-dominant, bold)              */
/* ------------------------------------------------------------------ */
function CultureHero({
  article,
  meta,
}: {
  article: typeof STORIES[0];
  meta: typeof SECTIONS[0];
}) {
  return (
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
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/80 backdrop-blur-sm">
              Culture
            </span>
          </div>
        </div>
      </div>

      {/* Split: image dominates left, text on right with tinted background */}
      <div className="grid min-h-[80vh] lg:grid-cols-[1.5fr_1fr]">
        {article.heroUrl && (
          <div className="relative min-h-[40vh] lg:min-h-full">
            <img
              src={article.heroUrl}
              alt=""
              className="h-full w-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[var(--wk-bg)]/60 lg:block hidden" />
          </div>
        )}
        <div className="flex flex-col justify-end bg-[var(--wk-bg)] p-6 pb-12 pt-24 lg:pb-16 lg:pl-10 lg:pr-12">
          <div className="mb-5 flex items-center gap-3">
            <span
              className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: meta.color }}
            >
              {article.section}
            </span>
            <span className="text-[12px] font-medium text-[var(--wk-text-muted)]">
              {article.readingTime} min read
            </span>
          </div>
          <h1
            className="mb-6 max-w-2xl font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]"
            style={{ fontSize: "clamp(32px, 5vw, 64px)" }}
          >
            {article.title}
          </h1>
          {article.dek && (
            <p className="max-w-xl text-[17px] leading-relaxed text-[var(--wk-text-muted)]">
              {article.dek}
            </p>
          )}
          <AuthorByline
            author={article.author}
            authorPhoto={article.authorPhoto}
            date={article.date}
            readCount={article.readCount}
          />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Layout dispatcher                                                   */
/* ------------------------------------------------------------------ */
function SectionHero({
  article,
  meta,
}: {
  article: typeof STORIES[0];
  meta: typeof SECTIONS[0];
}) {
  switch (meta.layout) {
    case "portrait":
      return <InterviewHero article={article} meta={meta} />;
    case "editorial":
      return <AnalysisHero article={article} meta={meta} />;
    case "immersive":
      return <FocusHero article={article} meta={meta} />;
    case "report":
      return <IndustryHero article={article} meta={meta} />;
    case "visual":
      return <CultureHero article={article} meta={meta} />;
    default:
      return <AnalysisHero article={article} meta={meta} />;
  }
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */
export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [copyToast, setCopyToast] = useState(false);
  const data = useArticle(slug || "");

  useEffect(() => {
    setCopyToast(false);
    window.scrollTo(0, 0);
  }, [slug]);

  if (!data) {
    return (
      <div className="wk-container px-6 py-20 text-center">
        <i className="ri-article-line mb-4 block text-5xl text-[var(--wk-text-faint)]" />
        <h1 className="wk-h-section mb-2">Article not found</h1>
        <p className="text-[var(--wk-text-muted)]">
          This story does not exist in the registry.
        </p>
        <Link to="/magazine" className="mt-6 inline-block">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-4 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)] transition-all hover:brightness-110 whitespace-nowrap">
            Back to magazine
          </span>
        </Link>
      </div>
    );
  }

  const { article, meta, relatedStories, pullQuotes } = data;

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2000);
  };

  return (
    <article>
      {/* Dynamic hero */}
      <SectionHero article={article} meta={meta} />

      {/* Article body */}
      <div className="wk-container px-6 py-14 md:py-20">
        <ArticleBody article={article} meta={meta} pullQuotes={pullQuotes} />
      </div>

      {/* Read next */}
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