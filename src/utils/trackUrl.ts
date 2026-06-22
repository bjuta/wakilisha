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
  const primaryArtist = artistSlugs[0];
  if (!primaryArtist) return `/tracks/${normalizedSlug}`;
  return `/tracks/${primaryArtist}/${normalizedSlug}`;
}