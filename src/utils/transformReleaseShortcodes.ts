/**
 * Release Shortcode Transformer
 *
 * Converts `[wk-release ...]` shortcodes in article HTML into
 * `<!--WK_REGISTRY_RELEASE:slug:artistSlug:artistName-->` markers.
 *
 * These markers are then picked up by `resolveRegistryReleaseMarkers`
 * in ArticleReleaseEmbeds.tsx and rendered as rich ReleaseEmbedCard shells.
 *
 * Supported formats:
 *   [wk-release mtoto-wa-khadija]
 *   [wk-release slug="mtoto-wa-khadija"]
 *   [wk-release slug="mtoto-wa-khadija" artist="mejja"]
 *   [wk-release mtoto-wa-khadija artist="mejja"]
 */

const SHORTCODE_RE = /\[wk-release\s+([^\]]+)\]/gi;

function parseShortcodeArgs(argsRaw: string): {
  slug: string | null;
  artistSlug: string | null;
  artistName: string | null;
} {
  const slug: string | null = null;
  const artistSlug: string | null = null;
  const artistName: string | null = null;

  const result: { slug: string | null; artistSlug: string | null; artistName: string | null } = {
    slug,
    artistSlug,
    artistName,
  };

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
      if (key === "slug" || key === "release") result.slug = value;
      if (key === "artist" || key === "artist_slug") result.artistSlug = value;
      if (key === "artist_name" || key === "name") result.artistName = value;
      continue;
    }

    // Positional arg: first bare token that looks like a slug is the slug
    if (!result.slug && /^[a-z0-9_-]+$/.test(token)) {
      result.slug = token;
      continue;
    }

    // If second bare token, treat as artist slug
    if (!result.artistSlug && /^[a-z0-9_-]+$/.test(token)) {
      result.artistSlug = token;
    }
  }

  return result;
}

/**
 * Transform all `[wk-release ...]` shortcodes in HTML into registry markers.
 */
export function transformReleaseShortcodes(html: string): string {
  if (!html || typeof html !== "string") return html;

  return html.replace(SHORTCODE_RE, (match, argsRaw) => {
    const args = parseShortcodeArgs(argsRaw.trim());
    if (!args.slug) return match; // Can't parse — leave as-is

    const artistSlug = args.artistSlug || "";
    const artistName = encodeURIComponent(args.artistName || "");

    return `<!--WK_REGISTRY_RELEASE:${args.slug}:${artistSlug}:${artistName}-->`;
  });
}

/**
 * Strip `[wk-release ...]` shortcodes from HTML (used for excerpt generation).
 */
export function stripReleaseShortcodes(html: string): string {
  if (!html || typeof html !== "string") return html;
  return html.replace(SHORTCODE_RE, "");
}