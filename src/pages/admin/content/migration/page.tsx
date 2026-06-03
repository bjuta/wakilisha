import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface ImageUrl {
  url: string;
  type: "hero" | "inline";
  articleId?: string;
  slug?: string;
  mediaAssetId?: string;
}

interface BatchResult {
  oldUrl: string;
  newUrl: string | null;
  error: string | null;
}

const BATCH_SIZE = 25;
const EDGE_FUNCTION_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/migrate-wp-images`;

export default function AdminMediaMigrationPage() {
  const [urls, setUrls] = useState<ImageUrl[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [results, setResults] = useState<BatchResult[]>([]);
  const [status, setStatus] = useState<string>("Click 'Analyze' to discover all images");
  const [dryRun, setDryRun] = useState(true);
  const [heroOnly, setHeroOnly] = useState(true);
  const [urlMap, setUrlMap] = useState<Record<string, string>>();
  const [dbUpdateStatus, setDbUpdateStatus] = useState<string>("");

  const analyze = useCallback(async () => {
    setAnalyzing(true);
    setStatus("Fetching article data...");
    setUrls([]);
    setResults([]);
    setUrlMap({});
    setProgress({ done: 0, total: 0, errors: 0 });

    // 1. Fetch articles with source_wp_post_id (WordPress articles)
    const { data: articles, error: articlesError } = await supabase
      .from("wk_articles")
      .select("id, slug, hero_image_url, content_html")
      .not("source_wp_post_id", "is", null);

    if (articlesError) {
      setStatus(`Error fetching articles: ${articlesError.message}`);
      setAnalyzing(false);
      return;
    }

    // 2. Fetch media assets linked to articles (where hero_image_url is null)
    const { data: mediaAssets, error: mediaError } = await supabase
      .from("wk_media_assets")
      .select("id, entity_slug, role, url")
      .eq("entity_type", "article")
      .ilike("url", "%wakilisha.africa/wp-content%");

    if (mediaError) {
      setStatus(`Error fetching media assets: ${mediaError.message}`);
      setAnalyzing(false);
      return;
    }

    const found: ImageUrl[] = [];
    const seen = new Set<string>();

    // 3. Build a map of article slug -> id for linking
    const articleMap: Record<string, string> = {};
    for (const article of articles || []) {
      const row = article as Record<string, unknown>;
      const slug = String(row.slug || '');
      if (slug) articleMap[slug] = String(row.id || '');
    }

    // 4. Discover images from wk_media_assets (primary source since hero_image_url is null)
    for (const asset of mediaAssets || []) {
      const row = asset as Record<string, unknown>;
      const url = String(row.url || '');
      const slug = String(row.entity_slug || '');
      const id = String(row.id || '');
      const role = String(row.role || '');

      if (url && url.includes("wakilisha.africa") && !seen.has(url)) {
        seen.add(url);
        found.push({
          url,
          type: role === 'hero' ? 'hero' : 'inline',
          articleId: articleMap[slug] || undefined,
          slug,
          mediaAssetId: id,
        });
      }
    }

    // 5. Also discover from wk_articles.hero_image_url (fallback / additional)
    for (const article of articles || []) {
      const row = article as Record<string, unknown>;
      const hero = row.hero_image_url as string | null;
      const html = row.content_html as string | null;
      const slug = String(row.slug || '');
      const articleId = String(row.id || '');

      if (hero && hero.includes("wakilisha.africa") && !seen.has(hero)) {
        seen.add(hero);
        found.push({
          url: hero,
          type: "hero",
          articleId,
          slug,
        });
      }

      if (!heroOnly && html) {
        const matches = html.match(
          /https:\/\/wakilisha\.africa\/wp-content\/uploads\/[^"'\s\)]+/g
        );
        if (matches) {
          for (const url of matches) {
            if (!seen.has(url)) {
              seen.add(url);
              found.push({
                url,
                type: "inline",
                articleId,
                slug,
              });
            }
          }
        }
      }
    }

    setUrls(found);
    setStatus(
      `Found ${found.length} unique ${heroOnly ? 'hero images' : 'images'} (${found.filter((u) => u.type === "hero").length} heroes${heroOnly ? '' : `, ${found.filter((u) => u.type === "inline").length} inline`}) across ${new Set(found.map((u) => u.slug)).size} articles`
    );
    setAnalyzing(false);
  }, [heroOnly]);

  const runBatch = useCallback(
    async (batch: ImageUrl[]): Promise<BatchResult[]> => {
      const response = await fetch(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          urls: batch.map((u) => u.url),
          dryRun,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Edge function failed: ${response.status} ${text}`);
      }

      const payload = await response.json();
      return payload.results || [];
    },
    [dryRun]
  );

  const runMigration = useCallback(async () => {
    if (!urls.length) return;
    setLoading(true);
    setResults([]);
    setProgress({ done: 0, total: urls.length, errors: 0 });
    setStatus("Starting migration...");

    const allResults: BatchResult[] = [];
    const map: Record<string, string> = {};
    let errors = 0;

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const batch = urls.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(urls.length / BATCH_SIZE);
      setStatus(
        `Processing batch ${batchNum}/${totalBatches} (${batch.length} images)...`
      );

      try {
        const batchResults = await runBatch(batch);
        allResults.push(...batchResults);

        for (const r of batchResults) {
          if (r.newUrl) {
            map[r.oldUrl] = r.newUrl;
          } else {
            errors++;
          }
        }

        setProgress({ done: allResults.length, total: urls.length, errors });
      } catch (err) {
        errors += batch.length;
        setProgress({ done: allResults.length, total: urls.length, errors });
        console.error(`Batch ${batchNum} failed:`, err);
      }

      // Wait between batches
      if (i + BATCH_SIZE < urls.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    setResults(allResults);
    setUrlMap(map);
    setStatus(
      `Migration complete: ${Object.keys(map).length} succeeded, ${errors} failed out of ${urls.length} total`
    );
    setLoading(false);
  }, [urls, runBatch]);

  const updateDatabase = useCallback(async () => {
    if (!urlMap || !Object.keys(urlMap).length) {
      setDbUpdateStatus("No URL map available. Run migration first.");
      return;
    }

    setDbUpdateStatus("Updating database...");

    // 1. Update hero images in wk_articles
    const heroUrls = urls.filter((u) => u.type === "hero");
    let heroesUpdated = 0;
    for (const hero of heroUrls) {
      const newUrl = urlMap[hero.url];
      if (newUrl && hero.articleId) {
        const { error } = await supabase
          .from("wk_articles")
          .update({ hero_image_url: newUrl })
          .eq("id", hero.articleId);
        if (!error) heroesUpdated++;
      }
    }

    // 2. Update inline images in content_html (skip in hero-only mode)
    let inlineUpdated = 0;
    if (!heroOnly) {
      const { data: articles } = await supabase
        .from("wk_articles")
        .select("id, content_html")
        .not("source_wp_post_id", "is", null);

      const articlesWithInline = (articles || []).filter(
        (a) => a.content_html && a.content_html.includes("wakilisha.africa/wp-content/uploads/")
      );

      for (const article of articlesWithInline) {
        let newHtml = article.content_html as string;
        let changed = false;

        for (const [oldUrl, newUrl] of Object.entries(urlMap)) {
          if (newUrl && newHtml.includes(oldUrl)) {
            newHtml = newHtml.replaceAll(oldUrl, newUrl);
            changed = true;
          }
        }

        if (changed) {
          const { error } = await supabase
            .from("wk_articles")
            .update({ content_html: newHtml })
            .eq("id", article.id);
          if (!error) inlineUpdated++;
        }
      }
    }

    // 3. Update wk_media_assets to point to new URLs
    const { data: mediaAssets } = await supabase
      .from("wk_media_assets")
      .select("id, url")
      .eq("entity_type", "article")
      .eq("role", "hero");

    let mediaUpdated = 0;
    for (const asset of mediaAssets || []) {
      const newUrl = urlMap[asset.url];
      if (newUrl) {
        const { error } = await supabase
          .from("wk_media_assets")
          .update({ url: newUrl, source: "internal_migration" })
          .eq("id", asset.id);
        if (!error) mediaUpdated++;
      }
    }

    // 4. Set source_wp_post_id to NULL for all articles
    const { error: nullError } = await supabase
      .from("wk_articles")
      .update({ source_wp_post_id: null })
      .not("source_wp_post_id", "is", null);

    const nullStatus = nullError ? `Error: ${nullError.message}` : "All articles marked as internal";

    const inlineMsg = heroOnly ? "Inline images skipped (hero-only mode)" : `${inlineUpdated} articles with inline images`;

    setDbUpdateStatus(
      `Database updated: ${heroesUpdated} heroes, ${inlineMsg}, ${mediaUpdated} media assets. ${nullStatus}`
    );
  }, [urlMap, urls, heroOnly]);

  const succeeded = results.filter((r) => r.newUrl).length;
  const failed = results.filter((r) => r.error).length;

  return (
    <div className="min-h-screen bg-[var(--wk-bg)] p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--wk-text)]">
            Media Library Migration
          </h1>
          <p className="mt-1 text-sm text-[var(--wk-text-muted)]">
            Download all WordPress images into Supabase Storage and convert articles to internal.
          </p>
        </div>

        {/* Controls */}
        <div className="mb-6 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
          <div className="mb-4 flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={heroOnly}
                onChange={(e) => setHeroOnly(e.target.checked)}
                className="h-4 w-4 accent-[var(--wk-brand)]"
              />
              <span className="text-sm text-[var(--wk-text)]">Hero images only (~135, safer)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="h-4 w-4 accent-[var(--wk-brand)]"
              />
              <span className="text-sm text-[var(--wk-text)]">Dry run (simulate, no actual upload)</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={analyze}
              disabled={analyzing || loading}
              className="rounded-lg bg-[var(--wk-brand)] px-4 py-2 text-sm font-bold text-[var(--wk-brand-on)] disabled:opacity-50"
            >
              {analyzing ? "Analyzing..." : "1. Analyze Images"}
            </button>
            <button
              onClick={runMigration}
              disabled={loading || !urls.length || analyzing}
              className="rounded-lg bg-[var(--wk-brand)] px-4 py-2 text-sm font-bold text-[var(--wk-brand-on)] disabled:opacity-50"
            >
              {loading ? "Migrating..." : "2. Run Migration"}
            </button>
            <button
              onClick={updateDatabase}
              disabled={!urlMap || !Object.keys(urlMap).length || loading}
              className="rounded-lg bg-[var(--wk-brand)] px-4 py-2 text-sm font-bold text-[var(--wk-brand-on)] disabled:opacity-50"
            >
              3. Update Database
            </button>
          </div>
          <p className="mt-3 text-sm text-[var(--wk-text-muted)]">{status}</p>
        </div>

        {/* Progress */}
        {(loading || results.length > 0) && (
          <div className="mb-6 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--wk-text)]">Progress</span>
              <span className="text-sm text-[var(--wk-text-muted)]">
                {progress.done} / {progress.total} ({progress.errors} errors)
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[var(--wk-bg)]">
              <div
                className="h-2 rounded-full bg-[var(--wk-brand)] transition-all"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            {succeeded > 0 && (
              <p className="mt-2 text-sm text-[var(--wk-brand)]">
                {succeeded} images migrated successfully
              </p>
            )}
            {failed > 0 && (
              <p className="mt-1 text-sm text-red-500">
                {failed} images failed — check console for details
              </p>
            )}
          </div>
        )}

        {/* DB Update Status */}
        {dbUpdateStatus && (
          <div className="mb-6 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
            <p className="text-sm font-semibold text-[var(--wk-text)]">Database Update</p>
            <p className="mt-1 text-sm text-[var(--wk-text-muted)]">{dbUpdateStatus}</p>
          </div>
        )}

        {/* URL list */}
        {urls.length > 0 && !loading && (
          <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--wk-text)]">
                Discovered Images ({urls.length})
              </span>
            </div>
            <div className="max-h-80 overflow-y-auto space-y-1">
              {urls.slice(0, 200).map((u, i) => {
                const result = results.find((r) => r.oldUrl === u.url);
                const statusColor = result
                  ? result.newUrl
                    ? "text-[var(--wk-brand)]"
                    : "text-red-500"
                  : "text-[var(--wk-text-muted)]";
                return (
                  <div
                    key={u.url}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="w-6 shrink-0 text-[var(--wk-text-faint)]">{i + 1}</span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        u.type === "hero"
                          ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                          : "bg-[var(--wk-bg)] text-[var(--wk-text-muted)]"
                      }`}
                    >
                      {u.type}
                    </span>
                    <span className={`truncate ${statusColor}`}>{u.url}</span>
                    {result?.newUrl && (
                      <span className="truncate text-[var(--wk-text-faint)]">→ {result.newUrl.split("/").slice(-1)[0]}</span>
                    )}
                  </div>
                );
              })}
              {urls.length > 200 && (
                <p className="py-2 text-center text-xs text-[var(--wk-text-muted)]">
                  ...and {urls.length - 200} more
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}