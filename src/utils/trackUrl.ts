function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function trackUrl(slug: string, artistSlugs: string[]): string {
  const normalizedSlug = normalizeSlug(slug);
  const primaryArtist = normalizeSlug(artistSlugs[0] || "");
  if (!primaryArtist) return `/tracks/${normalizedSlug}`;
  return `/tracks/${primaryArtist}/${normalizedSlug}`;
}

export function releaseTrackUrl(
  artistSlug: string,
  releaseSlug: string,
  trackSlug: string,
): string {
  const normalizedArtist = normalizeSlug(artistSlug);
  const normalizedRelease = normalizeSlug(releaseSlug);
  const normalizedTrack = normalizeSlug(trackSlug);

  if (!normalizedArtist || !normalizedRelease) {
    return trackUrl(normalizedTrack, normalizedArtist ? [normalizedArtist] : []);
  }

  return `/releases/${normalizedArtist}/${normalizedRelease}/${normalizedTrack}`;
}