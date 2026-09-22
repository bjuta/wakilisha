function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function normalizeTrackId(value: string | null | undefined): string {
  const candidate = String(value || "").trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(candidate)
    ? candidate
    : "";
}

export function trackUrl(
  slug: string,
  artistSlugs: string[],
  trackId?: string | null,
): string {
  const normalizedSlug = normalizeSlug(slug);
  const primaryArtist = normalizeSlug(artistSlugs[0] || "");
  const canonicalTrackId = normalizeTrackId(trackId);

  if (!primaryArtist) return `/tracks/${normalizedSlug}`;

  if (canonicalTrackId) {
    return `/tracks/${primaryArtist}/${normalizedSlug}/${canonicalTrackId}`;
  }

  return `/tracks/${primaryArtist}/${normalizedSlug}`;
}

export function canonicalTrackUrl(
  artistSlug: string,
  trackSlug: string,
  trackId?: string | null,
): string {
  return trackUrl(
    trackSlug,
    artistSlug ? [artistSlug] : [],
    trackId,
  );
}
