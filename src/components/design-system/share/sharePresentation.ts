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
