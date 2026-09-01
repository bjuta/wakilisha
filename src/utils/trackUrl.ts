import {
  isRegistryTrackId,
  legacyArtistTrackUrl,
  legacyReleaseTrackUrl,
  normalizePublicTrackSlug,
  registryTrackUrl,
} from "../../shared/registry/public-track-route";

export {
  isRegistryTrackId,
  legacyArtistTrackUrl,
  legacyReleaseTrackUrl,
  normalizePublicTrackSlug,
  registryTrackUrl,
};

export function trackUrl(slug: string, artistSlugs: string[]): string {
  return legacyArtistTrackUrl(artistSlugs[0] || "", slug);
}

export function releaseTrackUrl(
  artistSlug: string,
  releaseSlug: string,
  trackSlug: string,
): string {
  return legacyReleaseTrackUrl(
    artistSlug,
    releaseSlug,
    trackSlug,
  );
}

export function canonicalTrackUrl(
  registryTrackId: string,
  trackSlug: string,
): string {
  return registryTrackUrl(
    registryTrackId,
    trackSlug,
  );
}
