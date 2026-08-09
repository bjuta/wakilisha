import type {
  PlayerTrack,
  PlaylistPlaybackEngine,
} from "@/context/PlayerContext";

type UnknownRecord = Record<string, unknown>;

export interface PublicPlaylistPlayback {
  playable: boolean;
  engine: PlaylistPlaybackEngine;
  providerKey: string | null;
  providerObjectId: string | null;
  providerUrl: string | null;
  embedUrl: string | null;
  previewUrl: string | null;
  fallbackPreviewUrl: string | null;
  appleMusicCatalogId: string | null;
}

export interface PublicPlaylistRegistryLink {
  trackId: string;
  trackSlug: string | null;
  trackPath: string | null;
  releaseId: string | null;
  releaseSlug: string | null;
  releasePath: string | null;
  primaryArtistId: string | null;
  primaryArtistSlug: string | null;
  primaryArtistName: string | null;
}

export interface PublicPlaylistTrack {
  playlistItemResourceId: string;
  playlistItemId: string | null;
  position: number;
  title: string;
  artistNames: string[];
  releaseTitle: string | null;
  artworkUrl: string | null;
  durationMs: number | null;
  notes: string | null;
  matchStatus: string | null;
  registry: PublicPlaylistRegistryLink | null;
  playback: PublicPlaylistPlayback;
}

export interface PublicPlaylistCover {
  assetId: string | null;
  assetRevisionId: string | null;
  url: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  altText: string | null;
  caption: string | null;
  credit: string | null;
}

export interface PublicPlaylist {
  playlistId: string;
  resourceId: string;
  versionId: string;
  versionNumber: number;
  slug: string;
  title: string;
  description: string | null;
  curatorLabel: string | null;
  cover: PublicPlaylistCover | null;
  itemCount: number;
  tracks: PublicPlaylistTrack[];
  provenance: UnknownRecord;
  credits: unknown[];
  citations: unknown[];
  corrections: unknown[];
}

export interface PublicPlaylistListItem {
  snapshotId: string;
  playlistId: string;
  resourceId: string;
  versionId: string;
  slug: string;
  title: string;
  description: string | null;
  curatorLabel: string | null;
  coverUrl: string | null;
  coverAltText: string | null;
  itemCount: number;
  publishedAt: string;
  firstPublishedAt: string;
}

function record(value: unknown): UnknownRecord {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value: unknown): string | null {
  const valueString = stringValue(value);
  return valueString || null;
}

function numberValue(
  value: unknown,
  fallback = 0,
): number {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : fallback;
}

function nullableNumber(
  value: unknown,
): number | null {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : null;
}

function stringArray(value: unknown): string[] {
  return array(value)
    .map(stringValue)
    .filter(Boolean);
}

function playbackEngine(
  value: unknown,
): PlaylistPlaybackEngine {
  switch (stringValue(value)) {
    case "audio":
      return "audio";
    case "apple_music":
      return "apple_music";
    case "youtube":
      return "youtube";
    case "soundcloud":
      return "soundcloud";
    default:
      return "unavailable";
  }
}

function decodePlayback(
  value: unknown,
): PublicPlaylistPlayback {
  const input = record(value);

  return {
    playable: input.playable === true,
    engine: playbackEngine(input.engine),
    providerKey:
      nullableString(input.provider_key),
    providerObjectId:
      nullableString(input.provider_object_id),
    providerUrl:
      nullableString(input.provider_url),
    embedUrl:
      nullableString(input.embed_url),
    previewUrl:
      nullableString(input.preview_url),
    fallbackPreviewUrl:
      nullableString(input.fallback_preview_url),
    appleMusicCatalogId:
      nullableString(
        input.apple_music_catalog_id,
      ),
  };
}

function decodeRegistry(
  value: unknown,
): PublicPlaylistRegistryLink | null {
  if (!value) return null;

  const input = record(value);
  const trackId = stringValue(input.track_id);

  if (!trackId) return null;

  return {
    trackId,
    trackSlug:
      nullableString(input.track_slug),
    trackPath:
      nullableString(input.track_path),
    releaseId:
      nullableString(input.release_id),
    releaseSlug:
      nullableString(input.release_slug),
    releasePath:
      nullableString(input.release_path),
    primaryArtistId:
      nullableString(input.primary_artist_id),
    primaryArtistSlug:
      nullableString(input.primary_artist_slug),
    primaryArtistName:
      nullableString(input.primary_artist_name),
  };
}

function decodeTrack(
  value: unknown,
): PublicPlaylistTrack | null {
  const input = record(value);

  const playlistItemResourceId =
    stringValue(
      input.playlist_item_resource_id,
    );

  if (!playlistItemResourceId) {
    return null;
  }

  return {
    playlistItemResourceId,
    playlistItemId:
      nullableString(input.playlist_item_id),
    position:
      numberValue(input.position),
    title:
      stringValue(input.title) ||
      "Untitled track",
    artistNames:
      stringArray(input.artist_names),
    releaseTitle:
      nullableString(input.release_title),
    artworkUrl:
      nullableString(input.artwork_url),
    durationMs:
      nullableNumber(input.duration_ms),
    notes:
      nullableString(input.notes),
    matchStatus:
      nullableString(input.match_status),
    registry:
      decodeRegistry(input.registry),
    playback:
      decodePlayback(input.playback),
  };
}

