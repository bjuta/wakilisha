export const REGISTRY_TRACK_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizePublicTrackSlug(value: string): string {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function isRegistryTrackId(value: string): boolean {
  return REGISTRY_TRACK_ID_PATTERN.test(String(value || "").trim());
}

export function registryTrackUrl(
  registryTrackId: string,
  trackSlug: string,
): string {
  const id = String(registryTrackId || "").trim().toLowerCase();
  if (!isRegistryTrackId(id)) return "";

  const slug = normalizePublicTrackSlug(trackSlug) || "track";
  return `/tracks/${id}/${slug}`;
}

export function legacyArtistTrackUrl(
  artistSlug: string,
  trackSlug: string,
): string {
  const artist = normalizePublicTrackSlug(artistSlug);
  const track = normalizePublicTrackSlug(trackSlug);

  if (!track) return "/tracks";
  if (!artist) return `/tracks/${track}`;
  return `/tracks/${artist}/${track}`;
}

export function legacyReleaseTrackUrl(
  artistSlug: string,
  releaseSlug: string,
  trackSlug: string,
): string {
  const artist = normalizePublicTrackSlug(artistSlug);
  const release = normalizePublicTrackSlug(releaseSlug);
  const track = normalizePublicTrackSlug(trackSlug);

  if (!artist || !release) {
    return legacyArtistTrackUrl(artist, track);
  }

  return `/releases/${artist}/${release}/${track}`;
}

export type TrackRouteScope =
  | { kind: "registry_track_id"; registryTrackId: string }
  | { kind: "legacy_artist_slug"; artistSlug: string };

export function classifyTrackRouteScope(scope: string): TrackRouteScope {
  const raw = String(scope || "").trim();

  if (isRegistryTrackId(raw)) {
    return {
      kind: "registry_track_id",
      registryTrackId: raw.toLowerCase(),
    };
  }

  return {
    kind: "legacy_artist_slug",
    artistSlug: normalizePublicTrackSlug(raw),
  };
}
