import { useState, useEffect } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import {
  useMagazineArticle,
  useMagazineArticles,
  type MagazineArticle,
} from "@/services/magazineArticles";
import { getAuthorMeta } from "@/services/authorProfiles";
import { SkeletonArticlePage } from "@/components/skeletons/Skeletons";

function formatReadCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

const SECTION_COLORS: Record<string, string> = {
  Analysis: "#C44A3B", Focus: "#D97706", Industry: "#78716C",
  Culture: "#BE185D", Interview: "#256B5A", Music: "#4F46E5",
  Lifestyle: "#0891B2", Art: "#DC2626", Opinion: "#7C3AED",
};

function sectionColor(s: string) { return SECTION_COLORS[s] || "var(--wk-brand)"; }

function RelatedCard({ story }: { story: MagazineArticle }) {
  return (
    <Link
      to={`/magazine/${story.slug}`}
      className="group flex gap-3 active:scale-[0.98] transition-transform"
    >
      <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-[var(--wk-surface-raised)]">
        <img
          src={story.heroUrl}
          alt={story.title}
          className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-110"
        />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-[9px] font-black uppercase tracking-wider text-[var(--wk-brand)]">
          {story.section}
        </span>
        <h3 className="mt-0.5 text-[15px] font-bold leading-snug text-[var(--wk-text)] line-clamp-2">
          {story.title}
        </h3>
        <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">
          {story.author} · {story.readingTime} min
        </div>
      </div>
    </Link>
  );
}

