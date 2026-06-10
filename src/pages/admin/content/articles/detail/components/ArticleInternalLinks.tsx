import { useEffect, useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";

interface LinkSuggestion {
  slug: string;
  title: string;
  type: "article" | "artist" | "release";
  section?: string;
  matchReason: string;
}

interface Props {
  content: string;
  currentSlug: string;
  categories: string[];
  tags: string[];
  onInsertLink?: (html: string) => void;
}

function extractPhrases(text: string, minLength = 3): string[] {
  const clean = text.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/[^a-zA-Z\s]/g, " ").toLowerCase();
  const words = clean.split(/\s+/).filter((w) => w.length >= minLength);
  const phrases: string[] = [];

  // Extract 2-3 word phrases
  for (let i = 0; i < words.length - 1; i++) {
    phrases.push(words.slice(i, i + 2).join(" "));
    if (i < words.length - 2) phrases.push(words.slice(i, i + 3).join(" "));
  }

  return [...new Set(phrases)].filter((p) => p.length > 6);
}

export function ArticleInternalLinks({ content, currentSlug, categories, tags, onInsertLink }: Props) {
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    async function findSuggestions() {
      setLoading(true);
      setError(null);
      try {
        const phrases = extractPhrases(content, 3);
        const searchTerms = [...new Set([...phrases.slice(0, 15), ...categories.map((c) => c.toLowerCase()), ...tags.map((t) => t.toLowerCase())])];

        if (!searchTerms.length) {
          setSuggestions([]);
          setLoading(false);
          return;
        }

        // Search articles
        const articleConditions = searchTerms.map((term) => `title.ilike.%${term}%`).join(",");
        const { data: articles } = await supabase
          .from("wk_articles")
          .select("slug, title, categories")
          .eq("wp_status", "publish")
          .neq("slug", currentSlug)
          .or(articleConditions)
          .limit(8);

        // Search artists
        const artistConditions = searchTerms.map((term) => `display_name.ilike.%${term}%`).join(",");
        const { data: artists } = await supabase
          .from("registry_artists")
          .select("slug, display_name")
          .eq("status", "active")
          .or(artistConditions)
          .limit(5);

        // Search releases
        const releaseConditions = searchTerms.map((term) => `title.ilike.%${term}%`).join(",");
        const { data: releases } = await supabase
          .from("registry_releases")
          .select("slug, title, release_type")
          .in("status", ["active", "draft"])
          .or(releaseConditions)
          .limit(5);

        const results: LinkSuggestion[] = [];

        for (const article of (articles ?? [])) {
          const catNames = Array.isArray(article.categories)
            ? article.categories.map((c: unknown) => typeof c === "string" ? c : (c as Record<string, unknown>)?.name as string || "").filter(Boolean)
            : [];
          const matchedTerm = searchTerms.find((t) => (article.title as string).toLowerCase().includes(t));
          results.push({
            slug: article.slug as string,
            title: article.title as string,
            type: "article",
            section: catNames[0],
            matchReason: matchedTerm ? `Matches "${matchedTerm}"` : "Related content",
          });
        }

        for (const artist of (artists ?? [])) {
          const matchedTerm = searchTerms.find((t) => (artist.display_name as string).toLowerCase().includes(t));
          results.push({
            slug: artist.slug as string,
            title: artist.display_name as string,
            type: "artist",
            matchReason: matchedTerm ? `Matches "${matchedTerm}"` : "Related artist",
          });
        }

        for (const release of (releases ?? [])) {
          const matchedTerm = searchTerms.find((t) => (release.title as string).toLowerCase().includes(t));
          results.push({
            slug: release.slug as string,
            title: release.title as string,
            type: "release",
            matchReason: matchedTerm ? `Matches "${matchedTerm}"` : "Related release",
          });
        }

        setSuggestions(results.slice(0, 12));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to find links");
      } finally {
        setLoading(false);
      }
    }

    if (content && content.length > 100) {
      findSuggestions();
    } else {
      setSuggestions([]);
    }
  }, [content, currentSlug]);

  function getLinkUrl(suggestion: LinkSuggestion): string {
    switch (suggestion.type) {
      case "article":
        return `/magazine/${suggestion.slug}`;
      case "artist":
        return `/artists/${suggestion.slug}`;
      case "release":
        return `/releases/${suggestion.slug}`;
    }
  }

  function getTypeBadge(type: string) {
    switch (type) {
      case "article":
        return { label: "Magazine", className: "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" };
      case "artist":
        return { label: "Artist", className: "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" };
      case "release":
        return { label: "Release", className: "bg-[var(--wk-info-soft)] text-[var(--wk-info)]" };
      default:
        return { label: "Link", className: "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]" };
    }
  }

  if (!content || content.length < 100) {
    return (
      <WkSurface className="p-4">
        <div className="flex items-center gap-2 text-[var(--wk-text-faint)]">
          <WkIcon name="Link2" size={14} />
          <span className="text-[12px]">Add at least 100 characters to see link suggestions.</span>
        </div>
      </WkSurface>
    );
  }

  return (
    <div className="space-y-3">
      <WkSurface className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <WkIcon name="Link2" size={14} className="text-[var(--wk-text-muted)]" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
              Internal Link Suggestions
            </h3>
          </div>
          {loading && <i className="ri-loader-4-line animate-spin text-[14px] text-[var(--wk-text-faint)]" />}
        </div>

        {error && (
          <p className="text-[12px] text-[var(--wk-danger)] mb-2">{error}</p>
        )}

        {suggestions.length === 0 && !loading ? (
          <p className="text-[12px] text-[var(--wk-text-faint)]">
            No link suggestions found. Add more content or tags to get suggestions.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {suggestions.map((suggestion) => {
              const badge = getTypeBadge(suggestion.type);
              const url = getLinkUrl(suggestion);
              const htmlLink = `<a href="${url}">${suggestion.title}</a>`;

              return (
                <div
                  key={`${suggestion.type}-${suggestion.slug}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-2 hover:bg-[var(--wk-surface-raised)] transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold text-[var(--wk-text)] truncate">
                      {suggestion.title}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${badge.className}`}>
                        {badge.label}
                      </span>
                      {suggestion.section && (
                        <span className="text-[10px] text-[var(--wk-text-faint)]">{suggestion.section}</span>
                      )}
                      <span className="text-[10px] text-[var(--wk-text-faint)]">{suggestion.matchReason}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(htmlLink);
                        setCopied(suggestion.slug);
                        setTimeout(() => setCopied(null), 2000);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-text-muted)] hover:bg-[var(--wk-brand-soft)] hover:text-[var(--wk-brand)] transition-colors cursor-pointer"
                      title="Copy HTML link"
                    >
                      <WkIcon name={copied === suggestion.slug ? "Check" : "Copy"} size={12} />
                    </button>
                    <button
                      onClick={() => {
                        const linkHtml = `<a href="${url}" target="_blank" rel="noopener">${suggestion.title}</a>`;
                        onInsertLink?.(linkHtml);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-text-muted)] hover:bg-[var(--wk-success-soft)] hover:text-[var(--wk-success)] transition-colors cursor-pointer"
                      title="Insert link into editor"
                    >
                      <WkIcon name="Plus" size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </WkSurface>
    </div>
  );
}