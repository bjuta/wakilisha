import { supabase } from "@/lib/supabase";

type RpcError = { message: string };
type RpcResponse = { data: unknown; error: RpcError | null };
type RpcClient = {
  rpc: (
    functionName: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<RpcResponse>;
};
type UnknownRecord = Record<string, unknown>;

export interface PersonalPlaylistSummary {
  playlistId: string;
  title: string;
  slug: string;
  description: string | null;
  visibility: "private" | "public";
  lifecycleStatus: string;
  authorityRevision: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalPlaylistOwner {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface PersonalPlaylistTrack {
  playlistItemId: string;
  position: number;
  registryTrackId: string | null;
  title: string;
  artistNames: string[];
  releaseTitle: string | null;
  artworkUrl: string | null;
  previewUrl: string | null;
  durationMs: number | null;
  trackPath: string | null;
  releasePath: string | null;
}

export interface PersonalPlaylistDetail {
  playlistId: string;
  resourceId: string;
  playlistKind: "personal";
  title: string;
  slug: string;
  description: string | null;
  visibility: "private" | "public";
  lifecycleStatus: string;
  authorityRevision: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  owner: PersonalPlaylistOwner | null;
  tracks: PersonalPlaylistTrack[];
}

export interface PersonalPlaylistCommandResult {
  playlistId: string;
  authorityRevision: number;
  visibility?: "private" | "public";
  lifecycleStatus?: string;
  playlistItemId?: string;
  slug?: string;
  changed?: boolean;
}

function rpcClient(): RpcClient {
  return supabase as unknown as RpcClient;
}

function objectValue(value: unknown): UnknownRecord {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function firstRow(value: unknown): UnknownRecord {
  return Array.isArray(value)
    ? objectValue(value[0])
    : objectValue(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function nullableString(value: unknown): string | null {
  return stringValue(value) || null;
}

function numberValue(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(stringValue).filter(Boolean)
    : [];
}

function visibilityValue(value: unknown): "private" | "public" {
  return value === "public" ? "public" : "private";
}

function idempotencyKey(action: string): string {
  return `personal-playlist:${action}:${crypto.randomUUID()}`;
}

function correlationId(): string {
  return crypto.randomUUID();
}

async function invokeRpc(
  functionName: string,
  args?: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await rpcClient().rpc(
    functionName,
    args,
  );

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

function commandResult(data: unknown): PersonalPlaylistCommandResult {
  const row = firstRow(data);
  const payload = objectValue(row.result_payload);
  const receiptStatus = stringValue(row.receipt_status);

  if (receiptStatus === "rejected") {
    throw new Error(
      stringValue(payload.error_message) ||
        stringValue(payload.message) ||
        "The Playlist changed before this action could be completed.",
    );
  }

  return {
    playlistId:
      stringValue(row.playlist_id ?? payload.playlist_id),
    authorityRevision:
      numberValue(row.authority_revision ?? payload.authority_revision),
    visibility:
      row.visibility === "public" || payload.visibility === "public"
        ? "public"
        : row.visibility === "private" || payload.visibility === "private"
          ? "private"
          : undefined,
    lifecycleStatus:
      nullableString(row.lifecycle_status ?? payload.lifecycle_status) ??
      undefined,
    playlistItemId:
      nullableString(row.playlist_item_id ?? payload.playlist_item_id) ??
      undefined,
    slug:
      nullableString(row.slug ?? payload.slug) ??
      undefined,
    changed:
      typeof payload.changed === "boolean"
        ? payload.changed
        : undefined,
  };
}

function decodeSummary(value: unknown): PersonalPlaylistSummary | null {
  const row = objectValue(value);
  const playlistId = stringValue(row.playlist_id);
  const title = stringValue(row.title);
  const slug = stringValue(row.slug);

  if (!playlistId || !title || !slug) return null;

  return {
    playlistId,
    title,
    slug,
    description: nullableString(row.description),
    visibility: visibilityValue(row.visibility),
    lifecycleStatus: stringValue(row.lifecycle_status) || "active",
    authorityRevision: numberValue(row.authority_revision, 1),
    itemCount: numberValue(row.item_count),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
  };
}

function decodeTrack(value: unknown): PersonalPlaylistTrack | null {
  const row = objectValue(value);
  const playlistItemId = stringValue(row.playlist_item_id);

  if (!playlistItemId) return null;

  return {
    playlistItemId,
    position: numberValue(row.position),
    registryTrackId: nullableString(row.registry_track_id),
    title: stringValue(row.title) || "Untitled Track",
    artistNames: stringArray(row.artist_names),
    releaseTitle: nullableString(row.release_title),
    artworkUrl: nullableString(row.artwork_url),
    previewUrl: nullableString(row.preview_url),
    durationMs:
      row.duration_ms === null || row.duration_ms === undefined
        ? null
        : numberValue(row.duration_ms),
    trackPath: nullableString(row.track_path),
    releasePath: nullableString(row.release_path),
  };
}

function decodeOwner(value: unknown): PersonalPlaylistOwner | null {
  const row = objectValue(value);

  if (Object.keys(row).length === 0) return null;

  return {
    username: nullableString(row.username),
    displayName: nullableString(row.display_name),
    avatarUrl: nullableString(row.avatar_url),
  };
}

function decodeDetail(value: unknown): PersonalPlaylistDetail | null {
  if (!value) return null;

  const row = objectValue(value);
  const playlistId = stringValue(row.playlist_id);
  const resourceId = stringValue(row.resource_id);
  const title = stringValue(row.title);
  const slug = stringValue(row.slug);

  if (!playlistId || !resourceId || !title || !slug) return null;

  return {
    playlistId,
    resourceId,
    playlistKind: "personal",
    title,
    slug,
    description: nullableString(row.description),
    visibility: visibilityValue(row.visibility),
    lifecycleStatus: stringValue(row.lifecycle_status) || "active",
    authorityRevision: numberValue(row.authority_revision, 1),
    itemCount: numberValue(row.item_count),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
    owner: decodeOwner(row.owner),
    tracks: (
      Array.isArray(row.tracks)
        ? row.tracks
        : []
    )
      .map(decodeTrack)
      .filter(
        (
          track,
        ): track is PersonalPlaylistTrack =>
          track !== null,
      ),
  };
}

export function slugifyPersonalPlaylistTitle(title: string): string {
  const base =
    title
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 150) ||
    "playlist";

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function createPersonalPlaylist(
  input: {
    title: string;
    description?: string | null;
    visibility?: "private" | "public";
  },
): Promise<PersonalPlaylistCommandResult> {
  const data = await invokeRpc(
    "create_personal_playlist",
    {
      p_title: input.title.trim(),
      p_slug: slugifyPersonalPlaylistTitle(input.title),
      p_description: input.description?.trim() || null,
      p_visibility: input.visibility ?? "private",
      p_idempotency_key: idempotencyKey("create"),
      p_correlation_id: correlationId(),
    },
  );

  return commandResult(data);
}

export async function listMyPersonalPlaylists(
  options: {
    includeArchived?: boolean;
    limit?: number;
  } = {},
): Promise<PersonalPlaylistSummary[]> {
  const data = await invokeRpc(
    "list_my_personal_playlists",
    {
      p_include_archived: options.includeArchived ?? false,
      p_limit: options.limit ?? 100,
    },
  );

  return (Array.isArray(data) ? data : [])
    .map(decodeSummary)
    .filter(
      (
        playlist,
      ): playlist is PersonalPlaylistSummary =>
        playlist !== null,
    );
}

export async function getMyPersonalPlaylist(
  playlistId: string,
): Promise<PersonalPlaylistDetail | null> {
  return decodeDetail(
    await invokeRpc(
      "get_my_personal_playlist",
      {
        p_playlist_id: playlistId,
      },
    ),
  );
}

export async function updatePersonalPlaylist(
  playlistId: string,
  authorityRevision: number,
  payload: {
    title?: string;
    description?: string | null;
    visibility?: "private" | "public";
  },
): Promise<PersonalPlaylistCommandResult> {
  return commandResult(
    await invokeRpc(
      "update_personal_playlist",
      {
        p_playlist_id: playlistId,
        p_expected_authority_revision: authorityRevision,
        p_payload: payload,
        p_idempotency_key: idempotencyKey("update"),
        p_correlation_id: correlationId(),
      },
    ),
  );
}

export async function addPersonalPlaylistTrack(
  playlistId: string,
  authorityRevision: number,
  registryTrackId: string,
): Promise<PersonalPlaylistCommandResult> {
  return commandResult(
    await invokeRpc(
      "add_personal_playlist_track",
      {
        p_playlist_id: playlistId,
        p_expected_authority_revision: authorityRevision,
        p_registry_track_id: registryTrackId,
        p_idempotency_key: idempotencyKey("track-add"),
        p_correlation_id: correlationId(),
      },
    ),
  );
}

export async function removePersonalPlaylistItem(
  playlistId: string,
  playlistItemId: string,
  authorityRevision: number,
): Promise<PersonalPlaylistCommandResult> {
  return commandResult(
    await invokeRpc(
      "remove_personal_playlist_item",
      {
        p_playlist_id: playlistId,
        p_playlist_item_id: playlistItemId,
        p_expected_authority_revision: authorityRevision,
        p_idempotency_key: idempotencyKey("track-remove"),
        p_correlation_id: correlationId(),
      },
    ),
  );
}

export async function reorderPersonalPlaylistItems(
  playlistId: string,
  authorityRevision: number,
  orderedItemIds: string[],
): Promise<PersonalPlaylistCommandResult> {
  return commandResult(
    await invokeRpc(
      "reorder_personal_playlist_items",
      {
        p_playlist_id: playlistId,
        p_expected_authority_revision: authorityRevision,
        p_ordered_item_ids: orderedItemIds,
        p_idempotency_key: idempotencyKey("reorder"),
        p_correlation_id: correlationId(),
      },
    ),
  );
}

export async function archivePersonalPlaylist(
  playlistId: string,
  authorityRevision: number,
  note = "Archived by owner",
): Promise<PersonalPlaylistCommandResult> {
  return commandResult(
    await invokeRpc(
      "archive_personal_playlist",
      {
        p_playlist_id: playlistId,
        p_expected_authority_revision: authorityRevision,
        p_idempotency_key: idempotencyKey("archive"),
        p_note: note,
        p_correlation_id: correlationId(),
      },
    ),
  );
}

export async function getMyPersonalPlaylistByRoute(
  username: string,
  slug: string,
): Promise<PersonalPlaylistDetail | null> {
  const normalizedUsername =
    username.trim();
  const normalizedSlug =
    slug.trim();

  if (
    !normalizedUsername ||
    !normalizedSlug
  ) {
    return null;
  }

  return decodeDetail(
    await invokeRpc(
      "get_my_personal_playlist_by_route",
      {
        p_username:
          normalizedUsername,
        p_slug:
          normalizedSlug,
      },
    ),
  );
}

export async function getPublicPersonalPlaylist(
  username: string,
  slug: string,
): Promise<PersonalPlaylistDetail | null> {
  const normalizedUsername =
    username.trim();
  const normalizedSlug =
    slug.trim();

  if (
    !normalizedUsername ||
    !normalizedSlug
  ) {
    return null;
  }

  return decodeDetail(
    await invokeRpc(
      "get_public_personal_playlist",
      {
        p_username:
          normalizedUsername,
        p_slug:
          normalizedSlug,
      },
    ),
  );
}

export async function listPublicPersonalPlaylistsForUsername(
  username: string,
  limit = 24,
): Promise<PersonalPlaylistSummary[]> {
  const normalized = username.trim();
  if (!normalized) return [];

  const data = await invokeRpc(
    "list_public_personal_playlists_for_username",
    {
      p_username: normalized,
      p_limit: limit,
    },
  );

  return (Array.isArray(data) ? data : [])
    .map(decodeSummary)
    .filter(
      (
        playlist,
      ): playlist is PersonalPlaylistSummary =>
        playlist !== null,
    );
}
