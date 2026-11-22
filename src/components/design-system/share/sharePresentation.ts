/** Shared, side-effect-free social sharing presentation authority. */
export interface SharePresentationSource {
  title: string;
  subtitle?: string;
  description?: string;
  type?: string;
}

const PUBLIC_ORIGIN = "https://wakilisha.africa";

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

/**
 * An Article's headline is its share message, never the author, byline,
 * or teaser. Preserve the established contextual text for other surfaces.
 */
export function shareTextForItem(item: SharePresentationSource): string {
  const title = clean(item.title);
  const subtitle = clean(item.subtitle);
  const description = clean(item.description);

  // Authored social posts have no editorial headline. Share the post itself.
  if (item.type === "post" || item.type === "artist_update") {
    return description || title || subtitle;
  }

  // The release or track title always leads, with useful artist context.
  if (item.type === "track" || item.type === "album") {
    return title && subtitle ? `${title} by ${subtitle}` : title || subtitle || description;
  }

  // Articles, playlists, charts, profiles and pages have deliberate titles.
  return title || description || subtitle;
}

/**
 * Article shares always use their canonical public route.
 * This intentionally excludes draft-preview tokens and inbound UTM values.
 */
export function canonicalArticleShareUrl(slug: string): string {
  return `${PUBLIC_ORIGIN}/magazine/${encodeURIComponent(slug.trim())}`;
}

/**
 * X and other social crawlers cache card metadata by shared URL. Different
 * immutable *published snapshot* IDs must produce different share URLs while
 * the Article canonical URL and on-site SEO identity remain unchanged.
 *
 * This key is stable for a published version (no random cache-busting or
 * per-share churn). The snapshot UUID already appears in the public Article
 * response. Never version draft/preview URLs or an unrelated route.
 */
export function publishedArticleCardUrl(
  baseUrl: string,
  publishedSnapshotId: string | null | undefined,
): string {
  const id = (publishedSnapshotId ?? "").trim();
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) {
    return baseUrl;
  }

  try {
    const parsed = new URL(baseUrl);
    if (
      parsed.origin !== PUBLIC_ORIGIN ||
      !/^\/magazine\/[a-z0-9]+(?:[-_][a-z0-9]+)*$/i.test(parsed.pathname) ||
      parsed.searchParams.has("preview")
    ) {
      return baseUrl;
    }
    parsed.searchParams.set("wk_card_v", id.toLowerCase());
    return parsed.toString();
  } catch {
    return baseUrl;
  }
}

/** Only public HTTP(S) image URLs may be handed to third-party share services. */
export function shareImageUrl(raw: string | null | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const url = new URL(raw, PUBLIC_ORIGIN);
    if (!["https:", "http:"].includes(url.protocol)) return undefined;
    if (url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}
