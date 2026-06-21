/**
 * Entity Media Enrichment — attaches registry_media_assets metadata
 * to public entity results (artists, releases, articles, labels).
 *
 * Each entity getter in publicContent/client.ts calls these functions
 * as a post-processing step, batch-looking up media assets by URL.
 */

import { batchGetMediaAssetsByUrl, type MediaAssetLite } from "@/utils/mediaAssetProps";

// ─── Enriched types (attach to public entity types) ───────────

export interface HeroMediaEnrichment {
  heroMediaAsset: MediaAssetLite | null;
}

export interface ArtworkMediaEnrichment {
  artworkMediaAsset: MediaAssetLite | null;
}

export interface ProfileMediaEnrichment {
  profileMediaAsset: MediaAssetLite | null;
}

// ─── Artist enrichment ────────────────────────────────────────

export async function enrichArtistMedia<T extends { imageUrl?: string | null; profileImageUrl?: string | null }>(
  artist: T,
): Promise<T & HeroMediaEnrichment & ProfileMediaEnrichment> {
  const urls = [artist.imageUrl, artist.profileImageUrl].filter(Boolean) as string[];
  const result = { ...artist, heroMediaAsset: null as MediaAssetLite | null, profileMediaAsset: null as MediaAssetLite | null };

  if (urls.length === 0) return result;

  try {
    const assets = await batchGetMediaAssetsByUrl(urls);
    if (artist.imageUrl) result.heroMediaAsset = assets.get(artist.imageUrl) ?? null;
    if (artist.profileImageUrl) result.profileMediaAsset = assets.get(artist.profileImageUrl) ?? null;
  } catch {
    // Best-effort
  }

  return result;
}

/**
 * Batch-enrich multiple artists at once.
 */
export async function enrichArtistsMedia<T extends { imageUrl?: string | null }>(
  artists: T[],
): Promise<Array<T & HeroMediaEnrichment>> {
  const urls = artists.map((a) => a.imageUrl).filter(Boolean) as string[];
  if (urls.length === 0) return artists.map((a) => ({ ...a, heroMediaAsset: null }));

  try {
    const assets = await batchGetMediaAssetsByUrl(urls);
    return artists.map((a) => ({
      ...a,
      heroMediaAsset: a.imageUrl ? (assets.get(a.imageUrl) ?? null) : null,
    }));
  } catch {
    return artists.map((a) => ({ ...a, heroMediaAsset: null }));
  }
}

// ─── Release enrichment ───────────────────────────────────────

export async function enrichReleaseMedia<T extends { artworkUrl?: string }>(
  release: T,
): Promise<T & ArtworkMediaEnrichment> {
  if (!release.artworkUrl) return { ...release, artworkMediaAsset: null };

  try {
    const assets = await batchGetMediaAssetsByUrl([release.artworkUrl]);
    return { ...release, artworkMediaAsset: assets.get(release.artworkUrl) ?? null };
  } catch {
    return { ...release, artworkMediaAsset: null };
  }
}

/**
 * Batch-enrich multiple releases at once.
 */
export async function enrichReleasesMedia<T extends { artworkUrl?: string }>(
  releases: T[],
): Promise<Array<T & ArtworkMediaEnrichment>> {
  const urls = releases.map((r) => r.artworkUrl).filter(Boolean) as string[];
  if (urls.length === 0) return releases.map((r) => ({ ...r, artworkMediaAsset: null }));

  try {
    const assets = await batchGetMediaAssetsByUrl(urls);
    return releases.map((r) => ({
      ...r,
      artworkMediaAsset: r.artworkUrl ? (assets.get(r.artworkUrl) ?? null) : null,
    }));
  } catch {
    return releases.map((r) => ({ ...r, artworkMediaAsset: null }));
  }
}

// ─── Article/story enrichment ─────────────────────────────────

export async function enrichArticleMedia<T extends { heroUrl?: string }>(
  article: T,
): Promise<T & HeroMediaEnrichment> {
  if (!article.heroUrl) return { ...article, heroMediaAsset: null };

  try {
    const assets = await batchGetMediaAssetsByUrl([article.heroUrl]);
    return { ...article, heroMediaAsset: assets.get(article.heroUrl) ?? null };
  } catch {
    return { ...article, heroMediaAsset: null };
  }
}

/**
 * Batch-enrich multiple articles at once.
 */
export async function enrichArticlesMedia<T extends { heroUrl?: string }>(
  articles: T[],
): Promise<Array<T & HeroMediaEnrichment>> {
  const urls = articles.map((a) => a.heroUrl).filter(Boolean) as string[];
  if (urls.length === 0) return articles.map((a) => ({ ...a, heroMediaAsset: null }));

  try {
    const assets = await batchGetMediaAssetsByUrl(urls);
    return articles.map((a) => ({
      ...a,
      heroMediaAsset: a.heroUrl ? (assets.get(a.heroUrl) ?? null) : null,
    }));
  } catch {
    return articles.map((a) => ({ ...a, heroMediaAsset: null }));
  }
}

// ─── Label enrichment ─────────────────────────────────────────

export async function enrichLabelMedia<T extends { logoUrl?: string | null }>(
  label: T,
): Promise<T & HeroMediaEnrichment> {
  if (!label.logoUrl) return { ...label, heroMediaAsset: null };

  try {
    const assets = await batchGetMediaAssetsByUrl([label.logoUrl]);
    return { ...label, heroMediaAsset: assets.get(label.logoUrl) ?? null };
  } catch {
    return { ...label, heroMediaAsset: null };
  }
}

// ─── Track enrichment ─────────────────────────────────────────

export async function enrichTrackArtwork<T extends { artworkUrl?: string }>(
  track: T,
): Promise<T & ArtworkMediaEnrichment> {
  if (!track.artworkUrl) return { ...track, artworkMediaAsset: null };

  try {
    const assets = await batchGetMediaAssetsByUrl([track.artworkUrl]);
    return { ...track, artworkMediaAsset: assets.get(track.artworkUrl) ?? null };
  } catch {
    return { ...track, artworkMediaAsset: null };
  }
}