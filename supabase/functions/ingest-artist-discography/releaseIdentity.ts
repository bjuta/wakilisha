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
  const appleAlbumId = clean(
    input.appleAlbumId,
  );

  const upc = clean(input.upc);

  const exactProviderMatch =
    maps.byAppleAlbumId.get(appleAlbumId);

  if (exactProviderMatch) {
    return exactProviderMatch;
  }

  if (upc) {
    const exactUpcMatch =
      maps.byUpc.get(upc);

    if (exactUpcMatch) {
      return exactUpcMatch;
    }
  }

  const candidates = [
    maps.bySlug.get(input.rawSlug),
    maps.byTitle.get(
      input.normalizedTitle,
    ),
  ];

  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (seen.has(candidate.id)) continue;

    seen.add(candidate.id);

    if (
      releaseMatchesAppleIdentity(
        candidate,
        appleAlbumId,
        input.upc,
      )
    ) {
      return candidate;
    }
  }

  return undefined;
}
