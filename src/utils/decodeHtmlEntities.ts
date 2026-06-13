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

/**
 * Recursively walk any value (object, array, string, primitive) and decode
 * all HTML entities in every string found. This ensures that data sourced
 * from WordPress — which uses entities in titles, artist names, excerpts,
 * content HTML, and metadata — renders correctly everywhere in the app.
 *
 * Apply this at the data-loading boundary (API responses, Supabase query
 * results) so no consumer has to remember to decode manually.
 */
export function deepDecode<T>(value: T): T {
  if (typeof value === "string") {
    return decodeHtmlEntities(value) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepDecode(item)) as unknown as T;
  }

  if (value !== null && typeof value === "object") {
    const decoded: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      decoded[key] = deepDecode(val);
    }
    return decoded as unknown as T;
  }

  return value;
}