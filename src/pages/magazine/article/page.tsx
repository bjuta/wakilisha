import { useEffect, useState, useRef, useMemo } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  useMagazineArticle,
  useMagazineArticles,
  getRelatedArticles,
  type MagazineArticle,
  type MediaAsset,
} from "@/services/magazineArticles";
import { WkIcon } from "@/components/design-system/Icon";
import { ArticleFloatHeader } from "./components/ArticleFloatHeader";
import { ArticleRelated } from "./components/ArticleRelated";
import { SkeletonArticlePage } from "@/components/skeletons/Skeletons";
import {
  checkArticleScheduling,
  lookupSlugRedirect,
} from "@/services/articles/articleAdminService";

/* ─── Inline media gallery ─── */
function InlineMediaGallery({ assets }: { assets: MediaAsset[] }) {
  const inlineAssets = assets.filter((a) => a.role !== "hero" && a.url);
  if (!inlineAssets.length) return null;
  return (
    <div className="my-10 grid gap-4 sm:grid-cols-2">
      {inlineAssets.map((asset) => (
        <figure
          key={asset.id}
          className="overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)]"
        >
          <img src={asset.url} alt={asset.altText || ""} className="h-full w-full object-cover" loading="lazy" />
          {asset.altText && (
            <figcaption className="px-4 py-2 text-[11px] text-[var(--wk-text-muted)]">
              {asset.altText}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

/* ─── Bottom share prompt ─── */
function ArticleBottomShare({ article }: { article: MagazineArticle }) {
  const [copyDone, setCopyDone] = useState(false);
  const handleCopy = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2500);
  };

  return (
    <div className="rounded-2xl bg-[var(--wk-surface)] border border-[var(--wk-border)] p-6 lg:p-8 text-center">
      <p className="text-[15px] font-bold text-[var(--wk-text)] mb-1">
        Enjoyed this piece?
      </p>
      <p className="text-[13px] text-[var(--wk-text-muted)] mb-6">
        Share it with someone who cares about East African culture.
      </p>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <button
          onClick={handleCopy}
          className="h-9 px-5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] text-[13px] font-bold text-[var(--wk-text-soft)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-link-m" />
          {copyDone ? "Copied!" : "Copy link"}
        </button>
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(window.location.href)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="h-9 px-5 rounded-full bg-[#000] text-white text-[13px] font-bold flex items-center gap-2 hover:opacity-85 transition-opacity whitespace-nowrap"
        >
          <i className="ri-twitter-x-line" /> Share on X
        </a>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${article.title} ${window.location.href}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="h-9 px-5 rounded-full bg-[#25D366] text-white text-[13px] font-bold flex items-center gap-2 hover:opacity-85 transition-opacity whitespace-nowrap"
        >
          <i className="ri-whatsapp-line" /> WhatsApp
        </a>
      </div>
    </div>
  );
}

/* ─── Main page ─── */
export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const previewNonce = searchParams.get("preview");
  const navigate = useNavigate();

  const { article, loading: articleLoading, error: articleError } = useMagazineArticle(slug, previewNonce);
  const { articles: allArticles } = useMagazineArticles();

  const [related, setRelated] = useState<MagazineArticle[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const lastScrollState = useRef(false);

  // Memoize contentHtml so React never touches the embed iframes on re-render
  const stableContentHtml = useMemo(() => article?.contentHtml ?? '', [article?.contentHtml]);

  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<string | null>(null);
  const [checkingRedirect, setCheckingRedirect] = useState(false);

  useEffect(() => {
    if (!article) return;
    let alive = true;
    setRelatedLoading(true);
    getRelatedArticles(article, 3)
      .then((items) => {
        if (alive) { setRelated(items); setRelatedLoading(false); }
      })
      .catch(() => {
        if (alive) {
          setRelated(allArticles.filter((a) => a.slug !== article.slug).slice(0, 3));
          setRelatedLoading(false);
        }
      });
    return () => { alive = false; };
  }, [article, allArticles]);

  // Check if article is scheduled (future publish date)
  useEffect(() => {
    if (!slug) return;
    let alive = true;
    checkArticleScheduling(slug)
      .then((result) => {
        if (!alive || !result) return;
        if (result.isScheduled && result.scheduledDate) {
          setIsScheduled(true);
          setScheduledDate(result.scheduledDate);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [slug]);

  // Check for slug redirects when article not found
  useEffect(() => {
    if (articleLoading || article || !slug) return;
    let alive = true;
    setCheckingRedirect(true);
    lookupSlugRedirect(slug)
      .then((newSlug) => {
        if (!alive) return;
        if (newSlug) {
          navigate(`/magazine/${newSlug}`, { replace: true });
        }
        setCheckingRedirect(false);
      })
      .catch(() => {
        if (alive) setCheckingRedirect(false);
      });
    return () => { alive = false; };
  }, [slug, articleLoading, article, navigate]);

  useEffect(() => {
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const doc = document.documentElement;
        const max = doc.scrollHeight - window.innerHeight;
        // Update progress bar via ref — zero re-renders
        if (progressBarRef.current) {
          const pct = max > 0 ? window.scrollY / max : 0;
          (progressBarRef.current.firstChild as HTMLElement).style.transform = `scaleX(${pct})`;
        }
        // Only call setScrolled when the threshold actually crosses
        const nowScrolled = window.scrollY > window.innerHeight * 0.55;
        if (nowScrolled !== lastScrollState.current) {
          lastScrollState.current = nowScrolled;
          setScrolled(nowScrolled);
        }
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  const handleNavCopy = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2500);
  };

  /* Loading / error states */
  if (articleLoading) {
    return <SkeletonArticlePage />;
  }

  if (checkingRedirect) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--wk-text-muted)]">
          <i className="ri-loader-4-line animate-spin text-[20px]" />
          <span className="text-[14px]">Checking for updated link…</span>
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

  /* ─── Scheduled article (coming soon) ─── */
  if (isScheduled) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="flex h-16 w-16 items-center justify-center mx-auto mb-5 rounded-2xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
            <WkIcon name="CalendarClock" size={28} />
          </div>
          <h1 className="text-[22px] font-black text-[var(--wk-text)] mb-2">Coming Soon</h1>
          <p className="text-[14px] text-[var(--wk-text-muted)] mb-1">
            This article is scheduled and will be published on:
          </p>
          <p className="text-[16px] font-bold text-[var(--wk-brand)] mb-5">
            {scheduledDate ? new Date(scheduledDate).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }) : "soon"}
          </p>
          <Link
            to="/magazine"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-text-soft)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] transition-all whitespace-nowrap"
          >
            <WkIcon name="ArrowLeft" size={14} />
            Back to Magazine
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      {/* Reading progress — driven by ref, zero re-renders */}
      <div className="article-progress" ref={progressBarRef}>
        <span style={{ transform: "scaleX(0)" }} />
      </div>

      {/* Sticky mini-header — slides in after scroll */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full pointer-events-none"
        } bg-[var(--wk-bg)]/95 backdrop-blur-md border-b border-[var(--wk-border)]`}
      >
        <div className="max-w-[1180px] mx-auto px-6 h-14 flex items-center gap-4">
          <Link
            to="/magazine"
            className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] transition-colors whitespace-nowrap shrink-0"
          >
            <WkIcon name="ArrowLeft" size={14} />
            Magazine
          </Link>
          <div className="h-4 w-px bg-[var(--wk-border)] shrink-0" />
          <h2 className="text-[13px] font-bold text-[var(--wk-text)] flex-1 min-w-0 truncate">
            {article.title}
          </h2>
          <button
            onClick={handleNavCopy}
            className="ml-auto shrink-0 h-8 px-3 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[11px] font-semibold text-[var(--wk-text-soft)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-link-m" />
            {copyDone ? "Copied!" : "Share"}
          </button>
        </div>
      </div>

      {/* ── Full-bleed hero ── */}
      <section className="relative overflow-hidden" style={{ height: "70vh", minHeight: "480px" }}>
        <img
          src={article.heroUrl}
          alt={article.title}
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
        {/* Gradient fades to page background so float card feels seamless */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.28) 45%, rgba(0,0,0,0.55) 72%, var(--wk-bg) 100%)",
          }}
        />

        {/* Nav overlay */}
        <div className="absolute top-0 left-0 right-0 z-20 px-6 py-5 flex items-center justify-between">
          <Link
            to="/magazine"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/25 backdrop-blur-sm px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white/85 hover:bg-black/45 transition-all whitespace-nowrap"
          >
            <WkIcon name="ArrowLeft" size={13} />
            Magazine
          </Link>
          <div className="flex items-center gap-2">
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(window.location.href)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 w-8 rounded-full border border-white/20 bg-black/25 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/45 transition-all"
              aria-label="Share on X"
            >
              <i className="ri-twitter-x-line text-[12px]" />
            </a>
            <button
              onClick={handleNavCopy}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/25 backdrop-blur-sm px-3 py-2 text-[11px] font-bold text-white/80 hover:bg-black/45 transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-share-line" />
              {copyDone ? "Copied!" : "Share"}
            </button>
          </div>
        </div>
      </section>

      {/* ── Floating content card ── */}
      <div
        className="relative z-10 rounded-t-[28px] bg-[var(--wk-bg)]"
        style={{
          marginTop: "-72px",
          boxShadow: "0 -8px 48px -12px rgba(0,0,0,0.14)",
        }}
      >
        {/* Float card header: stats, title, dek, author, share */}
        <ArticleFloatHeader article={article} />

        {/* Divider into body */}
        <div className="max-w-[740px] mx-auto px-6 lg:px-8">
          <div className="h-px bg-[var(--wk-border)] mb-10" />
        </div>

        {/* Article body */}
        <article className="max-w-[740px] mx-auto px-6 lg:px-8 pb-12">
          <div
            className="article-content-v2"
            dangerouslySetInnerHTML={{ __html: stableContentHtml }}
          />
          <InlineMediaGallery assets={article.mediaAssets} />
        </article>

        {/* Tags + Categories */}
        <div className="max-w-[740px] mx-auto px-6 lg:px-8 pb-16">
          {article.categories?.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-text-faint)] mb-3">
                Categories
              </p>
              <div className="flex flex-wrap gap-2">
                {article.categories.map((cat) => {
                  const catSlug = cat.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                  return (
                    <Link
                      key={cat}
                      to={`/categories/${catSlug}`}
                      className="px-3 py-1.5 rounded-full border border-[var(--wk-border)] text-[11px] font-semibold text-[var(--wk-text-soft)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] cursor-pointer transition-all"
                    >
                      {cat}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          {article.tags?.length > 0 && (
            <div className="mb-8">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-text-faint)] mb-3">
                Topics
              </p>
              <div className="flex flex-wrap gap-2">
                {article.tags.map((tag) => {
                  const tagSlug = tag.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                  return (
                    <Link
                      key={tag}
                      to={`/tags/${tagSlug}`}
                      className="px-3 py-1.5 rounded-full border border-[var(--wk-border)] text-[11px] font-semibold text-[var(--wk-text-soft)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] cursor-pointer transition-all"
                    >
                      {tag}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          <ArticleBottomShare article={article} />
        </div>
      </div>

      {/* Related stories */}
      <ArticleRelated stories={related} loading={relatedLoading} />

      {/* Footer CTA */}
      <section className="bg-[var(--wk-surface)] border-t border-[var(--wk-border)] py-16 px-6 text-center">
        <div className="max-w-[480px] mx-auto">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-3">
            WAKILISHA Magazine
          </p>
          <h3 className="text-[24px] lg:text-[28px] font-black tracking-[-0.035em] text-[var(--wk-text)] mb-6 leading-snug">
            Stories that move East African culture forward.
          </h3>
          <Link
            to="/magazine"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] px-7 py-3.5 text-[14px] font-black transition-all hover:-translate-y-0.5 whitespace-nowrap"
          >
            Explore all stories
            <WkIcon name="ArrowRight" size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}