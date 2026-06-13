export function trackUrl(slug: string, artistSlugs?: string[]): string {
  const primaryArtist = artistSlugs?.[0];
  return primaryArtist ? `/tracks/${primaryArtist}/${slug}` : `/tracks/${slug}`;
}