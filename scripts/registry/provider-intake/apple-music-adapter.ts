/**
 * Backend Apple Music adapter for provider intake.
 * Searches Apple Music catalog and returns normalized results.
 */

import type {
  ProviderEntityType,
  ProviderInspectInput,
  ProviderInspectResponse,
  ProviderRelatedEntity,
  ProviderSearchInput,
  ProviderSearchResponse,
  ProviderSearchResult,
  RegistryMatchCandidate,
} from "./types";

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
    this.name = "AppleMusicAdapterError";
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
      throw new AppleMusicAdapterError("Apple Music developer token is required.");
    }
    this.developerToken = options.developerToken;
    this.defaultStorefront = options.storefront ?? "ke";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  static fromEnv(storefront = "ke"): AppleMusicAdapter {
    const developerToken = process.env.APPLE_MUSIC_DEVELOPER_TOKEN ?? "";
    if (!developerToken) {
      throw new AppleMusicAdapterError("APPLE_MUSIC_DEVELOPER_TOKEN env var is required.");
    }
    return new AppleMusicAdapter({ developerToken, storefront });
  }

  // ── Search ───────────────────────────────────────────────────────────────

  async search(input: ProviderSearchInput): Promise<ProviderSearchResponse> {
    const storefront = input.storefrontOrMarket ?? this.defaultStorefront;
    const types = input.entityType === "all"
      ? "artists,albums,songs"
      : entityTypeToAppleMusicTypes(input.entityType);

    const endpoint = new URL(
      `https://api.music.apple.com/v1/catalog/${storefront}/search`,
    );
    endpoint.searchParams.set("term", input.query);
    endpoint.searchParams.set("types", types);
    endpoint.searchParams.set("limit", String(Math.min(input.limit, 25)));

    const response = await this.fetchImpl(endpoint, {
      headers: {
        Authorization: `Bearer ${this.developerToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AppleMusicAdapterError(
        `Apple Music search failed: ${response.status} ${response.statusText}`,
        response.status,
        errorText,
      );
    }

    const payload = (await response.json()) as AppleMusicSearchResponse;
    return normalizeSearchResponse(payload, input);
  }

  // ── Inspect (full lookup by ID) ─────────────────────────────────────────

  async inspect(input: ProviderInspectInput): Promise<ProviderInspectResponse> {
    const storefront = input.storefrontOrMarket ?? this.defaultStorefront;
    const { providerEntityType, providerEntityId } = input;

    let normalized: ProviderSearchResult;
    let detailTracks: ProviderSearchResult[] = [];
    let detailArtists: ProviderSearchResult[] = [];
    let detailLabels: ProviderRelatedEntity[] = [];
    let providerLinks: ProviderInspectResponse["detail"]["providerLinks"] = [];

    if (providerEntityType === "release") {
      const endpoint = new URL(
        `https://api.music.apple.com/v1/catalog/${storefront}/albums/${providerEntityId}`,
      );
      endpoint.searchParams.set("include", "tracks,artists");

      const response = await this.fetchImpl(endpoint, {
        headers: {
          Authorization: `Bearer ${this.developerToken}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AppleMusicAdapterError(
          `Apple Music album lookup failed: ${response.status}`,
          response.status,
          errorText,
        );
      }

      const payload = (await response.json()) as AppleMusicAlbumResponse;
      const album = payload.data?.[0];
      if (!album) {
        throw new AppleMusicAdapterError(`Album not found: ${providerEntityId}`);
      }

      normalized = normalizeAlbum(album, storefront, input);
      detailTracks = (album.relationships?.tracks?.data ?? []).map((track) =>
        normalizeSong(track, storefront, input),
      );
      detailArtists = (album.relationships?.artists?.data ?? []).map((artist) =>
        normalizeArtist(artist, storefront, input),
      );

      providerLinks = [
        { entityType: "release", providerEntityId: album.id ?? providerEntityId, providerUrl: album.attributes?.url ?? null },
        ...(album.relationships?.artists?.data ?? []).map((artist) => ({
          entityType: "artist" as ProviderEntityType,
          providerEntityId: artist.id ?? "",
          providerUrl: artist.attributes?.url ?? null,
        })),
        ...(album.relationships?.tracks?.data ?? []).map((track) => ({
          entityType: "track" as ProviderEntityType,
          providerEntityId: track.id ?? "",
          providerUrl: track.attributes?.url ?? null,
        })),
      ];
    } else if (providerEntityType === "track") {
      const endpoint = new URL(
        `https://api.music.apple.com/v1/catalog/${storefront}/songs/${providerEntityId}`,
      );
      endpoint.searchParams.set("include", "albums,artists");

      const response = await this.fetchImpl(endpoint, {
        headers: {
          Authorization: `Bearer ${this.developerToken}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AppleMusicAdapterError(
          `Apple Music song lookup failed: ${response.status}`,
          response.status,
          errorText,
        );
      }

      const payload = (await response.json()) as AppleMusicSongResponse;
      const song = payload.data?.[0];
      if (!song) {
        throw new AppleMusicAdapterError(`Song not found: ${providerEntityId}`);
      }

      normalized = normalizeSong(song, storefront, input);
      detailArtists = (song.relationships?.artists?.data ?? []).map((artist) =>
        normalizeArtist(artist, storefront, input),
      );
      detailTracks = [normalized];

      const parentAlbums = song.relationships?.albums?.data ?? [];
      if (parentAlbums.length > 0) {
        const album = parentAlbums[0];
        const releaseResult = normalizeAlbum(album, storefront, input);
        detailTracks = [releaseResult];
        providerLinks = [
          { entityType: "track", providerEntityId: song.id ?? providerEntityId, providerUrl: song.attributes?.url ?? null },
          { entityType: "release", providerEntityId: album.id ?? "", providerUrl: album.attributes?.url ?? null },
          ...(song.relationships?.artists?.data ?? []).map((artist) => ({
            entityType: "artist" as ProviderEntityType,
            providerEntityId: artist.id ?? "",
            providerUrl: artist.attributes?.url ?? null,
          })),
        ];
      } else {
        providerLinks = [
          { entityType: "track", providerEntityId: song.id ?? providerEntityId, providerUrl: song.attributes?.url ?? null },
          ...(song.relationships?.artists?.data ?? []).map((artist) => ({
            entityType: "artist" as ProviderEntityType,
            providerEntityId: artist.id ?? "",
            providerUrl: artist.attributes?.url ?? null,
          })),
        ];
      }
    } else if (providerEntityType === "artist") {
      const endpoint = new URL(
        `https://api.music.apple.com/v1/catalog/${storefront}/artists/${providerEntityId}`,
      );
      endpoint.searchParams.set("include", "albums");

      const response = await this.fetchImpl(endpoint, {
        headers: {
          Authorization: `Bearer ${this.developerToken}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AppleMusicAdapterError(
          `Apple Music artist lookup failed: ${response.status}`,
          response.status,
          errorText,
        );
      }

      const payload = (await response.json()) as AppleMusicArtistResponse;
      const artist = payload.data?.[0];
      if (!artist) {
        throw new AppleMusicAdapterError(`Artist not found: ${providerEntityId}`);
      }

      normalized = normalizeArtist(artist, storefront, input);
      detailArtists = [normalized];
      detailTracks = (artist.relationships?.albums?.data ?? []).map((album) =>
        normalizeAlbum(album, storefront, input),
      );
      detailLabels = [];

      providerLinks = [
        { entityType: "artist", providerEntityId: artist.id ?? providerEntityId, providerUrl: artist.attributes?.url ?? null },
        ...(artist.relationships?.albums?.data ?? []).map((album) => ({
          entityType: "release" as ProviderEntityType,
          providerEntityId: album.id ?? "",
          providerUrl: album.attributes?.url ?? null,
        })),
      ];
    } else {
      throw new AppleMusicAdapterError(`Unsupported entity type for inspect: ${providerEntityType}`);
    }

    return {
      result: normalized,
      detail: {
        release: providerEntityType === "release" ? normalized : detailTracks[0] ?? null,
        artists: detailArtists,
        tracks: detailTracks,
        labels: detailLabels,
        providerLinks,
        sourceFields: normalized.summaryFields,
      },
      possibleRegistryMatches: {
        artists: [],
        releases: [],
        tracks: [],
      },
      existingShellMatches: [],
    };
  }
}

// ── Apple Music raw response types ───────────────────────────────────────────

interface AppleMusicArtwork {
  url?: string;
  width?: number;
  height?: number;
}

interface AppleMusicPreview {
  url?: string;
}

interface AppleMusicAttributes {
  name?: string;
  artistName?: string;
  artwork?: AppleMusicArtwork;
  composerName?: string;
  contentRating?: string;
  copyright?: string;
  discNumber?: number;
  durationInMillis?: number;
  genreNames?: string[];
  hasLyrics?: boolean;
  isrc?: string;
  previews?: AppleMusicPreview[];
  recordLabel?: string;
  releaseDate?: string;
  trackCount?: number;
  trackNumber?: number;
  upc?: string;
  url?: string;
  albumName?: string;
}

interface AppleMusicResource {
  id?: string;
  type?: string;
  href?: string;
  attributes?: AppleMusicAttributes;
  relationships?: {
    artists?: { data?: AppleMusicResource[] };
    tracks?: { data?: AppleMusicResource[] };
    albums?: { data?: AppleMusicResource[] };
  };
}

interface AppleMusicSearchResults {
  artists?: { data?: AppleMusicResource[] };
  albums?: { data?: AppleMusicResource[] };
  songs?: { data?: AppleMusicResource[] };
}

interface AppleMusicSearchResponse {
  results?: AppleMusicSearchResults;
}

interface AppleMusicAlbumResponse {
  data?: AppleMusicResource[];
}

interface AppleMusicSongResponse {
  data?: AppleMusicResource[];
}

interface AppleMusicArtistResponse {
  data?: AppleMusicResource[];
}

// ── Normalizers ────────────────────────────────────────────────────────────

function normalizeSearchResponse(
  payload: AppleMusicSearchResponse,
  input: ProviderSearchInput,
): ProviderSearchResponse {
  const results = payload.results ?? {};
  const artists = (results.artists?.data ?? []).map((artist) =>
    normalizeArtist(artist, input.storefrontOrMarket ?? "ke", input),
  );
  const releases = (results.albums?.data ?? []).map((album) =>
    normalizeAlbum(album, input.storefrontOrMarket ?? "ke", input),
  );
  const tracks = (results.songs?.data ?? []).map((song) =>
    normalizeSong(song, input.storefrontOrMarket ?? "ke", input),
  );

  const rawCount = (results.artists?.data?.length ?? 0) +
    (results.albums?.data?.length ?? 0) +
    (results.songs?.data?.length ?? 0);

  return {
    provider: "apple_music",
    query: input.query,
    storefrontOrMarket: input.storefrontOrMarket,
    groups: {
      artists,
      releases,
      tracks,
      labels: [],
    },
    rawResultCount: rawCount,
    normalizedResultCount: artists.length + releases.length + tracks.length,
  };
}

function normalizeAlbum(
  album: AppleMusicResource,
  storefront: string,
  source: ProviderSearchInput | ProviderInspectInput,
): ProviderSearchResult {
  const attributes = album.attributes ?? {};
  const title = attributes.name ?? "Untitled Album";
  const artistName = attributes.artistName ?? null;
  const artworkUrl = resolveArtworkUrl(attributes.artwork);
  const trackCount = attributes.trackCount ?? null;
  const releaseDate = attributes.releaseDate ?? null;

  const relatedArtists = (album.relationships?.artists?.data ?? []).map((artist) =>
    toRelatedEntity(artist, "artist"),
  );
  const relatedTracks = (album.relationships?.tracks?.data ?? []).map((track) =>
    toRelatedEntity(track, "track"),
  );

  return {
    provider: "apple_music",
    providerEntityType: "release",
    providerEntityId: album.id ?? "",
    providerUrl: attributes.url ?? null,
    title,
    subtitle: `${artistName ?? "Unknown Artist"} · ${releaseDate ?? "Unknown date"}`,
    artistDisplayName: artistName,
    artworkUrl,
    confidenceScore: 0.95,
    source: {
      searchQuery: "query" in source ? source.query : "",
      storefrontOrMarket: storefront,
      fetchedAt: new Date().toISOString(),
      rawKind: album.type ?? "albums",
    },
    summaryFields: [
      { key: "release_date", label: "Release Date", value: releaseDate },
      { key: "track_count", label: "Track Count", value: trackCount },
      { key: "label", label: "Label", value: attributes.recordLabel ?? null },
      { key: "upc", label: "UPC", value: attributes.upc ?? null },
      { key: "genres", label: "Genres", value: (attributes.genreNames ?? []).join(", ") },
      { key: "copyright", label: "Copyright", value: attributes.copyright ?? null },
    ],
    relatedEntities: {
      artists: relatedArtists,
      releases: [],
      tracks: relatedTracks,
      labels: attributes.recordLabel
        ? [{ providerEntityType: "label", providerEntityId: "", name: attributes.recordLabel, role: null }]
        : [],
    },
  };
}

function normalizeSong(
  song: AppleMusicResource,
  storefront: string,
  source: ProviderSearchInput | ProviderInspectInput,
): ProviderSearchResult {
  const attributes = song.attributes ?? {};
  const title = attributes.name ?? "Untitled Track";
  const artistName = attributes.artistName ?? null;
  const artworkUrl = resolveArtworkUrl(attributes.artwork);
  const durationMs = attributes.durationInMillis ?? null;
  const isrc = attributes.isrc ?? null;

  const relatedArtists = (song.relationships?.artists?.data ?? []).map((artist) =>
    toRelatedEntity(artist, "artist"),
  );

  return {
    provider: "apple_music",
    providerEntityType: "track",
    providerEntityId: song.id ?? "",
    providerUrl: attributes.url ?? null,
    title,
    subtitle: `${artistName ?? "Unknown Artist"} · ${durationMs ? `${Math.round(durationMs / 1000)}s` : "Unknown duration"}`,
    artistDisplayName: artistName,
    artworkUrl,
    confidenceScore: 0.92,
    source: {
      searchQuery: "query" in source ? source.query : "",
      storefrontOrMarket: storefront,
      fetchedAt: new Date().toISOString(),
      rawKind: song.type ?? "songs",
    },
    summaryFields: [
      { key: "isrc", label: "ISRC", value: isrc },
      { key: "duration", label: "Duration", value: durationMs ? `${Math.round(durationMs / 1000)}s` : null },
      { key: "preview", label: "Preview", value: attributes.previews?.[0]?.url ?? null },
      { key: "disc_number", label: "Disc", value: attributes.discNumber ?? null },
      { key: "track_number", label: "Track", value: attributes.trackNumber ?? null },
    ],
    relatedEntities: {
      artists: relatedArtists,
      releases: [],
      tracks: [],
      labels: [],
    },
  };
}

function normalizeArtist(
  artist: AppleMusicResource,
  storefront: string,
  source: ProviderSearchInput | ProviderInspectInput,
): ProviderSearchResult {
  const attributes = artist.attributes ?? {};
  const name = attributes.name ?? "Unknown Artist";
  const artworkUrl = resolveArtworkUrl(attributes.artwork);

  const relatedReleases = (artist.relationships?.albums?.data ?? []).map((album) =>
    toRelatedEntity(album, "release"),
  );

  return {
    provider: "apple_music",
    providerEntityType: "artist",
    providerEntityId: artist.id ?? "",
    providerUrl: attributes.url ?? null,
    title: name,
    subtitle: null,
    artistDisplayName: null,
    artworkUrl,
    confidenceScore: 0.88,
    source: {
      searchQuery: "query" in source ? source.query : "",
      storefrontOrMarket: storefront,
      fetchedAt: new Date().toISOString(),
      rawKind: artist.type ?? "artists",
    },
    summaryFields: [
      { key: "genres", label: "Genres", value: (attributes.genreNames ?? []).join(", ") },
    ],
    relatedEntities: {
      artists: [],
      releases: relatedReleases,
      tracks: [],
      labels: [],
    },
  };
}

function toRelatedEntity(resource: AppleMusicResource, entityType: ProviderEntityType): ProviderRelatedEntity {
  const attributes = resource.attributes ?? {};
  return {
    providerEntityType: entityType,
    providerEntityId: resource.id ?? "",
    name: attributes.name ?? "",
    role: null,
    providerUrl: attributes.url ?? null,
    artworkUrl: resolveArtworkUrl(attributes.artwork),
    confidenceScore: 0.8,
  };
}

function resolveArtworkUrl(artwork: AppleMusicArtwork | undefined): string | null {
  if (!artwork?.url) return null;
  const width = artwork.width ?? 1200;
  const height = artwork.height ?? 1200;
  return artwork.url
    .replace("{w}", String(width))
    .replace("{h}", String(height))
    .replace("{f}", "jpg");
}

function entityTypeToAppleMusicTypes(entityType: ProviderEntityType): string {
  switch (entityType) {
    case "artist": return "artists";
    case "release": return "albums";
    case "track": return "songs";
    case "label": return "albums";
    default: return "artists,albums,songs";
  }
}