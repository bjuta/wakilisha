/**
 * WP Image URL Rewriter
 *
 * Maps old WordPress image URLs (from wakilisha.africa/wp-content/uploads)
 * to their corresponding Supabase Storage URLs in the article-media bucket.
 *
 * The edge function `migrate-wp-images` stores files at:
 *   article-media/wp-import/YYYY/MM/filename.jpg
 *
 * Old URLs look like:
 *   https://wakilisha.africa/wp-content/uploads/YYYY/MM/filename.jpg
 */

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL;

const WP_UPLOADS_BASE = 'https://wakilisha.africa/wp-content/uploads/';
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/article-media/wp-import`;

/**
 * Rewrite a single WordPress uploads URL to its Supabase Storage equivalent.
 */
export function rewriteWpImageUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('wakilisha.africa/wp-content/uploads/')) return url;

  const path = url.replace(WP_UPLOADS_BASE, '');
  // Remove any query params or hash
  const cleanPath = path.split('?')[0].split('#')[0];
  return `${STORAGE_BASE}/${cleanPath}`;
}

/**
 * Rewrite all WordPress image URLs in an HTML string.
 */
export function rewriteWpImageUrls(html: string): string {
  if (!html || typeof html !== 'string') return html;

  return html.replace(
    /https:\/\/wakilisha\.africa\/wp-content\/uploads\/([^"'\s\)]+)/g,
    (match, path) => {
      const cleanPath = String(path).split('?')[0].split('#')[0];
      return `${STORAGE_BASE}/${cleanPath}`;
    }
  );
}

/**
 * Check if a URL is an old WordPress uploads URL.
 */
export function isWpImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.includes('wakilisha.africa/wp-content/uploads/');
}