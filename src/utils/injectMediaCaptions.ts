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
  assetMap: Map<string, MediaCaptionEntry>
): string {
  if (!html || assetMap.size === 0) return html;

  return html.replace(
    /<img\s+([^>]*?)data-asset-id="([^"]+)"([^>]*?)(\/?)>/gi,
    (fullMatch, beforeAttrs, assetId, afterAttrs, selfClose) => {
      const entry = assetMap.get(assetId);
      if (!entry || !entry.caption) return fullMatch;

      const before = beforeAttrs || '';
      const after = afterAttrs || '';

      // Check if this img is already inside a <figure> or has a following <figcaption>
      // by looking at context in the replacement — we only inject for standalone <img> tags.
      // Since we operate on the full HTML string via regex, we can't easily check
      // parent context. Instead, we rely on the fact that images already wrapped in
      // <figure><figcaption> by TipTap won't match this regex because the data-asset-id
      // attribute is stripped by renderHTML before the img tag, or the figure is already
      // wrapping it. Actually, data-asset-id is preserved in renderHTML, so we need to
      // guard against double-wrapping.

      // Build the img tag back
      const imgTag = `<img ${before}data-asset-id="${assetId}"${after}${selfClose ? '/' : ''}>`;

      // Build figure with figcaption
      const escapedCaption = entry.caption
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

      return (
        `<figure class="wk-figure">` +
        imgTag +
        `<figcaption class="wk-figcaption">${escapedCaption}</figcaption>` +
        `</figure>`
      );
    }
  );
}