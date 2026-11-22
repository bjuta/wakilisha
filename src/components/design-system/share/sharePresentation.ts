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
  if (item.type === "article") return title;
  return clean(item.description) || clean(item.subtitle) || title;
}

/**
 * Article shares always use their canonical public route.
 * This intentionally excludes draft-preview tokens and inbound UTM values.
 */
export function canonicalArticleShareUrl(slug: string): string {
  return `${PUBLIC_ORIGIN}/magazine/${encodeURIComponent(slug.trim())}`;
}
