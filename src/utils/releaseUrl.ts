export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function releaseUrl(release: { slug: string; artist: string }): string {
  const artistSlug = slugify(release.artist);
  return `/releases/${artistSlug}/${release.slug}`;
}