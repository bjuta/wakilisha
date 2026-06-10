import type {
  NormalizedProviderArtist,
  NormalizedProviderRelease,
  NormalizedProviderTrack,
} from '../../../types/registry/normalized-provider-payload';

type JsonRecord = Record<string, unknown>;

type AppleMusicArtwork = {
  url?: string;
  width?: number;
  height?: number;
  bgColor?: string;
  textColor1?: string;
  textColor2?: string;
  textColor3?: string;
  textColor4?: string;
};

type AppleMusicPreview = {
  url?: string;
};

type AppleMusicAttributes = {
  albumName?: string;
  artistName?: string;
  artwork?: AppleMusicArtwork;
  composerName?: string;
  contentRating?: string;
  copyright?: string;
  discNumber?: number;
  durationInMillis?: number;
  editorialNotes?: JsonRecord;
  genreNames?: string[];
  hasLyrics?: boolean;
  isAppleDigitalMaster?: boolean;
  isCompilation?: boolean;
  isComplete?: boolean;
  isMasteredForItunes?: boolean;
  isSingle?: boolean;
  isrc?: string;
  name?: string;
  playParams?: JsonRecord;
  previews?: AppleMusicPreview[];
  recordLabel?: string;
  releaseDate?: string;
  trackCount?: number;
  trackNumber?: number;
  upc?: string;
  url?: string;
};

type AppleMusicResource = {
  id?: string;
  type?: string;
  href?: string;
  attributes?: AppleMusicAttributes;
  relationships?: {
    artists?: {
      data?: AppleMusicResource[];
    };
    tracks?: {
      data?: AppleMusicResource[];
    };
  };
};

type AppleMusicCatalogAlbumResponse = {
  data?: AppleMusicResource[];
};

export type AppleMusicAdapterOptions = {
  developerToken: string;
  storefront?: string;
  fetchImpl?: typeof fetch;
};

export class AppleMusicAdapterError extends Error {
  readonly status: number | null;
  readonly responseBody: string | null;

