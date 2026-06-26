/**
 * WP Image URL Rewriter
 *
 * Maps old WordPress image URLs from:
 *   https://wakilisha.africa/wp-content/uploads/YYYY/MM/filename.jpg
 *
 * to the clean Lightsail media origin:
 *   https://media.wakilisha.africa/uploads/YYYY/MM/filename.jpg
 *
 * The old /wp-content/uploads/ path remains available as a compatibility layer,
 * but new runtime rewrites should prefer the clean /uploads/ media path.
 */

const WP_UPLOADS_BASE = 'https://wakilisha.africa/wp-content/uploads/';
const CLEAN_MEDIA_UPLOADS_BASE = 'https://media.wakilisha.africa/uploads/';

/**
 * Rewrite a single WordPress uploads URL to the clean Lightsail media origin.
 */
export function rewriteWpImageUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes(WP_UPLOADS_BASE)) return url;

  return url.replace(WP_UPLOADS_BASE, CLEAN_MEDIA_UPLOADS_BASE);
}

/**
 * Rewrite all WordPress image URLs in an HTML string.
 */
export function rewriteWpImageUrls(html: string): string {
  if (!html || typeof html !== 'string') return html;

  return html.replace(
    /https:\/\/wakilisha\.africa\/wp-content\/uploads\//g,
    CLEAN_MEDIA_UPLOADS_BASE
  );
}

/**
 * Check if a URL is an old WordPress uploads URL.
 */
export function isWpImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.includes(WP_UPLOADS_BASE);
}
