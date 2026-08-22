export function showPath(showSlug: string): string {
  return `/shows/${showSlug}`;
}

export function showEpisodePath(
  showSlug: string,
  episodeSlug: string,
): string {
  return `/shows/${showSlug}/${episodeSlug}`;
}

export function showFeedPath(showSlug: string): string {
  return `/shows/${showSlug}/feed.xml`;
}
