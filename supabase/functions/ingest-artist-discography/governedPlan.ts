export type DiscographyAlbumAction = "merge" | "canonicalize" | "ignore";

export interface DiscographyAdditionalPrimaryArtist {
  artist_id: string;
  artist_slug: string;
  artist_name: string;
}

export interface DiscographyApplySelection {
  apple_music_id: string;
  action: DiscographyAlbumAction;
  additional_primary_artists?: DiscographyAdditionalPrimaryArtist[];
}

export interface DiscographyProviderTrackObservation {
  apple_music_id: string;
  title: string;
  artist_name: string;
  duration_ms: number | null;
  track_number: number | null;
  disc_number: number | null;
  isrc: string | null;
  artwork_url: string | null;
  explicit: boolean;
  preview_url: string | null;
  genre_names: string[];
}

export interface DiscographyProviderAlbumObservation {
  apple_music_id: string;
  title: string;
  album_artist_name: string;
  release_type: "album" | "ep" | "single";
  release_date: string | null;
  upc: string | null;
  record_label: string | null;
  genre_names: string[];
  artwork_url: string | null;
  apple_music_url: string | null;
  related_artists: Array<{
    apple_music_artist_id: string;
    name: string;
    url: string | null;
  }>;
  tracks: DiscographyProviderTrackObservation[];
}

export interface DiscographyProviderObservation {
  provider: "apple_music";
  storefront: string;
  acquired_at: string;
  artist: {
    id: string;
    slug: string;
    display_name: string;
  };
  albums: DiscographyProviderAlbumObservation[];
  failed_album_ids: string[];
}

export interface FrozenDiscographyAlbumSelection {
  apple_music_id: string;
  action: Exclude<DiscographyAlbumAction, "ignore">;
  additional_primary_artists: DiscographyAdditionalPrimaryArtist[];
  provider_album: DiscographyProviderAlbumObservation;
}

export interface FrozenReviewedDiscographyPlan {
  plan_version: 1;
  provider: "apple_music";
  artist_id: string;
  artist_slug: string;
  provider_storefront: string;
  provider_acquired_at: string;
  provider_source_payload_fingerprint: string;
  selected_albums: FrozenDiscographyAlbumSelection[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function assertUuid(value: string, label: string): string {
  if (!UUID_RE.test(value)) {
    throw new Error(`${label} must be an exact UUID.`);
  }
  return value.toLowerCase();
}

function normalizeAdditionalPrimaryArtists(
  currentArtistId: string,
  rows: DiscographyAdditionalPrimaryArtist[] | undefined,
): DiscographyAdditionalPrimaryArtist[] {
  const byId = new Map<string, DiscographyAdditionalPrimaryArtist>();

  for (const row of rows ?? []) {
    const artistId = assertUuid(clean(row.artist_id), "Additional primary Artist id");
    if (artistId === currentArtistId) continue;

    const artistSlug = clean(row.artist_slug);
    const artistName = clean(row.artist_name);
    if (!artistSlug || !artistName) {
      throw new Error("Additional primary Artist requires canonical slug and display name.");
    }

    const normalized = {
      artist_id: artistId,
      artist_slug: artistSlug,
      artist_name: artistName,
    };

    const existing = byId.get(artistId);
    if (
      existing &&
      (existing.artist_slug !== normalized.artist_slug ||
        existing.artist_name !== normalized.artist_name)
    ) {
      throw new Error("Additional primary Artist identity is inconsistent inside one reviewed plan.");
    }
    byId.set(artistId, normalized);
  }

  return [...byId.values()].sort((left, right) =>
    left.artist_id.localeCompare(right.artist_id)
  );
}

export function freezeReviewedDiscographyPlan(input: {
  exact_artist_id: string;
  provider_source_payload_fingerprint: string;
  observation: DiscographyProviderObservation;
  selections: DiscographyApplySelection[];
}): FrozenReviewedDiscographyPlan {
  const artistId = assertUuid(clean(input.exact_artist_id), "Discography Artist id");
  const observedArtistId = assertUuid(clean(input.observation.artist?.id), "Provider observation Artist id");
  if (artistId !== observedArtistId) {
    throw new Error("Provider observation is bound to a different Artist.");
  }

  if (input.observation.provider !== "apple_music") {
    throw new Error("Discography plan V1 only accepts Apple Music observations.");
  }

  const sourceFingerprint = clean(input.provider_source_payload_fingerprint).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sourceFingerprint)) {
    throw new Error("Provider observation fingerprint must be SHA-256 hex.");
  }

  const acquiredAt = clean(input.observation.acquired_at);
  if (!acquiredAt || Number.isNaN(Date.parse(acquiredAt))) {
    throw new Error("Provider observation acquisition time is invalid.");
  }

  const albumById = new Map<string, DiscographyProviderAlbumObservation>();
  for (const album of input.observation.albums ?? []) {
    const albumId = clean(album.apple_music_id);
    if (!albumId || albumById.has(albumId)) {
      throw new Error("Provider observation contains a missing or duplicate Apple Music album id.");
    }
    albumById.set(albumId, album);
  }

  const selectedByAlbum = new Map<string, FrozenDiscographyAlbumSelection>();
  for (const raw of input.selections ?? []) {
    const albumId = clean(raw.apple_music_id);
    if (!albumId) throw new Error("Reviewed selection is missing an Apple Music album id.");
    if (!["merge", "canonicalize", "ignore"].includes(raw.action)) {
      throw new Error(`Reviewed album ${albumId} has an unsupported action.`);
    }
    if (selectedByAlbum.has(albumId)) {
      throw new Error(`Reviewed album ${albumId} appears more than once.`);
    }

    const observedAlbum = albumById.get(albumId);
    if (!observedAlbum) {
      throw new Error(`Reviewed album ${albumId} was not present in the immutable provider observation.`);
    }

    if (raw.action === "ignore") continue;

    selectedByAlbum.set(albumId, {
      apple_music_id: albumId,
      action: raw.action,
      additional_primary_artists: normalizeAdditionalPrimaryArtists(
        artistId,
        raw.additional_primary_artists,
      ),
      provider_album: observedAlbum,
    });
  }

  if (selectedByAlbum.size === 0) {
    throw new Error("Reviewed discography plan has no albums selected for canonical action.");
  }

  return {
    plan_version: 1,
    provider: "apple_music",
    artist_id: artistId,
    artist_slug: clean(input.observation.artist.slug),
    provider_storefront: clean(input.observation.storefront),
    provider_acquired_at: acquiredAt,
    provider_source_payload_fingerprint: sourceFingerprint,
    selected_albums: [...selectedByAlbum.values()].sort((left, right) =>
      left.apple_music_id.localeCompare(right.apple_music_id)
    ),
  };
}
