/**
 * Media Asset Image Props — shared utility for rendering <img> tags
 * enriched with registry_media_assets metadata.
 *
 * Every public-facing <img> should use getMediaImageProps() or
 * the useMediaImage() hook to get proper alt text, loading="lazy",
 * and width/height hints from the canonical media registry.
 */

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────

export interface MediaImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  loading: "lazy";
  /** CSS classes for the img element */
  className?: string;
}

export interface MediaAssetLite {
  id: string;
  slug: string | null;
  title: string | null;
  url: string;
  mime_type: string | null;
  media_kind: string | null;
  metadata: Record<string, unknown> | null;
}

// ─── In-memory cache ──────────────────────────────────────────

const urlCache = new Map<string, MediaAssetLite | null>();
const idCache = new Map<string, MediaAssetLite | null>();

// ─── Batch Lookup ─────────────────────────────────────────────

/** Chunk URLs to avoid hitting Supabase REST URL length limits */
const BATCH_SIZE = 40;

/**
 * Look up multiple media assets by URL in a single query.
 * Deduplicates URLs and caches results.
 */
export async function batchGetMediaAssetsByUrl(urls: string[]): Promise<Map<string, MediaAssetLite>> {
  const unique = [...new Set(urls.filter(Boolean))];
  const uncached = unique.filter((u) => !urlCache.has(u));
  const result = new Map<string, MediaAssetLite>();

  // Serve from cache first
  for (const u of unique) {
    const cached = urlCache.get(u);
    if (cached) result.set(u, cached);
  }

  if (uncached.length === 0) return result;

  // Process in chunks to avoid PostgREST URL length limits
  const chunks: string[][] = [];
  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    chunks.push(uncached.slice(i, i + BATCH_SIZE));
  }

  for (const chunk of chunks) {
    try {
      const { data, error } = await supabase
        .from("registry_media_assets")
        .select("id, slug, title, url, mime_type, media_kind, metadata")
        .in("url", chunk)
        .eq("status", "active")
        .eq("media_kind", "image");

      if (error) {
        console.warn("WAKILISHA media asset lookup error:", error.message);
        // Cache misses as null for this chunk
        for (const u of chunk) urlCache.set(u, null);
        continue;
      }

      const rows = (data ?? []) as MediaAssetLite[];
      const byUrl = new Map<string, MediaAssetLite>();
      for (const row of rows) {
        if (row.url) byUrl.set(row.url, row);
      }

      for (const u of chunk) {
        const asset = byUrl.get(u) ?? null;
        urlCache.set(u, asset);
        if (asset) result.set(u, asset);
      }
    } catch {
      // On failure, cache as null so we don't retry
      for (const u of chunk) urlCache.set(u, null);
    }
  }

  return result;
}

/**
 * Look up multiple media assets by ID in a single query.
 */
export async function batchGetMediaAssetsById(ids: string[]): Promise<Map<string, MediaAssetLite>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const uncached = unique.filter((i) => !idCache.has(i));
  const result = new Map<string, MediaAssetLite>();

  for (const i of unique) {
    const cached = idCache.get(i);
    if (cached) result.set(i, cached);
  }

  if (uncached.length === 0) return result;

  // Process in chunks to avoid PostgREST URL length limits
  const chunks: string[][] = [];
  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    chunks.push(uncached.slice(i, i + BATCH_SIZE));
  }

  for (const chunk of chunks) {
    try {
      const { data, error } = await supabase
        .from("registry_media_assets")
        .select("id, slug, title, url, mime_type, media_kind, metadata")
        .in("id", chunk)
        .eq("status", "active");

      if (error) {
        console.warn("WAKILISHA media asset ID lookup error:", error.message);
        for (const i of chunk) idCache.set(i, null);
        continue;
      }

      const rows = (data ?? []) as MediaAssetLite[];
      for (const row of rows) {
        idCache.set(row.id, row);
        result.set(row.id, row);
      }

      // Cache misses as null
      for (const i of chunk) {
        if (!idCache.has(i)) idCache.set(i, null);
      }
    } catch {
      for (const i of chunk) idCache.set(i, null);
    }
  }

  return result;
}

// ─── Image Props Builder ──────────────────────────────────────

/**
 * Given a media asset row (or null) and a fallback src/alt,
 * return the complete set of <img> props.
 *
 * Usage:
 *   const props = getMediaImageProps(mediaAsset, { src: fallbackUrl, alt: entityName });
 *   return <img {...props} />;
 */
export function getMediaImageProps(
  asset: MediaAssetLite | null,
  fallback: { src: string; alt: string },
): MediaImageProps {
  const meta = asset?.metadata as Record<string, unknown> | undefined;
  const altText =
    (meta?.alt_text as string) ||
    asset?.title ||
    fallback.alt ||
    "";

  const width = typeof meta?.width === "number" ? meta.width : undefined;
  const height = typeof meta?.height === "number" ? meta.height : undefined;

  return {
    src: asset?.url || fallback.src,
    alt: altText,
    width,
    height,
    loading: "lazy",
  };
}

/**
 * Given a URL and alt text, returns MediaImageProps.
 * If a cached media asset exists for the URL, its metadata
 * (alt text, dimensions) is used. Otherwise falls back to
 * the provided alt text.
 */
export function getImagePropsFromUrl(
  url: string,
  fallbackAlt: string,
  cachedAssets?: Map<string, MediaAssetLite>,
): MediaImageProps {
  const asset = cachedAssets?.get(url) ?? urlCache.get(url) ?? null;
  return getMediaImageProps(asset, { src: url, alt: fallbackAlt });
}

// ─── React Hook ───────────────────────────────────────────────

/**
 * Hook: given an image URL and fallback alt text, returns
 * enriched <img> props. Automatically looks up the media asset
 * from registry_media_assets by URL.
 */
export function useMediaImage(
  url: string | undefined | null,
  fallbackAlt: string,
): MediaImageProps {
  const [asset, setAsset] = useState<MediaAssetLite | null>(
    url ? (urlCache.get(url) ?? null) : null,
  );

  useEffect(() => {
    if (!url) return;
    let alive = true;

    // Check cache first
    const cached = urlCache.get(url);
    if (cached !== undefined) {
      setAsset(cached);
      return;
    }

    // Fetch from Supabase
    supabase
      .from("registry_media_assets")
      .select("id, slug, title, url, mime_type, media_kind, metadata")
      .eq("url", url)
      .eq("status", "active")
      .eq("media_kind", "image")
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        const row = (data as MediaAssetLite) ?? null;
        urlCache.set(url, row);
        setAsset(row);
      })
      .catch(() => {
        if (!alive) return;
        urlCache.set(url, null);
        setAsset(null);
      });

    return () => { alive = false; };
  }, [url]);

  return getMediaImageProps(asset, {
    src: url ?? "",
    alt: fallbackAlt,
  });
}

/**
 * Clear the media asset URL cache. Call after bulk operations
 * (e.g., media library uploads) to ensure fresh data.
 */
export function clearMediaImageCache(url?: string): void {
  if (url) {
    urlCache.delete(url);
  } else {
    urlCache.clear();
    idCache.clear();
  }
}