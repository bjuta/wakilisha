/**
 * Track Shortcode Transformer
 *
 * Converts `[wk-track ...]` shortcodes in article HTML into
 * `<!--WK_REGISTRY_TRACK:slug-->` markers.
 *
 * These markers are then picked up by `resolveTrackMarkers`
 * in ArticleTrackEmbeds.tsx and rendered as inline TrackEmbedCard shells
 * with play buttons.
 *
 * Supported formats:
 *   [wk-track diane-antonette]
 *   [wk-track slug="diane-antonette"]
 */

const SHORTCODE_RE = /\[wk-track\s+([^\]]+)\]/gi;

function parseShortcodeArgs(argsRaw: string): { slug: string | null } {
  const result: { slug: string | null } = { slug: null };

  // Tokenize: split by spaces, but respect quoted values
  const tokens: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  for (const char of argsRaw) {
    if (!inQuote && (char === '"' || char === "'")) {
      inQuote = true;
      quoteChar = char;
      continue;
    }
    if (inQuote && char === quoteChar) {
      inQuote = false;
      quoteChar = "";
      continue;
    }
    if (!inQuote && /\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);

  // Parse key="value" or key='value' pairs
  for (const token of tokens) {
    const eqMatch = token.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*=\s*["']?([^"']+)["']?$/);
    if (eqMatch) {
      const key = eqMatch[1].toLowerCase();
      const value = eqMatch[2].trim();
      if (key === "slug" || key === "track") result.slug = value;
      continue;
    }

    // Positional arg: first bare token that looks like a slug
    if (!result.slug && /^[a-z0-9_-]+$/.test(token)) {
      result.slug = token;
    }
  }

  return result;
}

/**
 * Transform all `[wk-track ...]` shortcodes in HTML into registry markers.
 */
export function transformTrackShortcodes(html: string): string {
  if (!html || typeof html !== "string") return html;

  return html.replace(SHORTCODE_RE, (match, argsRaw) => {
    const args = parseShortcodeArgs(argsRaw.trim());
    if (!args.slug) return match;

    return `<!--WK_REGISTRY_TRACK:${args.slug}-->`;
  });
}

/**
 * Strip `[wk-track ...]` shortcodes from HTML (used for excerpt generation).
 */
export function stripTrackShortcodes(html: string): string {
  if (!html || typeof html !== "string") return html;
  return html.replace(SHORTCODE_RE, "");
}