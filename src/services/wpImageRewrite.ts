/**
 * WP Image URL Rewriter
 *
 * Maps old WordPress image URLs (from wakilisha.africa/wp-content/uploads)
 * to their corresponding Supabase Storage URLs in the article-media bucket.
 *
 * The edge function `backfill-article-hero-storage` stores files at:
 *   article-media/wp-import/YYYY/MM/filename.jpg
 *
 * Old URLs look like:
 *   https://wakilisha.africa/wp-content/uploads/YYYY/MM/filename.jpg
 */

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL;

const WP_UPLOADS_BASE = 'https://wakilisha.africa/wp-content/uploads/';
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/article-media/wp-import`;

/**
 * Sanitize a filename to ASCII-only for Supabase Storage compatibility.
 * Must match the edge function's sanitizeFilename exactly.
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/\u2013/g, '-')   // en-dash → hyphen
    .replace(/\u2014/g, '-')   // em-dash → hyphen
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, ''); // strip combining diacritics (ï → i, é → e, etc.)
}

/**
 * Rewrite a single WordPress uploads URL to its Supabase Storage equivalent.
 * Sanitizes the filename portion to match the storage path.
 */
export function rewriteWpImageUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('wakilisha.africa/wp-content/uploads/')) return url;

  const path = url.replace(WP_UPLOADS_BASE, '');
  const rawPath = path.split('?')[0].split('#')[0];
  const decoded = decodeURIComponent(rawPath);

  // Split into directory parts and filename, sanitize only the filename
  const parts = decoded.split('/');
  if (parts.length >= 2) {
    const filename = parts.pop() || '';
    const sanitized = sanitizeFilename(filename);
    return `${STORAGE_BASE}/${parts.join('/')}/${sanitized}`;
  }

  return `${STORAGE_BASE}/${sanitizeFilename(decoded)}`;
}

/**
 * Rewrite all WordPress image URLs in an HTML string.
 */
export function rewriteWpImageUrls(html: string): string {
  if (!html || typeof html !== 'string') return html;

  return html.replace(
    /https:\/\/wakilisha\.africa\/wp-content\/uploads\/([^"'\s\)]+)/g,
    (match, path) => {
      const rawPath = String(path).split('?')[0].split('#')[0];
      const decoded = decodeURIComponent(rawPath);

      const parts = decoded.split('/');
      if (parts.length >= 2) {
        const filename = parts.pop() || '';
        const sanitized = sanitizeFilename(filename);
        return `${STORAGE_BASE}/${parts.join('/')}/${sanitized}`;
      }

      return `${STORAGE_BASE}/${sanitizeFilename(decoded)}`;
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