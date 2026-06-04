/**
 * Decode common HTML entities in text strings.
 * Handles: &amp; &lt; &gt; &quot; &#039; &#39; &apos; &#Xxx; &#xxx; &nbsp;
 *
 * WordPress imports often contain these entities in titles, excerpts,
 * and author names. They show as literal text when rendered as React
 * text nodes, so we decode them early in the data-loading layer.
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return str;

  return str
    // Named entities — order matters: &amp; must come first so we don't double-decode
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    // Hex entities &#xXX;
    .replace(/&#x([0-9A-Fa-f]+);/g, (_match: string, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    // Decimal entities &#DDD;
    .replace(/&#(\d+);/g, (_match: string, dec: string) =>
      String.fromCharCode(parseInt(dec, 10))
    )
    // Non-breaking space
    .replace(/&nbsp;/g, "\u00A0");
}

/**
 * Safely decode HTML entities, returning an empty string for
 * null/undefined values rather than the literal strings.
 */
export function safeDecode(val: string | null | undefined): string {
  if (val == null) return "";
  return decodeHtmlEntities(String(val));
}