import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

interface PreviewArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  author: string;
  date: string;
  heroUrl: string;
  tags: string[];
  categories: string[];
  wpStatus: string;
}

export default function PreviewPage() {
  const { nonce } = useParams<{ nonce: string }>();
  const [article, setArticle] = useState<PreviewArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!nonce) return;
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const apiBase = (import.meta.env.VITE_WAKILISHA_PUBLIC_API_BASE as string | undefined) || "/api/v1";
        const response = await fetch(`${apiBase}/preview/${nonce}`, {
          headers: { Accept: "application/json" },
        });

        if (!alive) return;

        if (!response.ok) {
          setExpired(true);
          setLoading(false);
          return;
        }

        const payload = await response.json();
        const data = payload?.data?.article || payload?.article || payload?.data;

        if (!data) {
          setExpired(true);
          setLoading(false);
          return;
        }

        setArticle({
          id: data.id,
          slug: data.slug,
          title: data.title,
          excerpt: data.dek || data.excerpt || "",
          contentHtml: data.contentHtml,
          author: data.author,
          date: data.date,
          heroUrl: data.heroUrl,
          tags: data.tags || [],
          categories: data.categories || [],
          wpStatus: data.wpStatus || "draft",
        });
        setLoading(false);
      } catch {
        if (!alive) return;
        setExpired(true);
        setLoading(false);
      }
    }

    load();
    return () => { alive = false; };
  }, [nonce]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3 text-wk-text-muted">
          <i className="ri-loader-4-line animate-spin text-[22px]" />
          <span className="text-[14px] font-semibold">Loading preview…</span>
        </div>
      </div>
    );
  }

  if (expired || !article) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-wk-warning-soft text-wk-warning">
          <i className="ri-time-line text-[28px]" />
        </div>
        <h1 className="text-[20px] font-black text-wk-text">Preview Unavailable</h1>
        <p className="text-[13px] text-wk-text-muted text-center max-w-md">
          This preview link has expired or is no longer valid. Preview links are valid for 7 days
          after generation. Ask the editor for a new preview link.
        </p>
        <Link
          to="/magazine"
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
        >
          <i className="ri-arrow-left-line text-[14px]" />
          Go to Magazine
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-wk-bg">
      {/* Preview banner */}
      <div className="sticky top-0 z-40 flex items-center justify-between bg-wk-warning-soft border-b border-wk-warning/20 px-6 py-2.5">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-wk-warning">
          <i className="ri-eye-line text-[14px]" />
          Preview Mode
          {article.wpStatus !== "publish" && (
            <span className="uppercase text-[10px] bg-wk-warning/20 px-2 py-0.5 rounded-full">
              {article.wpStatus}
            </span>
          )}
        </div>
        <span className="text-[11px] text-wk-text-faint">
          This is a shareable preview link for review purposes.
        </span>
      </div>

      {/* Article content */}
      <article className="mx-auto max-w-[720px] px-6 py-10">
        {/* Hero */}
        {article.heroUrl && (
          <div className="mb-8 rounded-2xl overflow-hidden" style={{ height: 360 }}>
            <img
              src={article.heroUrl}
              alt={article.title}
              className="w-full h-full object-cover object-top"
            />
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-3 text-[12px] text-wk-text-muted mb-4">
          {article.categories.map((cat: string) => (
            <span key={cat} className="uppercase font-black tracking-wider text-wk-brand">
              {cat}
            </span>
          ))}
          <span>·</span>
          <span>{article.author}</span>
          {article.date && (
            <>
              <span>·</span>
              <span>{new Date(article.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
            </>
          )}
        </div>

        {/* Title */}
        <h1 className="text-[36px] font-black leading-tight tracking-tight text-wk-text mb-4">
          {article.title}
        </h1>

        {/* Excerpt */}
        {article.excerpt && (
          <p className="text-[16px] text-wk-text-soft leading-relaxed mb-8">
            {article.excerpt}
          </p>
        )}

        {/* Content */}
        <div
          className="prose prose-lg max-w-none prose-headings:text-wk-text prose-p:text-wk-text-soft prose-a:text-wk-brand prose-img:rounded-xl"
          dangerouslySetInnerHTML={{ __html: article.contentHtml }}
        />
      </article>
    </div>
  );
}