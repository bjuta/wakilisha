function normalizeSlug(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function trackUrl(
  slug: string,
  artistSlugs: string[],
): string {
  const normalizedSlug = normalizeSlug(slug);
  const primaryArtist = normalizeSlug(
    (artistSlugs || []).find(Boolean) || "",
  );

  if (!primaryArtist) {
    return `/tracks/${normalizedSlug}`;
  }

  return `/tracks/${primaryArtist}/${normalizedSlug}`;
}

export function canonicalTrackUrl(
  artistSlug: string,
  trackSlug: string,
): string {
  return trackUrl(
    trackSlug,
    artistSlug ? [artistSlug] : [],
  );
}
