export type ScopedTrackIdentityMaps = {
  existingTrackByIsrc: Map<string, string>;
  existingTrackByArtistAndSlug: Map<string, string>;
  existingTrackIdToSlug: Map<string, string>;
};

type ResolveScopedTrackIdentityInput = ScopedTrackIdentityMaps & {
  artistSlug: string;
  rawTrackSlug: string;
  trackIsrc: string | null;
  createTrackId: () => string;
};

export type ScopedTrackIdentity = {
  trackId: string;
  trackSlug: string;
  created: boolean;
};

function scopedTrackSlugKey(
  artistSlug: string,
  trackSlug: string,
): string {
  return `${artistSlug}:${trackSlug}`;
}

export function resolveScopedTrackIdentity({
  artistSlug,
  rawTrackSlug,
  trackIsrc,
  existingTrackByIsrc,
  existingTrackByArtistAndSlug,
  existingTrackIdToSlug,
  createTrackId,
}: ResolveScopedTrackIdentityInput): ScopedTrackIdentity {
  const scopedKey = scopedTrackSlugKey(
    artistSlug,
    rawTrackSlug,
  );

  let trackId = trackIsrc
    ? existingTrackByIsrc.get(trackIsrc)
    : undefined;

  if (!trackId) {
    trackId = existingTrackByArtistAndSlug.get(scopedKey);
  }

  if (trackId) {
    const trackSlug =
      existingTrackIdToSlug.get(trackId) ?? rawTrackSlug;

    existingTrackByArtistAndSlug.set(scopedKey, trackId);

    return {
      trackId,
      trackSlug,
      created: false,
    };
  }

  trackId = createTrackId();

  const trackSlug = rawTrackSlug;

  existingTrackIdToSlug.set(trackId, trackSlug);
  existingTrackByArtistAndSlug.set(scopedKey, trackId);

  if (trackIsrc) {
    existingTrackByIsrc.set(trackIsrc, trackId);
  }

  return {
    trackId,
    trackSlug,
    created: true,
  };
}
