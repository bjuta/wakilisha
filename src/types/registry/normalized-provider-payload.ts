// Phase 6B: Normalized Provider Payload Types

export type NormalizedProviderRelease = {
  provider: 'spotify' | 'apple_music' | 'musicbrainz' | 'youtube' | 'deezer' | 'boomplay' | 'mdundo';
  providerReleaseId: string | null;
  providerUrl: string | null;

  release: {
    title: string;
    normalizedTitle: string;
    artistDisplayName: string | null;
    artistNames: string[];
    releaseDate: string | null;
    releaseDatePrecision: 'day' | 'month' | 'year' | 'unknown';
    releaseType: 'album' | 'single' | 'ep' | 'compilation' | 'unknown';
    trackCount: number | null;
    upc: string | null;
    ean: string | null;
    labelName: string | null;
    copyrightText: string | null;
    genres: string[];
    storefrontOrMarket: string | null;
  };

  artwork: {
    url: string | null;
    width: number | null;
    height: number | null;
    providerRules: string[];
  };

  tracks: NormalizedProviderTrack[];
  artists: NormalizedProviderArtist[];
  raw: unknown;
};

export type NormalizedProviderTrack = {
  providerTrackId: string | null;
  providerUrl: string | null;
  title: string;
  normalizedTitle: string;
  artistNames: string[];
  discNumber: number | null;
  trackNumber: number | null;
  durationMs: number | null;
  isrc: string | null;
  previewUrl: string | null;
  explicit: boolean | null;
};

export type NormalizedProviderArtist = {
  providerArtistId: string | null;
  providerUrl: string | null;
  name: string;
  normalizedName: string;
  role: 'primary_artist' | 'featured_artist' | 'album_artist' | 'unknown';
};