  constructor(message: string, status: number | null = null, responseBody: string | null = null) {
    super(message);
    this.name = 'AppleMusicAdapterError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

export class AppleMusicAdapter {
  private readonly developerToken: string;
  private readonly defaultStorefront: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AppleMusicAdapterOptions) {
    if (!options.developerToken) {
      throw new AppleMusicAdapterError('Apple Music developer token is required.');
    }

    this.developerToken = options.developerToken;
    this.defaultStorefront = options.storefront ?? 'ke';
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  static fromEnv(storefront = 'ke'): AppleMusicAdapter {
    const developerToken = typeof import.meta !== 'undefined' && import.meta.env?.APPLE_MUSIC_DEVELOPER_TOKEN
      ? String(import.meta.env.APPLE_MUSIC_DEVELOPER_TOKEN)
      : '';
    if (!developerToken) {
      throw new AppleMusicAdapterError('APPLE_MUSIC_DEVELOPER_TOKEN is required.');
    }

    return new AppleMusicAdapter({ developerToken, storefront });
  }

  static parseAlbumId(urlOrId: string | null | undefined): string | null {
    if (!urlOrId) return null;
    if (/^\d+$/.test(urlOrId)) return urlOrId;

    try {
      const parsedUrl = new URL(urlOrId);
      const segments = parsedUrl.pathname.split('/').filter(Boolean);
      const lastNumericSegment = [...segments].reverse().find((segment) => /^\d+$/.test(segment));
      return lastNumericSegment ?? parsedUrl.searchParams.get('i');
    } catch {
      return null;
    }
  }

  async fetchAlbum(albumIdOrUrl: string, options: { storefront?: string; include?: string } = {}): Promise<NormalizedProviderRelease> {
    const albumId = AppleMusicAdapter.parseAlbumId(albumIdOrUrl);
    if (!albumId) {
      throw new AppleMusicAdapterError('A numeric Apple Music album ID or valid Apple Music album URL is required.');
    }

    const storefront = options.storefront ?? this.defaultStorefront;
    const include = options.include ?? 'tracks,artists';
    const endpoint = new URL(`https://api.music.apple.com/v1/catalog/${storefront}/albums/${albumId}`);
    endpoint.searchParams.set('include', include);

    const response = await this.fetchImpl(endpoint, {
      headers: {
        Authorization: `Bearer ${this.developerToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AppleMusicAdapterError(
        `Apple Music album request failed: ${response.status} ${response.statusText}`,
        response.status,
        errorText,
      );
    }

    const payload = (await response.json()) as AppleMusicCatalogAlbumResponse;
    const album = payload.data?.[0];
    if (!album) {
      throw new AppleMusicAdapterError(`Apple Music album not found: ${albumId}`);
    }

    return normalizeAppleMusicAlbum(album, storefront, payload);
  }
}

function normalizeAppleMusicAlbum(
  album: AppleMusicResource,
  storefront: string,
  raw: AppleMusicCatalogAlbumResponse,
): NormalizedProviderRelease {
  const attributes = album.attributes ?? {};
  const tracks = album.relationships?.tracks?.data ?? [];
  const artists = album.relationships?.artists?.data ?? [];
  const title = attributes.name ?? '';
  const artistDisplayName = attributes.artistName ?? null;
  const artwork = normalizeArtwork(attributes.artwork);
  const trackCount = attributes.trackCount ?? (tracks.length > 0 ? tracks.length : null);

  return {
    provider: 'apple_music',
    providerReleaseId: album.id ?? null,
    providerUrl: attributes.url ?? null,
    release: {
      title,
      normalizedTitle: normalizeText(title),
      artistDisplayName,
      artistNames: artistDisplayName ? [artistDisplayName] : artists.map((artist) => artist.attributes?.name).filter(isString),
      releaseDate: attributes.releaseDate ?? null,
      releaseDatePrecision: inferReleaseDatePrecision(attributes.releaseDate),
      releaseType: inferReleaseType(attributes, trackCount),
      trackCount,
      upc: attributes.upc ?? null,
      ean: null,
      labelName: attributes.recordLabel ?? null,
      copyrightText: attributes.copyright ?? null,
      genres: attributes.genreNames ?? [],
      storefrontOrMarket: storefront,
    },
    artwork: {
      url: artwork.url,
      width: artwork.width,
      height: artwork.height,
      providerRules: [
        'apple_music_catalog_source',
        'preserve_provider_url',
        'storefront_specific_response',
        'artwork_url_may_be_template',
      ],
    },
    tracks: tracks.map(normalizeAppleMusicTrack),
    artists: artists.map(normalizeAppleMusicArtist),
    raw,
  };
}

function normalizeAppleMusicTrack(track: AppleMusicResource): NormalizedProviderTrack {
  const attributes = track.attributes ?? {};
  const title = attributes.name ?? '';

  return {
    providerTrackId: track.id ?? null,
    providerUrl: attributes.url ?? null,
    title,
    normalizedTitle: normalizeText(title),
    artistNames: attributes.artistName ? [attributes.artistName] : [],
    discNumber: attributes.discNumber ?? null,
    trackNumber: attributes.trackNumber ?? null,
    durationMs: attributes.durationInMillis ?? null,
    isrc: attributes.isrc ?? null,
    previewUrl: attributes.previews?.find((preview) => isString(preview.url))?.url ?? null,
    explicit: attributes.contentRating ? attributes.contentRating.toLowerCase() === 'explicit' : null,
  };
}

function normalizeAppleMusicArtist(artist: AppleMusicResource): NormalizedProviderArtist {
  const name = artist.attributes?.name ?? '';

  return {
    providerArtistId: artist.id ?? null,
    providerUrl: artist.attributes?.url ?? null,
    name,
    normalizedName: normalizeText(name),
    role: 'album_artist',
  };
}

function normalizeArtwork(artwork: AppleMusicArtwork | undefined): { url: string | null; width: number | null; height: number | null } {
  if (!artwork?.url) {
    return { url: null, width: null, height: null };
  }

  const width = artwork.width ?? 1200;
  const height = artwork.height ?? 1200;
  const resolvedUrl = artwork.url
    .replace('{w}', String(width))
    .replace('{h}', String(height))
    .replace('{f}', 'jpg');

  return {
    url: resolvedUrl,
    width,
    height,
  };
}

function inferReleaseType(
  attributes: AppleMusicAttributes,
  trackCount: number | null,
): NormalizedProviderRelease['release']['releaseType'] {
  if (attributes.isCompilation) return 'compilation';
  if (attributes.isSingle) return trackCount && trackCount > 1 ? 'ep' : 'single';
  return 'album';
}

function inferReleaseDatePrecision(date: string | undefined): NormalizedProviderRelease['release']['releaseDatePrecision'] {
  if (!date) return 'unknown';
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'day';
  if (/^\d{4}-\d{2}$/.test(date)) return 'month';
  if (/^\d{4}$/.test(date)) return 'year';
  return 'unknown';
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
