/**
 * Extracts a clean plain-text excerpt from raw HTML article content.
 * - Strips all <h1>–<h6> heading blocks (tags + their text)
 * - Removes remaining HTML tags
 * - Decodes HTML entities
 * - Folds whitespace
 * - Returns first `maxChars` characters, breaking at a word boundary
 */

const HEADING_RE = /<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi;

function stripHtml(raw: string): string {
  return raw.replace(/<[^>]*>/g, "");
}

function decodeEntities(raw: string): string {
  const textarea = typeof document !== "undefined"
    ? (() => {
        const el = document.createElement("textarea");
        el.innerHTML = raw;
        return el.value;
      })()
    : raw;
  return textarea;
}

function collapseWhitespace(raw: string): string {
  return raw.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function truncateAtWord(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const chopped = text.slice(0, maxChars);
  const lastSpace = chopped.lastIndexOf(" ");
  if (lastSpace > maxChars * 0.6) {
    return chopped.slice(0, lastSpace).replace(/[,\s]+$/, "") + "\u2026";
  }
  return chopped.replace(/[,\s]+$/, "") + "\u2026";
}

export function generateExcerpt(html: string | null | undefined, maxChars = 280): string {
  if (!html) return "";

  const withoutHeadings = html.replace(HEADING_RE, " ");

  const plainText = stripHtml(withoutHeadings);

  const decoded = decodeEntities(plainText);

  const clean = collapseWhitespace(decoded);

  if (!clean) return "";

  return truncateAtWord(clean, maxChars);
}