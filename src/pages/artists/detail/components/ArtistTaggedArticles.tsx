import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { Chapter19FallbackImage } from "@/components/media/Chapter19FallbackImage";

interface TaggedArticleRow {
  slug: string;
  title: string;
  hero_image_url: string | null;
  excerpt: string;
  published_at: string;
  author: string;
}

interface TaggedArticle {
  slug: string;
  title: string;
  heroImageUrl: string;
  excerpt: string;
  publishedAt: string;
  author: string;
}

interface ArtistTaggedArticlesProps {
  artistName: string;
  artistSlug: string;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function stripHtml(html: string): string {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

export function ArtistTaggedArticles({ artistName, artistSlug }: ArtistTaggedArticlesProps) {
  const { ref, revealed } = useScrollReveal<HTMLElement>(0.1);
  const [articles, setArticles] = useState<TaggedArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    supabase
      .from("wk_articles")
      .select("slug, title, hero_image_url, excerpt, published_at, author")
      .contains("tags", JSON.stringify([{ slug: artistSlug }]))
      .order("published_at", { ascending: false })
      .limit(6)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          console.warn(`Tagged articles lookup failed for ${artistSlug}: ${error.message}`);
          setArticles([]);
        } else {
          const rows = (data || []) as TaggedArticleRow[];
          setArticles(
            rows.map((r) => ({
              slug: r.slug,
              title: r.title,
              heroImageUrl: r.hero_image_url || "",
              excerpt: r.excerpt ? stripHtml(r.excerpt) : "",
              publishedAt: r.published_at || "",
              author: r.author || "Wakilisha Staff",
            }))
          );
        }
        setLoading(false);
      });

    return () => { alive = false; };
  }, [artistSlug]);

  if (loading) {
    return (
      <section ref={ref} className={`${revealed ? "is-visible" : ""} reveal-up`}>
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--wk-text-faint)]">
            In the Magazine
          </p>
          <h2 className="wk-h-section">Articles featuring {artistName}</h2>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
              <div className="flex gap-3">
                <div className="h-16 w-16 shrink-0 rounded-lg bg-[var(--wk-surface-raised)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
                  <div className="h-2 w-full rounded bg-[var(--wk-surface-raised)]" />
                  <div className="h-2 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (articles.length === 0) return null;

  return (
    <section ref={ref} className={`${revealed ? "is-visible" : ""} reveal-up`}>
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--wk-text-faint)]">
          In the Magazine
        </p>
        <h2 className="wk-h-section">Articles featuring {artistName}</h2>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <Link
            key={article.slug}
            to={`/magazine/${article.slug}`}
            className="group flex gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 transition-all hover:border-[var(--wk-border-2)]"
          >
            <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
              {article.heroImageUrl ? (
                <img
                  src={article.heroImageUrl}
                  alt=""
                  className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <Chapter19FallbackImage slug={article.slug} name={article.title} />
              )}
            </div>
            <div className="min-w-0 flex flex-col justify-center">
              <h3 className="line-clamp-2 text-[13px] font-bold leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors">
                {article.title}
              </h3>
              {article.excerpt && (
                <p className="mt-1 line-clamp-1 text-[11px] leading-snug text-[var(--wk-text-faint)]">
                  {article.excerpt}
                </p>
              )}
              <div className="mt-1.5 flex items-center gap-2 text-[10px] text-[var(--wk-text-faint)]">
                <span className="font-semibold">{article.author}</span>
                <span>·</span>
                <span>{formatDate(article.publishedAt)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {articles.length >= 6 && (
        <div className="mt-4 text-center">
          <Link
            to={`/magazine?search=${encodeURIComponent(artistName)}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--wk-text-soft)] hover:text-[var(--wk-brand)] transition-colors"
          >
            View all articles featuring {artistName}
            <i className="ri-arrow-right-line text-sm" />
          </Link>
        </div>
      )}
    </section>
  );
}