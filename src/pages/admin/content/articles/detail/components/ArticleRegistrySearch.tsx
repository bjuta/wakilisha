import { useState, useEffect, useCallback, useRef } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";

/* ─── Types ─── */

interface RegistryReleaseHit {
  id: string;
  slug: string;
  title: string;
  releaseType: string;
  artworkUrl: string;
  releaseDate: string;
  artistName: string;
  artistSlug: string;
  trackCount: number;
}

interface Props {
  onInsertLink?: (html: string) => void;
  onEmbedRelease?: (html: string) => void;
}

/* ─── Marker format ─── */

const REGISTRY_MARKER_PREFIX = "WK_REGISTRY_RELEASE";

/* ─── Component ─── */

export function ArticleRegistrySearch({ onInsertLink, onEmbedRelease }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RegistryReleaseHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [embeddedSlugs, setEmbeddedSlugs] = useState<Set<string>>(new Set());
  const [linkedSlugs, setLinkedSlugs] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Search ─── */

  const searchReleases = useCallback(async (search: string) => {
    const trimmed = search.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: releases, error: queryError } = await supabase
        .from("registry_releases")
        .select("id, slug, title, release_type, artwork_url, release_date")
        .eq("status", "active")
        .ilike("title", `%${trimmed}%`)
        .order("release_date", { ascending: false })
        .limit(12);

      if (queryError) throw queryError;
      if (!releases?.length) { setResults([]); setLoading(false); return; }

      // Fetch primary artists for all found releases
      const releaseIds = releases.map((r) => r.id);
      const { data: releaseArtists, error: artistsError } = await supabase
        .from("registry_release_artists")
        .select("release_id, artist_name_text, artist_slug")
        .in("release_id", releaseIds)
        .eq("is_primary", true)
        .eq("status", "active");

      if (artistsError) throw artistsError;

      const artistMap = new Map<string, { name: string; slug: string }>();
      for (const ra of (releaseArtists || [])) {
        artistMap.set(ra.release_id, { name: ra.artist_name_text || "", slug: ra.artist_slug || "" });
      }

      // Get track counts
      const { data: trackCounts, error: tracksError } = await supabase
        .from("registry_release_tracks")
        .select("release_id")
        .in("release_id", releaseIds);

      if (tracksError) throw tracksError;

      const countMap = new Map<string, number>();
      for (const tc of (trackCounts || [])) {
        countMap.set(tc.release_id, (countMap.get(tc.release_id) || 0) + 1);
      }

      const hits: RegistryReleaseHit[] = releases.map((r) => {
        const artist = artistMap.get(r.id);
        return {
          id: r.id,
          slug: r.slug,
          title: r.title,
          releaseType: r.release_type || "Release",
          artworkUrl: r.artwork_url || "",
          releaseDate: r.release_date || "",
          artistName: artist?.name || "Various Artists",
          artistSlug: artist?.slug || "",
          trackCount: countMap.get(r.id) || 0,
        };
      });

      setResults(hits);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchReleases(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, searchReleases]);

  /* ─── Actions ─── */

  const handleInsertLink = (hit: RegistryReleaseHit) => {
    const releasePath = `/releases/${hit.artistSlug || "artist"}/${hit.slug}`;
    const linkHtml = `<a href="${releasePath}" target="_blank" rel="noopener">${hit.title} — ${hit.artistName}</a>`;
    onInsertLink?.(linkHtml);
    setLinkedSlugs((prev) => new Set(prev).add(hit.slug));
  };

  const handleEmbedRelease = (hit: RegistryReleaseHit) => {
    const marker = `<!--${REGISTRY_MARKER_PREFIX}:${hit.slug}:${hit.artistSlug || ""}:${hit.artistName}-->`;
    onEmbedRelease?.(marker);
    setEmbeddedSlugs((prev) => new Set(prev).add(hit.slug));
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <WkSurface className="overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[var(--wk-surface-raised)] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <WkIcon name="Disc" size={14} className="text-[var(--wk-text-muted)]" />
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Registry Search
          </h3>
        </div>
        <WkIcon
          name={open ? "ChevronUp" : "ChevronDown"}
          size={14}
          className="text-[var(--wk-text-faint)]"
        />
      </button>

      {open && (
        <div className="border-t border-[var(--wk-border)] px-4 py-3 space-y-3">
          {/* Search input */}
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search releases by title..."
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] pl-8 pr-3 py-2 text-[12px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
            />
            <WkIcon
              name={loading ? "Loader" : "Search"}
              size={13}
              className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)] ${loading ? "animate-spin" : ""}`}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-[11px] text-[var(--wk-danger)] flex items-center gap-1.5">
              <WkIcon name="AlertCircle" size={12} />
              {error}
            </p>
          )}

          {/* No results */}
          {!loading && query.length >= 2 && results.length === 0 && !error && (
            <p className="text-[11px] text-[var(--wk-text-faint)] text-center py-2">
              No releases found for "{query}"
            </p>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="max-h-[360px] overflow-y-auto space-y-1.5">
              {results.map((hit) => (
                <div
                  key={hit.id}
                  className="flex items-start gap-3 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-2.5 hover:bg-[var(--wk-surface-raised)] transition-colors group"
                >
                  {/* Artwork thumbnail */}
                  <div className="relative w-10 h-10 shrink-0 rounded-md overflow-hidden bg-[var(--wk-surface-raised)]">
                    {hit.artworkUrl ? (
                      <img
                        src={hit.artworkUrl}
                        alt={hit.title}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <WkIcon name="Disc" size={16} className="text-[var(--wk-text-faint)]" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold text-[var(--wk-text)] truncate">
                      {hit.title}
                    </div>
                    <div className="text-[11px] text-[var(--wk-text-muted)] truncate">
                      {hit.artistName}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="inline-flex items-center rounded-full bg-[var(--wk-brand-soft)]/60 px-1.5 py-0.5 text-[9px] font-bold text-[var(--wk-brand)] uppercase">
                        {hit.releaseType}
                      </span>
                      {hit.releaseDate && (
                        <span className="text-[9px] text-[var(--wk-text-faint)]">
                          {formatDate(hit.releaseDate)}
                        </span>
                      )}
                      {hit.trackCount > 0 && (
                        <span className="text-[9px] text-[var(--wk-text-faint)]">
                          {hit.trackCount} trk
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => handleInsertLink(hit)}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                        linkedSlugs.has(hit.slug)
                          ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]"
                          : "bg-[var(--wk-bg-subtle)] text-[var(--wk-text-muted)] hover:bg-[var(--wk-success-soft)] hover:text-[var(--wk-success)]"
                      }`}
                      title="Insert text link"
                    >
                      <WkIcon name="Link" size={10} />
                      Link
                    </button>
                    <button
                      onClick={() => handleEmbedRelease(hit)}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                        embeddedSlugs.has(hit.slug)
                          ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                          : "bg-[var(--wk-bg-subtle)] text-[var(--wk-text-muted)] hover:bg-[var(--wk-brand-soft)] hover:text-[var(--wk-brand)]"
                      }`}
                      title="Embed full release card"
                    >
                      <WkIcon name="LayoutGrid" size={10} />
                      Embed
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Hint */}
          <p className="text-[10px] text-[var(--wk-text-faint)] leading-relaxed">
            <strong>Link</strong> inserts a text link. <strong>Embed</strong> inserts the full release card with artwork & tracklist.
          </p>
        </div>
      )}
    </WkSurface>
  );
}