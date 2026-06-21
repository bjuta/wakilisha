/**
 * WPBakery / Visual Composer / Uncode Shortcode Sanitizer
 *
 * Strips WordPress page-builder shortcodes that were carried over
 * during the WP → Supabase migration. These show up as raw text in articles
 * because the React renderer doesn't understand WP shortcode syntax.
 *
 * Handles:
 *  - [vc_raw_html]BASE64[/vc_raw_html]  → decode & inject if valid HTML, else drop
 *  - [vc_*] / [/vc_*]                  → strip tag, keep inner text content
 *  - [uncode_*] / [/uncode_*]           → strip entirely (theme decorators)
 *  - Bare shortcode fragments like [caption ...] etc.
 */

/**
 * Attempt to decode a WPBakery raw_html payload.
 * These are base64(encodeURIComponent(html)) — i.e. URL-encoded then base64.
 */
function decodeVcRawHtml(encoded: string): string {
  try {
    const urlEncoded = atob(encoded.trim());
    const decoded = decodeURIComponent(urlEncoded);
    // If the decoded string is itself a shortcode, drop it
    if (/^\s*\[/.test(decoded)) return '';
    return decoded;
  } catch {
    // Not valid base64 or URL encoding — drop it
    return '';
  }
}

/**
 * Strip all Visual Composer / WPBakery / Uncode shortcodes from an HTML string.
 */
export function sanitizeVcShortcodes(html: string): string {
  if (!html || typeof html !== 'string') return html;

  let result = html;

  // 1. [vc_raw_html]BASE64[/vc_raw_html] → decode and inject or drop
  result = result.replace(
    /\[vc_raw_html\]([\s\S]*?)\[\/vc_raw_html\]/gi,
    (_, encoded) => decodeVcRawHtml(encoded)
  );

  // 2. Strip self-closing vc tags e.g. [vc_empty_space height="32px"]
  result = result.replace(/\[vc_[^\]]*?\/\]/gi, '');

  // 3. Strip opening vc tags (with or without attributes) — keep inner content
  result = result.replace(/\[vc_[^\]]*?\]/gi, '');

  // 4. Strip closing vc tags
  result = result.replace(/\[\/vc_[^\]]*?\]/gi, '');

  // 5. Strip uncode_* shortcodes (Uncode theme) entirely including their content
  result = result.replace(/\[uncode_[^\]]*?\][\s\S]*?\[\/uncode_[^\]]*?\]/gi, '');
  result = result.replace(/\[uncode_[^\]]*?\/?\]/gi, '');
  result = result.replace(/\[\/uncode_[^\]]*?\]/gi, '');

  // 6. Strip other common WP shortcodes that sneak through
  //    [caption ...] ... [/caption] — convert to proper <figure> with <figcaption>
  //    Preserves the caption structure so image context isn't lost
  result = result.replace(
    /\[caption[^\]]*?\]([\s\S]*?)\[\/caption\]/gi,
    (_match: string, inner: string) => {
      const alignMatch = _match.match(/align="([^"]*)"/i);
      const alignClass = alignMatch ? alignMatch[1] : '';
      const imgMatch = inner.match(/<img[^>]*\/?>/i);
      if (!imgMatch) return inner.trim();
      const imgTag = imgMatch[0];
      const captionText = inner.slice(inner.indexOf(imgTag) + imgTag.length).trim();
      if (!captionText) return imgTag;
      const figClass = alignClass ? `wp-caption ${alignClass}` : 'wp-caption';
      return `<figure class="${figClass}">${imgTag}<figcaption>${captionText}</figcaption></figure>`;
    }
  );

  //    [gallery ...] — drop entirely (no useful content)
  result = result.replace(/\[gallery[^\]]*?\]/gi, '');

  //    [embed ...] ... [/embed] — kept for embedRichMedia to process downstream

  //    [playlist ...] — drop
  result = result.replace(/\[playlist[^\]]*?\]/gi, '');

  //    [audio ...] — drop
  result = result.replace(/\[audio[^\]]*?\]/gi, '');

  //    [video ...] — drop
  result = result.replace(/\[video[^\]]*?\]/gi, '');

  // 7. Strip leftover orphan uncode_shortcode_id attributes that end up as bare text
  //    e.g. uncode_shortcode_id="307687"
  result = result.replace(/\s*uncode_shortcode_id="[^"]*"/gi, '');

  // 8. Clean up any multiple consecutive blank lines / whitespace artifacts
  //    from removed tags — collapse runs of 3+ newlines to 2
  result = result.replace(/(\n\s*){3,}/g, '\n\n');

  return result;
}