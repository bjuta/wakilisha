import { normalizeArticleMediaCaptions } from "@/utils/normalizeArticleMediaCaptions";

/**
 * Inject Media Captions into HTML
 *
 * Scans article HTML for <img data-asset-id="..."> tags, looks up each asset
 * in a provided media-asset map (id → { caption, altText, title }), and wraps
 * eligible images in <figure> with <figcaption> so captions render inline
 * alongside their images rather than only in a separate gallery block.
 *
 * Behaviour:
 *  - Images already wrapped in <figure> are left untouched (caption already present).
 *  - Images with a sibling <figcaption> are left untouched.
 *  - Images without data-asset-id are left untouched.
 *  - Only injects when the media asset actually has caption text.
 */

export interface MediaCaptionEntry {
  caption: string | null;
  altText: string | null;
  title: string | null;
}

/**
 * Build a map from asset ID to caption metadata.
 */
export function buildAssetCaptionMap(
  assets: Array<{ id: string; caption?: string | null; altText?: string | null; title?: string | null }>
): Map<string, MediaCaptionEntry> {
  const map = new Map<string, MediaCaptionEntry>();
  for (const a of assets) {
    if (a.id) {
      map.set(a.id, {
        caption: a.caption ?? null,
        altText: a.altText ?? null,
        title: a.title ?? null,
      });
    }
  }
  return map;
}

/**
 * Inject <figcaption> into HTML for images that reference a media asset
 * with a stored caption, but don't already have a <figcaption> wrapper.
 *
 * Returns the enriched HTML string.
 */
export function injectMediaCaptions(
  html: string,
  assetMap: Map<string, MediaCaptionEntry>,
): string {
  return normalizeArticleMediaCaptions(html, "display", assetMap);
}

/** Editor loading preserves the caption on a media atom, never in body text. */
export function prepareMediaCaptionsForEditor(
  html: string,
  assetMap: Map<string, MediaCaptionEntry>,
): string {
  return normalizeArticleMediaCaptions(html, "editor", assetMap);
}