function decodeCover(
  value: unknown,
): PublicPlaylistCover | null {
  if (!value) return null;

  const input = record(value);

  return {
    assetId:
      nullableString(input.asset_id),
    assetRevisionId:
      nullableString(input.asset_revision_id),
    url:
      nullableString(input.url),
    mimeType:
      nullableString(input.mime_type),
    width:
      nullableNumber(input.width),
    height:
      nullableNumber(input.height),
    altText:
      nullableString(input.alt_text),
    caption:
      nullableString(input.caption),
    credit:
      nullableString(input.credit),
  };
}

export function decodePublicPlaylist(
  value: unknown,
): PublicPlaylist | null {
  if (!value) return null;

  const input = record(value);

  const playlistId =
    stringValue(input.playlist_id);
  const resourceId =
    stringValue(input.resource_id);
  const versionId =
    stringValue(input.version_id);
  const slug =
    stringValue(input.slug);
  const title =
    stringValue(input.title);

  if (
    !playlistId ||
    !resourceId ||
    !versionId ||
    !slug ||
    !title
  ) {
    return null;
  }

  return {
    playlistId,
    resourceId,
    versionId,
    versionNumber:
      numberValue(input.version_number),
    slug,
    title,
    description:
      nullableString(input.description),
    curatorLabel:
      nullableString(input.curator_label),
    cover:
      decodeCover(input.cover),
    itemCount:
      numberValue(input.item_count),
    tracks:
      array(input.tracks)
        .map(decodeTrack)
        .filter(
          (
            track,
          ): track is PublicPlaylistTrack =>
            track !== null,
        )
        .sort(
          (a, b) =>
            a.position - b.position,
        ),
    provenance:
      record(input.provenance),
    credits:
      array(input.credits),
    citations:
      array(input.citations),
    corrections:
      array(input.corrections),
  };
}

function decodeListItem(
  value: unknown,
): PublicPlaylistListItem | null {
  const input = record(value);

  const snapshotId =
    stringValue(input.snapshot_id);
  const playlistId =
    stringValue(input.playlist_id);
  const resourceId =
    stringValue(input.resource_id);
  const versionId =
    stringValue(input.version_id);
  const slug =
    stringValue(input.slug);
  const title =
    stringValue(input.title);
  const publishedAt =
    stringValue(input.published_at);
  const firstPublishedAt =
    stringValue(input.first_published_at);

  if (
    !snapshotId ||
    !playlistId ||
    !resourceId ||
    !versionId ||
    !slug ||
    !title ||
    !publishedAt ||
    !firstPublishedAt
  ) {
    return null;
  }

  return {
    snapshotId,
    playlistId,
    resourceId,
    versionId,
    slug,
    title,
    description:
      nullableString(input.description),
    curatorLabel:
      nullableString(input.curator_label),
    coverUrl:
      nullableString(input.cover_url),
    coverAltText:
      nullableString(input.cover_alt_text),
    itemCount:
      numberValue(input.item_count),
    publishedAt,
    firstPublishedAt,
  };
}

export function decodePublicPlaylistCollection(
  value: unknown,
): PublicPlaylistListItem[] {
  return array(value)
    .map(decodeListItem)
    .filter(
      (
        item,
      ): item is PublicPlaylistListItem =>
        item !== null,
    );
}

function playbackSourceLabel(
  track: PublicPlaylistTrack,
): string | undefined {
  switch (track.playback.engine) {
    case "apple_music":
      return "Apple Music";
    case "youtube":
      return "YouTube";
    case "soundcloud":
      return "SoundCloud";
    case "audio":
      return track.playback.providerKey ===
        "spotify"
        ? "WAKILISHA preview"
        : "WAKILISHA";
    default:
      return undefined;
  }
}

export function toPlayerTrack(
  track: PublicPlaylistTrack,
): PlayerTrack {
  const previewUrl =
    track.playback.previewUrl ??
    track.playback.fallbackPreviewUrl ??
    undefined;

  const providerObjectId =
    track.playback.providerObjectId;

  const appleMusicCatalogId =
    track.playback.appleMusicCatalogId ??
    (
      track.playback.engine ===
        "apple_music"
        ? providerObjectId
        : null
    );

  return {
    id:
      track.registry?.trackId ??
      track.playlistItemResourceId,
    title:
      track.title,
    artist:
      track.artistNames.join(", ") ||
      track.registry?.primaryArtistName ||
      "Unknown artist",
    artworkUrl:
      track.artworkUrl ?? undefined,
    album:
      track.releaseTitle ?? undefined,
    duration:
      track.durationMs !== null
        ? track.durationMs / 1000
        : undefined,
    isPlayable:
      track.playback.playable,
    source:
      playbackSourceLabel(track),
    previewUrl,
    appleMusicId:
      appleMusicCatalogId,
    appleMusicCatalogId,
    playbackEngine:
      track.playback.engine,
    providerKey:
      track.playback.providerKey,
    providerObjectId,
    providerUrl:
      track.playback.providerUrl,
    providerEmbedUrl:
      track.playback.embedUrl,
    artistSlug:
      track.registry
        ?.primaryArtistSlug ??
      undefined,
    trackSlug:
      track.registry?.trackSlug ??
      undefined,
  };
}

export function toPlayerQueue(
  playlist: PublicPlaylist,
): PlayerTrack[] {
  return playlist.tracks.map(
    toPlayerTrack,
  );
}
