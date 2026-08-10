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

export interface PublicPlaylistArtist {
  artistId: string;
  artistSlug: string | null;
  name: string;
  imageUrl: string | null;
  role: string | null;
  isPrimary: boolean;
  isFeatured: boolean;
  creditOrder: number | null;
  displayCredit: string | null;
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
  artists: PublicPlaylistArtist[];
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

export interface PublicPlaylistProvenance {
  versionNumber: number;
  contentFingerprint: string | null;
  sourceAuthorityRevision: number | null;
  publishedAt: string | null;
  firstPublishedAt: string | null;
  publishedBy: string | null;
  commandReceiptId: string | null;
}

export interface PublicPlaylistCredit {
  resourceId: string;
  resourceKind: string;
  displayOrder: number;
  isPrimary: boolean;
  creditId: string;
  role: string;
  roleLabel: string | null;
  displayName: string;
  note: string | null;
  authorSlug: string | null;
  username: string | null;
}

export interface PublicPlaylistCitationSource {
  sourceId: string;
  sourceVersionId: string;
  type: string;
  title: string;
  creator: string | null;
  publisher: string | null;
  url: string | null;
  publicationDate: string | null;
  creditLine: string | null;
}

export interface PublicPlaylistCitation {
  resourceId: string;
  resourceKind: string;
  displayOrder: number;
  purpose: string;
  anchorType: string;
  anchor: Record<string, unknown>;
  citationId: string;
  publicLabel: string | null;
  locatorType: string;
  locator: Record<string, unknown>;
  source: PublicPlaylistCitationSource;
}

export interface PublicPlaylistCorrection {
  id: string;
  resourceId: string;
  resourceKind: string;
  note: string;
  publishedAt: string | null;
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
  provenance: PublicPlaylistProvenance;
  credits: PublicPlaylistCredit[];
  citations: PublicPlaylistCitation[];
  corrections: PublicPlaylistCorrection[];
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

function decodeArtist(
  value: unknown,
): PublicPlaylistArtist | null {
  const input = record(value);

  const artistId =
    stringValue(input.artist_id);

  const name =
    stringValue(input.name);

  if (
    !artistId ||
    !name
  ) {
    return null;
  }

  return {
    artistId,
    artistSlug:
      nullableString(input.artist_slug),
    name,
    imageUrl:
      nullableString(input.image_url),
    role:
      nullableString(input.role),
    isPrimary:
      input.is_primary === true,
    isFeatured:
      input.is_featured === true,
    creditOrder:
      nullableNumber(input.credit_order),
    displayCredit:
      nullableString(input.display_credit),
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
    artists:
      array(input.artists)
        .map(decodeArtist)
        .filter(
          (
            artist,
          ): artist is PublicPlaylistArtist =>
            artist !== null,
        ),
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

function decodeProvenance(
  value: unknown,
): PublicPlaylistProvenance {
  const input =
    record(
      value,
    );

  return {
    versionNumber:
      numberValue(
        input.version_number,
      ),
    contentFingerprint:
      nullableString(
        input.content_fingerprint,
      ),
    sourceAuthorityRevision:
      nullableNumber(
        input.source_authority_revision,
      ),
    publishedAt:
      nullableString(
        input.published_at,
      ),
    firstPublishedAt:
      nullableString(
        input.first_published_at,
      ),
    publishedBy:
      nullableString(
        input.published_by,
      ),
    commandReceiptId:
      nullableString(
        input.command_receipt_id,
      ),
  };
}

function decodeCredit(
  value: unknown,
): PublicPlaylistCredit | null {
  const input =
    record(
      value,
    );

  const creditId =
    stringValue(
      input.credit_id,
    );

  const displayName =
    stringValue(
      input.display_name,
    );

  if (
    !creditId ||
    !displayName
  ) {
    return null;
  }

  return {
    resourceId:
      stringValue(
        input.resource_id,
      ),
    resourceKind:
      stringValue(
        input.resource_kind,
      ),
    displayOrder:
      numberValue(
        input.display_order,
      ),
    isPrimary:
      input.is_primary ===
      true,
    creditId,
    role:
      stringValue(
        input.role,
      ),
    roleLabel:
      nullableString(
        input.role_label,
      ),
    displayName,
    note:
      nullableString(
        input.note,
      ),
    authorSlug:
      nullableString(
        input.author_slug,
      ),
    username:
      nullableString(
        input.username,
      ),
  };
}

function decodeCitationSource(
  value: unknown,
): PublicPlaylistCitationSource | null {
  const input =
    record(
      value,
    );

  const sourceId =
    stringValue(
      input.source_id,
    );

  const sourceVersionId =
    stringValue(
      input.source_version_id,
    );

  const title =
    stringValue(
      input.title,
    );

  if (
    !sourceId ||
    !sourceVersionId ||
    !title
  ) {
    return null;
  }

  return {
    sourceId,
    sourceVersionId,
    type:
      stringValue(
        input.type,
      ),
    title,
    creator:
      nullableString(
        input.creator,
      ),
    publisher:
      nullableString(
        input.publisher,
      ),
    url:
      nullableString(
        input.url,
      ),
    publicationDate:
      nullableString(
        input.publication_date,
      ),
    creditLine:
      nullableString(
        input.credit_line,
      ),
  };
}

function decodeCitation(
  value: unknown,
): PublicPlaylistCitation | null {
  const input =
    record(
      value,
    );

  const citationId =
    stringValue(
      input.citation_id,
    );

  const resourceId =
    stringValue(
      input.resource_id,
    );

  const source =
    decodeCitationSource(
      input.source,
    );

  if (
    !citationId ||
    !resourceId ||
    !source
  ) {
    return null;
  }

  return {
    resourceId,
    resourceKind:
      stringValue(
        input.resource_kind,
      ),
    displayOrder:
      numberValue(
        input.display_order,
      ),
    purpose:
      stringValue(
        input.purpose,
      ),
    anchorType:
      stringValue(
        input.anchor_type,
      ),
    anchor:
      record(
        input.anchor,
      ),
    citationId,
    publicLabel:
      nullableString(
        input.public_label,
      ),
    locatorType:
      stringValue(
        input.locator_type,
      ),
    locator:
      record(
        input.locator,
      ),
    source,
  };
}

function decodeCorrection(
  value: unknown,
): PublicPlaylistCorrection | null {
  const input =
    record(
      value,
    );

  const id =
    stringValue(
      input.id,
    );

  const note =
    stringValue(
      input.note,
    );

  if (
    !id ||
    !note
  ) {
    return null;
  }

  return {
    id,
    resourceId:
      stringValue(
        input.resource_id,
      ),
    resourceKind:
      stringValue(
        input.resource_kind,
      ),
    note,
    publishedAt:
      nullableString(
        input.published_at,
      ),
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
      decodeProvenance(
        input.provenance,
      ),
    credits:
      array(input.credits)
        .map(
          decodeCredit,
        )
        .filter(
          (
            credit,
          ): credit is PublicPlaylistCredit =>
            credit !== null,
        ),
    citations:
      array(input.citations)
        .map(
          decodeCitation,
        )
        .filter(
          (
            citation,
          ): citation is PublicPlaylistCitation =>
            citation !== null,
        ),
    corrections:
      array(input.corrections)
        .map(
          decodeCorrection,
        )
        .filter(
          (
            correction,
          ): correction is PublicPlaylistCorrection =>
            correction !== null,
        ),
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

export function publicPlaylistTrackArtistNames(
  track: PublicPlaylistTrack,
): string[] {
  const canonicalNames =
    track.artists
      .map(
        (artist) =>
          artist.name.trim(),
      )
      .filter(Boolean);

  if (
    canonicalNames.length > 0
  ) {
    return canonicalNames;
  }

  if (
    track.artistNames.length > 0
  ) {
    return track.artistNames;
  }

  const primaryArtistName =
    track.registry
      ?.primaryArtistName
      ?.trim();

  return primaryArtistName
    ? [primaryArtistName]
    : ["Unknown artist"];
}

export function publicPlaylistTrackArtistLabel(
  track: PublicPlaylistTrack,
): string {
  return publicPlaylistTrackArtistNames(
    track,
  ).join(
    ", ",
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
      publicPlaylistTrackArtistLabel(
        track,
      ),
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
