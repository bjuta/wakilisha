export function trackUrl(slug: string, artistSlugs: string[]): string {
  const primaryArtist = artistSlugs[0];
  if (!primaryArtist) return `/tracks/${slug}`;
  return `/tracks/${primaryArtist}/${slug}`;
}