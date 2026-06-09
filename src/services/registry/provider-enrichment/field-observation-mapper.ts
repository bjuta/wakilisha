import type {
  NormalizedProviderRelease,
  NormalizedProviderTrack,
  NormalizedProviderArtist,
} from '../../../types/registry/normalized-provider-payload';

export type ProviderFieldObservationInput = {
  providerItemId: string | null;
  entityType: 'release' | 'track' | 'artist';
  fieldName: string;
  fieldValue: string | null;
  provider: NormalizedProviderRelease['provider'];
  confidenceScore: number;
  sourcePath: string;
  rawPayload: unknown;
};

export function mapReleaseToFieldObservations(
  release: NormalizedProviderRelease,
  providerItemId: string | null = null,
): ProviderFieldObservationInput[] {
  const observations: ProviderFieldObservationInput[] = [];

  addObservation(observations, release, providerItemId, 'release', 'title', release.release.title, 0.95, 'release.title');
  addObservation(observations, release, providerItemId, 'release', 'artist_display_name', release.release.artistDisplayName, 0.9, 'release.artistDisplayName');
  addObservation(observations, release, providerItemId, 'release', 'release_date', release.release.releaseDate, 0.95, 'release.releaseDate');
  addObservation(observations, release, providerItemId, 'release', 'release_type', release.release.releaseType, 0.85, 'release.releaseType');
  addObservation(observations, release, providerItemId, 'release', 'track_count', numberToString(release.release.trackCount), 0.95, 'release.trackCount');
  addObservation(observations, release, providerItemId, 'release', 'upc', release.release.upc, 0.95, 'release.upc');
  addObservation(observations, release, providerItemId, 'release', 'ean', release.release.ean, 0.95, 'release.ean');
  addObservation(observations, release, providerItemId, 'release', 'label_name', release.release.labelName, 0.8, 'release.labelName');
  addObservation(observations, release, providerItemId, 'release', 'copyright_text', release.release.copyrightText, 0.75, 'release.copyrightText');
  addObservation(observations, release, providerItemId, 'release', 'genres', arrayToString(release.release.genres), 0.7, 'release.genres');
  addObservation(observations, release, providerItemId, 'release', 'storefront_or_market', release.release.storefrontOrMarket, 0.8, 'release.storefrontOrMarket');
  addObservation(observations, release, providerItemId, 'release', 'artwork_url', release.artwork.url, 0.9, 'artwork.url');
  addObservation(observations, release, providerItemId, 'release', 'provider_url', release.providerUrl, 0.9, 'providerUrl');

  release.tracks.forEach((track, index) => {
    observations.push(...mapTrackToFieldObservations(release, track, index, providerItemId));
  });

  release.artists.forEach((artist, index) => {
    observations.push(...mapArtistToFieldObservations(release, artist, index, providerItemId));
  });

  return observations;
}

function mapTrackToFieldObservations(
  release: NormalizedProviderRelease,
  track: NormalizedProviderTrack,
  index: number,
  providerItemId: string | null,
): ProviderFieldObservationInput[] {
  const observations: ProviderFieldObservationInput[] = [];
  const prefix = `tracks[${index}]`;

  addObservation(observations, release, providerItemId, 'track', 'title', track.title, 0.95, `${prefix}.title`);
  addObservation(observations, release, providerItemId, 'track', 'artist_names', arrayToString(track.artistNames), 0.85, `${prefix}.artistNames`);
  addObservation(observations, release, providerItemId, 'track', 'disc_number', numberToString(track.discNumber), 0.9, `${prefix}.discNumber`);
  addObservation(observations, release, providerItemId, 'track', 'track_number', numberToString(track.trackNumber), 0.95, `${prefix}.trackNumber`);
  addObservation(observations, release, providerItemId, 'track', 'duration_ms', numberToString(track.durationMs), 0.95, `${prefix}.durationMs`);
  addObservation(observations, release, providerItemId, 'track', 'isrc', track.isrc, 0.98, `${prefix}.isrc`);
  addObservation(observations, release, providerItemId, 'track', 'preview_url', track.previewUrl, 0.85, `${prefix}.previewUrl`);
  addObservation(observations, release, providerItemId, 'track', 'provider_url', track.providerUrl, 0.9, `${prefix}.providerUrl`);

  return observations;
}

function mapArtistToFieldObservations(
  release: NormalizedProviderRelease,
  artist: NormalizedProviderArtist,
  index: number,
  providerItemId: string | null,
): ProviderFieldObservationInput[] {
  const observations: ProviderFieldObservationInput[] = [];
  const prefix = `artists[${index}]`;

  addObservation(observations, release, providerItemId, 'artist', 'name', artist.name, 0.9, `${prefix}.name`);
  addObservation(observations, release, providerItemId, 'artist', 'role', artist.role, 0.75, `${prefix}.role`);
  addObservation(observations, release, providerItemId, 'artist', 'provider_url', artist.providerUrl, 0.85, `${prefix}.providerUrl`);

  return observations;
}

function addObservation(
  observations: ProviderFieldObservationInput[],
  release: NormalizedProviderRelease,
  providerItemId: string | null,
  entityType: ProviderFieldObservationInput['entityType'],
  fieldName: string,
  fieldValue: string | null,
  confidenceScore: number,
  sourcePath: string,
): void {
  if (!fieldValue) return;

  observations.push({
    providerItemId,
    entityType,
    fieldName,
    fieldValue,
    provider: release.provider,
    confidenceScore,
    sourcePath,
    rawPayload: release.raw,
  });
}

function numberToString(value: number | null): string | null {
  return typeof value === 'number' ? String(value) : null;
}

function arrayToString(value: string[]): string | null {
  return value.length > 0 ? value.join(', ') : null;
}
