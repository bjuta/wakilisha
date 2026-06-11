import { useState, useEffect, useRef } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { rewriteWpImageUrl } from "@/services/wpImageRewrite";
import { useScrollLock } from "@/hooks/useScrollLock";

interface ArticlePreviewModalProps {
  title: string;
  excerpt: string;
  content: string;
  author: string;
  heroImageUrl: string;
  publishedAt: string;
  tags: string[];
  categories: string[];
  onClose: () => void;
}

export function ArticlePreviewModal({
  title,
  excerpt,
  content,
  author,
  heroImageUrl,
  publishedAt,
  tags,
  categories,
  onClose,
}: ArticlePreviewModalProps) {
  const [progress, setProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Lock background scroll while preview is open
  useScrollLock(true);

  const heroUrl = rewriteWpImageUrl(heroImageUrl);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const onScroll = () => {
      const max = container.scrollHeight - container.clientHeight;
      setProgress(max > 0 ? container.scrollTop / max : 0);
      setScrolled(container.scrollTop > window.innerHeight * 0.55);
    };
    onScroll();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Progress bar — uses modal scroll position */}
      <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-gray-200">
        <div
          className="h-full bg-foreground-950 origin-left transition-transform"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      {/* Sticky mini-header */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-full pointer-events-none"
        } bg-white/95 backdrop-blur-md border-b border-background-200`}
      >
        <div className="max-w-[1180px] mx-auto px-6 h-14 flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs font-bold text-foreground-700 hover:text-foreground-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <WkIcon name="ArrowLeft" size={14} />
            Back to Editor
          </button>
          <div className="h-4 w-px bg-background-200 shrink-0" />
          <h2 className="text-sm font-bold text-foreground-950 flex-1 min-w-0 truncate">
            {title}
          </h2>
          <button
            onClick={handleCopy}
            className="ml-auto shrink-0 h-8 px-3 rounded-full border border-background-200 bg-background-100 text-xs font-semibold text-foreground-700 hover:border-foreground-950 hover:text-foreground-950 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-link-m" />
            {copyDone ? "Copied!" : "Share"}
          </button>
        </div>
      </div>

      {/* Close button (top right when not scrolled) */}
      <div className="fixed top-4 right-6 z-50">
        <button
          onClick={onClose}
          className="h-10 w-10 rounded-full bg-white/90 backdrop-blur-sm border border-background-200 flex items-center justify-center text-foreground-700 hover:text-foreground-950 hover:border-foreground-950 transition-all cursor-pointer shadow-sm"
          aria-label="Close preview"
        >
          <WkIcon name="X" size={18} />
        </button>
      </div>

      {/* Scrollable container — the whole modal scrolls here */}
      <div
        ref={scrollContainerRef}
        data-scroll-lock="container"
        className="flex-1 overflow-y-auto overflow-x-hidden"
      >
        {/* Full-bleed hero */}
        <section className="relative overflow-hidden" style={{ height: "70vh", minHeight: "480px" }}>
          {heroUrl ? (
            <img
              src={heroUrl}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
          ) : (
            <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-background-200 to-background-300" />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.28) 45%, rgba(0,0,0,0.55) 72%, rgba(255,255,255,1) 100%)",
            }}
          />

          {/* Nav overlay */}
          <div className="absolute top-0 left-0 right-0 z-20 px-6 py-5 flex items-center justify-between">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/25 backdrop-blur-sm px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/85 hover:bg-black/45 transition-all cursor-pointer whitespace-nowrap"
            >
              <WkIcon name="ArrowLeft" size={13} />
              Back to Editor
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/25 backdrop-blur-sm px-3 py-2 text-xs font-bold text-white/80 hover:bg-black/45 transition-all cursor-pointer whitespace-nowrap"
              >
                <i className="ri-share-line" />
                {copyDone ? "Copied!" : "Share"}
              </button>
            </div>
          </div>
        </section>

        {/* Floating content card */}
        <div
          className="relative z-10 rounded-t-[28px] bg-white"
          style={{
            marginTop: "-72px",
            boxShadow: "0 -8px 48px -12px rgba(0,0,0,0.14)",
          }}
        >
          {/* Header: title, dek, author, date, categories */}
          <div className="max-w-[740px] mx-auto px-6 lg:px-8 pt-10 pb-6">
            {/* Categories */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {categories.map((cat) => (
                  <span
                    key={cat}
                    className="px-3 py-1 rounded-full border border-background-200 text-xs font-semibold text-foreground-700 bg-background-50"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}

            {/* Title */}
            <h1 className="text-3xl lg:text-4xl font-black tracking-[-0.03em] text-foreground-950 leading-tight mb-4">
              {title}
            </h1>

            {/* Excerpt / dek */}
            {excerpt && (
              <p className="text-base lg:text-lg text-foreground-700 leading-relaxed mb-6">
                {excerpt}
              </p>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-3 text-xs text-foreground-600">
              {author && (
                <>
                  <span className="font-semibold text-foreground-950">{author}</span>
                  <span className="text-foreground-400">·</span>
                </>
              )}
              {publishedAt && (
                <span>
                  {new Date(publishedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              )}
              <span className="text-foreground-400">·</span>
              <span>{estimateReadingTime(content)} min read</span>
            </div>
          </div>

          {/* Divider */}
          <div className="max-w-[740px] mx-auto px-6 lg:px-8">
            <div className="h-px bg-background-200 mb-10" />
          </div>

          {/* Article body */}
          <article className="max-w-[740px] mx-auto px-6 lg:px-8 pb-12">
            <div
              className="article-content-v2"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </article>

          {/* Tags + bottom share */}
          <div className="max-w-[740px] mx-auto px-6 lg:px-8 pb-16">
            {tags.length > 0 && (
              <div className="mb-8">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-foreground-400 mb-3">
                  Topics
                </p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 rounded-full border border-background-200 text-xs font-semibold text-foreground-700 hover:border-foreground-950 hover:text-foreground-950 cursor-pointer transition-all"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-background-100 border border-background-200 p-6 lg:p-8 text-center">
              <p className="text-sm font-bold text-foreground-950 mb-1">
                Enjoyed this piece?
              </p>
              <p className="text-xs text-foreground-600 mb-6">
                Share it with someone who cares about East African culture.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  onClick={handleCopy}
                  className="h-9 px-5 rounded-full border border-background-200 bg-white text-xs font-bold text-foreground-700 hover:border-foreground-950 hover:text-foreground-950 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-link-m" />
                  {copyDone ? "Copied!" : "Copy link"}
                </button>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(window.location.href)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 px-5 rounded-full bg-foreground-950 text-white text-xs font-bold flex items-center gap-2 hover:opacity-85 transition-opacity whitespace-nowrap"
                >
                  <i className="ri-twitter-x-line" /> Share on X
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${title} ${window.location.href}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 px-5 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 hover:opacity-85 transition-opacity whitespace-nowrap"
                >
                  <i className="ri-whatsapp-line" /> WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <section className="bg-background-100 border-t border-background-200 py-16 px-6 text-center">
          <div className="max-w-[480px] mx-auto">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-foreground-950 mb-3">
              WAKILISHA Magazine
            </p>
            <h3 className="text-2xl lg:text-3xl font-black tracking-[-0.035em] text-foreground-950 mb-6 leading-snug">
              Stories that move East African culture forward.
            </h3>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-full bg-foreground-950 text-white px-7 py-3.5 text-sm font-black transition-all hover:-translate-y-0.5 whitespace-nowrap cursor-pointer"
            >
              Back to Editor
              <WkIcon name="ArrowRight" size={16} />
            </button>
          </div>
        </section>

        {/* Spacer so bottom CTA isn't cut off */}
        <div className="h-8 bg-white" />
      </div>
    </div>
  );
}

function estimateReadingTime(content: string): number {
  const words = content.replace(/<[^>]*>/g, "").trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}