export default function MobileArticle() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const previewNonce = searchParams.get("preview");

  const { article, loading, error } = useMagazineArticle(slug, previewNonce);
  const { articles: allArticles } = useMagazineArticles();

  const [copyToast, setCopyToast] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => { setCopyToast(false); }, [slug]);

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

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2500);
  };

  if (loading) {
    return <SkeletonArticlePage />;
  }

  if (error || !article) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="text-center">
          <i className="ri-article-line mb-3 block text-4xl text-[var(--wk-text-faint)]" />
          <p className="text-[var(--wk-text-muted)]">{error || "Article not found"}</p>
        </div>
      </div>
    );
  }

  const relatedStories = allArticles
    .filter((s) => s.slug !== article.slug)
    .slice(0, 3);

  const initials = article.author.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[var(--wk-bg)]">
      {/* Reading progress */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[2px] bg-transparent">
        <div
          className="h-full bg-[var(--wk-brand)] origin-left transition-transform duration-100"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      {/* Full-bleed hero — shorter on mobile */}
      <section className="relative overflow-hidden" style={{ height: "62dvh", minHeight: "380px" }}>
        {article.heroUrl && (
          <img
            src={article.heroUrl}
            alt={article.title}
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        )}
        {/* Gradient fades to page background */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.32) 45%, rgba(0,0,0,0.6) 72%, var(--wk-bg) 100%)",
          }}
        />

        {/* Floating nav */}
        <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-safe-top py-4 flex items-center justify-between">
          <Link
            to="/magazine"
            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/25 backdrop-blur-sm px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/85 whitespace-nowrap"
          >
            <i className="ri-arrow-left-line text-[12px]" />
            Magazine
          </Link>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/25 backdrop-blur-sm px-3 py-2 text-[10px] font-bold text-white/85 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-share-line text-[12px]" />
            {copyToast ? "Copied!" : "Share"}
          </button>
        </div>
      </section>

      {/* ── Floating content card ── */}
      <div
        className="relative z-10 rounded-t-[24px] bg-[var(--wk-bg)]"
        style={{
          marginTop: "-60px",
          boxShadow: "0 -6px 32px -8px rgba(0,0,0,0.12)",
        }}
      >
        <div className="px-5 pt-8 pb-6">
          {/* Section pill + stats */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <span
              className="rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white"
              style={{ background: sectionColor(article.section) }}
            >
              {article.section}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-[var(--wk-text-faint)]">
              <i className="ri-time-line text-[11px]" /> {article.readingTime} min
            </span>
            {article.readCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-[var(--wk-text-faint)]">
                <i className="ri-eye-line text-[11px]" /> {formatReadCount(article.readCount)}
              </span>
            )}
          </div>

          {/* Title */}
          <h1
            className="font-black leading-[0.93] tracking-[-0.045em] text-[var(--wk-text)] mb-4"
            style={{ fontSize: "clamp(26px, 7.5vw, 40px)" }}
          >
            {article.title}
          </h1>

          {/* Dek */}
          {article.dek && (
            <p className="text-[15px] leading-relaxed text-[var(--wk-text-soft)] mb-6">
              {article.dek}
            </p>
          )}

          {/* Divider */}
          <div className="h-px bg-[var(--wk-border)] mb-5" />

          {/* Author + inline share */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Link
                to={`/authors/${getAuthorMeta(article.author).slug}`}
                className="w-9 h-9 rounded-full bg-[var(--wk-brand)] flex items-center justify-center text-[11px] font-black text-[var(--wk-brand-on)] shrink-0"
              >
                {initials}
              </Link>
              <div>
                <Link
                  to={`/authors/${getAuthorMeta(article.author).slug}`}
                  className="text-[13px] font-bold text-[var(--wk-text)] block leading-tight"
                >
                  {article.author}
                </Link>
                <span className="text-[11px] text-[var(--wk-text-muted)]">{article.date}</span>
              </div>
            </div>

            {/* Quick share row */}
            <div className="flex items-center gap-1.5 shrink-0">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(window.location.href)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] flex items-center justify-center text-[var(--wk-text-soft)] active:scale-90 transition-transform"
              >
                <i className="ri-twitter-x-line text-[11px]" />
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${article.title} ${window.location.href}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] flex items-center justify-center text-[#25D366] active:scale-90 transition-transform"
              >
                <i className="ri-whatsapp-line text-[11px]" />
              </a>
            </div>
          </div>
        </div>

        {/* Divider into body */}
        <div className="h-px bg-[var(--wk-divider)] mx-5 mb-8" />

        {/* Article body */}
        <div className="px-5 pb-10">
          <div
            className="article-content-v2-mobile"
            dangerouslySetInnerHTML={{ __html: article.contentHtml }}
          />
        </div>

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="px-5 pb-8">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--wk-text-faint)] mb-3">Topics</p>
            <div className="flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[var(--wk-border)] px-3 py-1 text-[11px] font-semibold text-[var(--wk-text-soft)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Share CTA */}
        <div className="mx-5 mb-10 rounded-2xl bg-[var(--wk-surface)] border border-[var(--wk-border)] p-5 text-center">
          <p className="text-[14px] font-bold text-[var(--wk-text)] mb-1">Enjoyed this piece?</p>
          <p className="text-[12px] text-[var(--wk-text-muted)] mb-4">Share it with someone.</p>
          <div className="flex items-center justify-center gap-2.5 flex-wrap">
            <button
              onClick={handleShare}
              className="h-9 px-4 rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] text-[12px] font-bold text-[var(--wk-text-soft)] flex items-center gap-1.5 active:scale-[0.97] transition-transform cursor-pointer whitespace-nowrap"
            >
              <i className="ri-link-m" />
              {copyToast ? "Copied!" : "Copy link"}
            </button>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(window.location.href)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-4 rounded-full bg-[#000] text-white text-[12px] font-bold flex items-center gap-1.5 active:scale-[0.97] transition-transform whitespace-nowrap"
            >
              <i className="ri-twitter-x-line" /> X
            </a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${article.title} ${window.location.href}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-4 rounded-full bg-[#25D366] text-white text-[12px] font-bold flex items-center gap-1.5 active:scale-[0.97] transition-transform whitespace-nowrap"
            >
              <i className="ri-whatsapp-line" /> WhatsApp
            </a>
          </div>
        </div>
      </div>

      {/* Read next */}
      {relatedStories.length > 0 && (
        <section className="border-t border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] py-10">
          <div className="px-5">
            <div className="flex items-center gap-3 mb-6">
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
                <span className="w-5 h-px bg-[var(--wk-brand)]" />
                Read next
              </div>
              <div className="h-px flex-1 bg-[var(--wk-divider)]" />
            </div>
            <div className="space-y-4">
              {relatedStories.map((story) => <RelatedCard key={story.slug} story={story} />)}
            </div>
          </div>
        </section>
      )}

      {/* Footer CTA */}
      <section className="py-12 px-5 text-center bg-[var(--wk-surface)] border-t border-[var(--wk-border)]">
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-3">
          WAKILISHA Magazine
        </p>
        <h3 className="text-[19px] font-black leading-snug tracking-[-0.03em] text-[var(--wk-text)] mb-5">
          Stories that move East African culture forward.
        </h3>
        <Link
          to="/magazine"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-3 text-[13px] font-black text-[var(--wk-brand-on)] active:scale-[0.97] transition-transform whitespace-nowrap"
        >
          Explore all stories
          <i className="ri-arrow-right-line" />
        </Link>
      </section>
    </div>
  );
}