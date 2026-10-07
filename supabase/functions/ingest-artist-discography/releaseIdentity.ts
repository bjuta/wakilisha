import {
  normalizeUpc,
  providerBindingLookupKey,
  resolveReleaseIdentityV1,
} from "../_shared/provider-identity.ts";

export interface ExistingAppleRelease {
  id: string;
  slug: string;
  title: string;
  upc: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ExistingAppleReleaseMaps {
  byAppleAlbumId: Map<string, ExistingAppleRelease>;
  byUpc: Map<string, ExistingAppleRelease>;
  bySlug: Map<string, ExistingAppleRelease>;
  byTitle: Map<string, ExistingAppleRelease>;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export function appleAlbumIdForRelease(
  release: ExistingAppleRelease,
): string {
  return clean(
    release.metadata?.apple_music_album_id,
  );
}

export function releaseMatchesAppleIdentity(
  release: ExistingAppleRelease,
  appleAlbumId: string,
  upc: string | null,
): boolean {
  const requestedAlbumId = clean(appleAlbumId);
  const requestedUpc = clean(upc);

  const existingAlbumId =
    appleAlbumIdForRelease(release);

  const existingUpc = clean(release.upc);

  if (
    existingAlbumId &&
    requestedAlbumId &&
    existingAlbumId !== requestedAlbumId
  ) {
    return false;
  }

  if (
    existingUpc &&
    requestedUpc &&
    existingUpc !== requestedUpc
  ) {
    return false;
  }

  return true;
}

export function resolveExistingAppleRelease(
  maps: ExistingAppleReleaseMaps,
  input: {
    appleAlbumId: string;
    upc: string | null;
    rawSlug: string;
    normalizedTitle: string;
  },
): ExistingAppleRelease | undefined {
  const appleAlbumId = clean(input.appleAlbumId);
  const providerKey = providerBindingLookupKey(
    "apple_music",
    appleAlbumId,
  );
  const providerMatch = maps.byAppleAlbumId.get(appleAlbumId);
  const upc = normalizeUpc(input.upc);
  const upcMatch = upc ? maps.byUpc.get(upc) : undefined;

  const result = resolveReleaseIdentityV1({
    providerIdsJson: appleAlbumId
      ? { apple_music: [appleAlbumId] }
      : undefined,
    upc,
    releaseIdsByProviderKey: providerMatch
      ? new Map([[providerKey, [providerMatch.id]]])
      : undefined,
    releaseIdsByUpc: upcMatch
      ? new Map([[upc, [upcMatch.id]]])
      : undefined,
  });

  const releaseId = result.canonicalReleaseId;
  if (!releaseId) return undefined;

  if (providerMatch?.id === releaseId) return providerMatch;
  if (upcMatch?.id === releaseId) return upcMatch;

  return undefined;
}
