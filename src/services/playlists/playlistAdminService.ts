import { supabase } from "@/lib/supabase";
import { mediaService } from "@/services/mediaService";
import type { Json } from "@/types/database.types";
import { parseProviderTrackUrl } from "./playlistAdminUtils";
export { parseProviderTrackUrl, slugifyPlaylistTitle } from "./playlistAdminUtils";

type AnyObject = Record<string, unknown>;

export interface AdminPlaylistListItem extends Record<string, unknown> {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  curatorLabel: string | null;
  status: string;
  authorityRevision: number;
  coverImageUrl: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistItem {
  id: string;
  playlistId: string;
  position: number;
  title: string | null;
  artistNames: string[];
  releaseTitle: string | null;
  registryTrackId: string | null;
  registryReleaseId: string | null;
  providerKey: string | null;
  providerTrackId: string | null;
  providerUrl: string | null;
  artworkUrl: string | null;
  previewUrl: string | null;
  durationMs: number | null;
  notes: string | null;
  matchStatus: string;
  matchConfidence: number | null;
}

export interface PlaylistRecord {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  curatorCreditId: string | null;
  curatorLabel: string | null;
  status: string;
  authorityRevision: number;
  coverImageUrl: string | null;
  metadata: AnyObject;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistCover {
  usageLinkId: string;
  usageRevision: number;
  assetId: string;
  assetRevisionId: string;
  url: string | null;
  altText: string | null;
  caption: string | null;
  credit: string | null;
  placementData: AnyObject;
}

export interface PlaylistReviewEvent {
  id?: string;
  event_number?: number;
  action?: string;
  prior_status?: string;
  resulting_status?: string;
  reason?: string | null;
  actor_id?: string | null;
  created_at?: string;
  target_version_id?: string;
  result_version_id?: string | null;
}

export interface PlaylistCuratorIdentity {
  creditId: string;
  role: string;
  displayName: string;
  authorSlug: string | null;
  username: string | null;
  registryAuthorId: string | null;
  userId: string | null;
  publicSafe: boolean;
  creditState: string;
  governanceRevision: number;
}

export interface PlaylistSchedule {
  id: string;
  versionId: string;
  runAfter: string;
  status: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  failureReason: string | null;
}

export interface PlaylistLifecycleEvent {
  id: string;
  eventNumber: number;
  versionId: string | null;
  action: string;
  priorStatus: string | null;
  resultingStatus: string;
  note: string | null;
  metadata: AnyObject;
  actorId: string | null;
  commandReceiptId: string | null;
  createdAt: string;
}

export interface PlaylistReviewWorkspace {
  resourceId: string;
  currentWorkingVersionId: string | null;
  currentSubmittedVersionId: string | null;
  currentApprovedVersionId: string | null;
  currentPublishedVersionId: string | null;
  workingVersion: AnyObject | null;
  submittedVersion: AnyObject | null;
  approvedVersion: AnyObject | null;
  publishedVersion: AnyObject | null;
  curator: PlaylistCuratorIdentity | null;
  schedule: PlaylistSchedule | null;
  reviewEvents: PlaylistReviewEvent[];
  lifecycleEvents: PlaylistLifecycleEvent[];
  canEdit: boolean;
  canManageReview: boolean;
  canPublish: boolean;
}

export interface PlaylistPendingRegistryArtistCredit {
  creditOrder: number;
  creditRole: "primary" | "featured";
  resolutionMode: string;
  registryArtistId: string | null;
  observedName: string;
  displayName: string;
}

export interface PlaylistPendingRegistryIntake {
  suggestionId: string;
  reservedPosition: number;
  status: string;
  providerKey: string | null;
  providerUrl: string | null;
  providerTitle: string | null;
  providerReleaseTitle: string | null;
  playbackKind: "audio" | "video";
  artworkUrl: string | null;
  createdAt: string;
  notes: string | null;
  artistCredits: PlaylistPendingRegistryArtistCredit[];
}

export interface RegistryIntakeArtistCreditInput {
  creditRole: "primary" | "featured";
  resolutionMode:
    | "existing_artist"
    | "alias_candidate"
    | "new_artist";
  registryArtistId: string | null;
  observedName: string;
  displayName: string;
}

export interface PlaylistDetail {
  playlist: PlaylistRecord;
  items: PlaylistItem[];
  pendingIntakes: PlaylistPendingRegistryIntake[];
  cover: PlaylistCover | null;
  review: PlaylistReviewWorkspace | null;
}

export interface RegistryTrackSearchResult {
  id: string;
  slug: string;
  title: string;
  artistNames: string[];
  releaseId: string | null;
  releaseTitle: string | null;
  artworkUrl: string | null;
  previewUrl: string | null;
}

export interface PlaylistPlaybackValidation {
  validationId: string;
  validationStatus: "playable";
  providerKey: string;
  providerObjectId: string;
  providerUrl: string;
  canonicalUrl: string;
  playbackKind: "audio" | "video";
  embedUrl: string | null;
  previewUrl: string | null;
  titleHint: string | null;
  artistNamesHint: string[];
  releaseTitleHint: string | null;
  artworkUrl: string | null;
  expiresAt: string;
}

export interface RegistryArtistSearchResult {
  id: string;
  displayName: string;
  slug: string;
  status: string;
}

export interface PlaylistCommandResult {
  authorityRevision: number;
  duplicateWarning?: boolean;
  duplicateItemIds?: string[];
  playlistItemId?: string;
  lifecycleStatus?: string;
  versionId?: string;
  versionNumber?: number;
  resultPayload?: AnyObject;
}

export type PlaylistCuratorSelection =
  | {
      kind: "registry_author";
      registryAuthorId: string;
    }
  | {
      kind: "user";
      userId: string;
    }
  | {
      kind: "none";
    };

export interface PlaylistPreviewLink {
  nonce: string;
  expiresAt: string;
  versionId: string;
}

export interface PlaylistCuratorCandidate {
  kind: "registry_author" | "user";
  id: string;
  displayName: string;
  slug: string | null;
  username: string | null;
  avatarUrl: string | null;
}

function objectValue(value: unknown): AnyObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as AnyObject;
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function numberValue(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean);
}

function idempotencyKey(operation: string): string {
  return `playlist:${operation}:${crypto.randomUUID()}`;
}

function correlationId(): string {
  return crypto.randomUUID();
}

function firstRpcRow(data: unknown, label: string): AnyObject {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    throw new Error(`${label} returned no result.`);
  }
  return row as AnyObject;
}

function commandResult(row: AnyObject): PlaylistCommandResult {
  const payload = objectValue(row.result_payload);
  const receiptStatus = nullableString(row.receipt_status);
  if (receiptStatus === "rejected") {
    const message =
      nullableString(payload.error_message) ??
      nullableString(payload.message) ??
      "The Playlist changed before this action could be completed.";
    throw new Error(message);
  }

  return {
    authorityRevision: numberValue(
      row.authority_revision ?? payload.authority_revision,
    ),
    duplicateWarning: payload.duplicate_warning === true,
    duplicateItemIds: stringArray(payload.duplicate_item_ids),
    playlistItemId:
      nullableString(row.playlist_item_id ?? payload.playlist_item_id) ??
      undefined,
    lifecycleStatus:
      nullableString(row.lifecycle_status ?? payload.lifecycle_status) ??
      undefined,
    versionId:
      nullableString(row.version_id ?? payload.version_id) ??
      undefined,
    versionNumber:
      row.version_number === null &&
      payload.version_number === undefined
        ? undefined
        : numberValue(
            row.version_number ?? payload.version_number,
          ),
    resultPayload: payload,
  };
}

export async function fetchPlaylistsForAdmin(
  limit = 200,
): Promise<AdminPlaylistListItem[]> {
  const { data, error } = await supabase
    .from("wk_playlists")
    .select(
      "id,title,slug,description,curator_label,status,authority_revision,cover_image_url,created_at,updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const playlists = data ?? [];
  if (playlists.length === 0) return [];

  const ids = playlists.map((playlist) => playlist.id);
  const { data: items, error: itemError } = await supabase
    .from("wk_playlist_items")
    .select("playlist_id")
    .in("playlist_id", ids)
    .eq("lifecycle_state", "active");

  if (itemError) throw itemError;

  const counts = new Map<string, number>();
  (items ?? []).forEach((item) => {
    counts.set(
      item.playlist_id,
      (counts.get(item.playlist_id) ?? 0) + 1,
    );
  });

  return playlists.map((playlist) => ({
    id: playlist.id,
    title: playlist.title,
    slug: playlist.slug,
    description: playlist.description,
    curatorLabel: playlist.curator_label,
    status: playlist.status,
    authorityRevision: playlist.authority_revision,
    coverImageUrl: playlist.cover_image_url,
    itemCount: counts.get(playlist.id) ?? 0,
    createdAt: playlist.created_at,
    updatedAt: playlist.updated_at,
  }));
}

function playlistFromWorkspace(
  value: unknown,
): PlaylistRecord {
  const row = objectValue(value);
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    slug: String(row.slug ?? ""),
    description: nullableString(row.description),
    curatorCreditId: nullableString(row.curator_credit_id),
    curatorLabel: nullableString(row.curator_label),
    status: String(row.status ?? "draft"),
    authorityRevision: numberValue(row.authority_revision, 1),
    coverImageUrl: nullableString(row.cover_image_url),
    metadata: objectValue(row.metadata),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function playlistItemFromRow(row: AnyObject): PlaylistItem {
  return {
    id: String(row.id),
    playlistId: String(row.playlist_id),
    position: numberValue(row.position),
    title: nullableString(row.title),
    artistNames: stringArray(row.artist_names),
    releaseTitle: nullableString(row.release_title),
    registryTrackId: nullableString(row.registry_track_id),
    registryReleaseId: nullableString(row.registry_release_id),
    providerKey: nullableString(row.provider_key),
    providerTrackId: nullableString(row.provider_track_id),
    providerUrl: nullableString(row.provider_url),
    artworkUrl: nullableString(row.artwork_url),
    previewUrl: nullableString(row.preview_url),
    durationMs:
      row.duration_ms === null ? null : numberValue(row.duration_ms),
    notes: nullableString(row.notes),
    matchStatus: String(row.match_status ?? "unresolved"),
    matchConfidence:
      row.match_confidence === null
        ? null
        : numberValue(row.match_confidence),
  };
}

function reviewWorkspaceFrom(value: unknown): PlaylistReviewWorkspace | null {
  const row = objectValue(value);
  if (!row.resource_id) return null;

  const curatorRow = objectValue(row.curator);
  const scheduleRow = objectValue(row.schedule);

  const curator: PlaylistCuratorIdentity | null =
    curatorRow.credit_id
      ? {
          creditId: String(curatorRow.credit_id),
          role: String(curatorRow.role ?? "curator"),
          displayName: String(curatorRow.display_name ?? ""),
          authorSlug: nullableString(curatorRow.author_slug),
          username: nullableString(curatorRow.username),
          registryAuthorId:
            nullableString(curatorRow.registry_author_id),
          userId: nullableString(curatorRow.user_id),
          publicSafe: curatorRow.public_safe === true,
          creditState: String(
            curatorRow.credit_state ?? "active",
          ),
          governanceRevision: numberValue(
            curatorRow.governance_revision,
            1,
          ),
        }
      : null;

  const schedule: PlaylistSchedule | null =
    scheduleRow.id
      ? {
          id: String(scheduleRow.id),
          versionId: String(scheduleRow.version_id ?? ""),
          runAfter: String(scheduleRow.run_after ?? ""),
          status: String(scheduleRow.status ?? ""),
          note: nullableString(scheduleRow.note),
          createdBy: nullableString(scheduleRow.created_by),
          createdAt: String(scheduleRow.created_at ?? ""),
          updatedAt: String(scheduleRow.updated_at ?? ""),
          publishedAt: nullableString(scheduleRow.published_at),
          failureReason:
            nullableString(scheduleRow.failure_reason),
        }
      : null;

  const lifecycleEvents: PlaylistLifecycleEvent[] =
    Array.isArray(row.lifecycle_events)
      ? row.lifecycle_events.map((eventValue) => {
          const event = objectValue(eventValue);
          return {
            id: String(event.id ?? ""),
            eventNumber: numberValue(event.event_number),
            versionId: nullableString(event.version_id),
            action: String(event.action ?? ""),
            priorStatus:
              nullableString(event.prior_status),
            resultingStatus: String(
              event.resulting_status ?? "",
            ),
            note: nullableString(event.note),
            metadata: objectValue(event.metadata),
            actorId: nullableString(event.actor_id),
            commandReceiptId:
              nullableString(event.command_receipt_id),
            createdAt: String(event.created_at ?? ""),
          };
        })
      : [];

  return {
    resourceId: String(row.resource_id),
    currentWorkingVersionId:
      nullableString(row.current_working_version_id),
    currentSubmittedVersionId:
      nullableString(row.current_submitted_version_id),
    currentApprovedVersionId:
      nullableString(row.current_approved_version_id),
    currentPublishedVersionId:
      nullableString(row.current_published_version_id),
    workingVersion:
      row.working_version ? objectValue(row.working_version) : null,
    submittedVersion:
      row.submitted_version ? objectValue(row.submitted_version) : null,
    approvedVersion:
      row.approved_version ? objectValue(row.approved_version) : null,
    publishedVersion:
      row.published_version ? objectValue(row.published_version) : null,
    curator,
    schedule,
    reviewEvents: Array.isArray(row.review_events)
      ? (row.review_events as PlaylistReviewEvent[])
      : [],
    lifecycleEvents,
    canEdit: row.can_edit === true,
    canManageReview: row.can_manage_review === true,
    canPublish: row.can_publish === true,
  };
}

function coverFrom(value: unknown): PlaylistCover | null {
  const row = objectValue(value);
  const cover = objectValue(row.cover);
  if (!cover.asset_id) return null;

  return {
    usageLinkId: String(cover.usage_link_id),
    usageRevision: numberValue(cover.usage_revision, 1),
    assetId: String(cover.asset_id),
    assetRevisionId: String(cover.asset_revision_id),
    url: nullableString(cover.url),
    altText: nullableString(cover.alt_text),
    caption: nullableString(cover.caption),
    credit: nullableString(cover.credit),
    placementData: objectValue(cover.placement_data),
  };
}


function pendingRegistryIntakesFrom(
  value: unknown,
): PlaylistPendingRegistryIntake[] {
  if (!Array.isArray(value)) return [];

  return value.map((entry) => {
    const row = objectValue(entry);
    const rawCredits = Array.isArray(row.artist_credits)
      ? row.artist_credits
      : [];

    return {
      suggestionId: String(row.suggestion_id ?? ""),
      reservedPosition: numberValue(row.reserved_position),
      status: String(row.status ?? "needs_review"),
      providerKey: nullableString(row.provider_key),
      providerUrl: nullableString(row.provider_url),
      providerTitle: nullableString(row.provider_title),
      providerReleaseTitle:
        nullableString(row.provider_release_title),
      playbackKind:
        row.playback_kind === "video" ? "video" : "audio",
      artworkUrl: nullableString(row.artwork_url),
      createdAt: String(row.created_at ?? ""),
      notes: nullableString(row.notes),
      artistCredits: rawCredits.map((credit) => {
        const artist = objectValue(credit);
        return {
          creditOrder: numberValue(artist.credit_order),
          creditRole:
            artist.credit_role === "featured"
              ? "featured"
              : "primary",
          resolutionMode:
            String(artist.resolution_mode ?? "unresolved"),
          registryArtistId:
            nullableString(artist.registry_artist_id),
          observedName:
            String(artist.observed_name ?? ""),
          displayName:
            String(
              artist.display_name ??
              artist.observed_name ??
              "Artist"
            ),
        };
      }),
    };
  });
}

export async function fetchPlaylistDetail(
  playlistId: string,
): Promise<PlaylistDetail> {
  const [
    workspaceResponse,
    itemResponse,
    coverResponse,
    pendingIntakeResponse,
  ] = await Promise.all([
    supabase.rpc("get_playlist_review_workspace", {
      p_playlist_id: playlistId,
    }),
    supabase
      .from("wk_playlist_items")
      .select(
        "id,playlist_id,position,title,artist_names,release_title,registry_track_id,registry_release_id,provider_key,provider_track_id,provider_url,artwork_url,preview_url,duration_ms,notes,match_status,match_confidence",
      )
      .eq("playlist_id", playlistId)
      .eq("lifecycle_state", "active")
      .order("position", { ascending: true }),
    supabase.rpc("get_playlist_current_cover", {
      p_playlist_id: playlistId,
    }),
    invokeUntypedRpc(
      "get_playlist_pending_registry_intake_editorial",
      {
        p_playlist_id: playlistId,
      },
    ),
  ]);

  if (workspaceResponse.error) throw workspaceResponse.error;
  if (itemResponse.error) throw itemResponse.error;

  const workspaceRaw = objectValue(workspaceResponse.data);
  const playlist = playlistFromWorkspace(workspaceRaw.playlist);

  if (!playlist.id) {
    throw new Error("Playlist was not found.");
  }

  return {
    playlist,
    items: (itemResponse.data ?? []).map((row) =>
      playlistItemFromRow(row as AnyObject),
    ),
    pendingIntakes:
      pendingRegistryIntakesFrom(pendingIntakeResponse),
    cover: coverResponse.error
      ? null
      : coverFrom(coverResponse.data),
    review: reviewWorkspaceFrom(workspaceResponse.data),
  };
}

export async function createPlaylist(input: {
  title: string;
  slug: string;
  description?: string;
}): Promise<{ playlistId: string; resourceId: string }> {
  const { data, error } = await supabase.rpc("create_playlist", {
    p_title: input.title.trim(),
    p_slug: input.slug.trim(),
    p_description: input.description?.trim() || null,
    p_metadata: {},
    p_idempotency_key: idempotencyKey("create"),
    p_correlation_id: correlationId(),
  });

  if (error) throw error;
  const row = firstRpcRow(data, "Create Playlist");

  return {
    playlistId: String(row.playlist_id),
    resourceId: String(row.resource_id),
  };
}

export async function updatePlaylistMetadata(
  playlistId: string,
  expectedRevision: number,
  payload: {
    title: string;
    slug: string;
    description: string | null;
  },
): Promise<PlaylistCommandResult> {
  const { data, error } = await supabase.rpc(
    "update_playlist_metadata",
    {
      p_playlist_id: playlistId,
      p_expected_authority_revision: expectedRevision,
      p_payload: payload as Json,
      p_idempotency_key: idempotencyKey("metadata"),
      p_correlation_id: correlationId(),
    },
  );
  if (error) throw error;
  return commandResult(firstRpcRow(data, "Update Playlist"));
}

export async function setPlaylistCover(
  playlistId: string,
  expectedRevision: number,
  assetId: string | null,
): Promise<PlaylistCommandResult> {
  const { data, error } = await supabase.rpc(
    "set_playlist_cover",
    {
      p_playlist_id: playlistId,
      p_expected_authority_revision: expectedRevision,
      p_asset_id: assetId,
      p_idempotency_key: idempotencyKey("cover"),
      p_placement_data: {},
      p_alt_text_snapshot: null,
      p_caption_snapshot: null,
      p_credit_snapshot: null,
      p_correlation_id: correlationId(),
    },
  );
  if (error) throw error;
  return commandResult(firstRpcRow(data, "Set Playlist cover"));
}

export async function addRegistryTrack(
  playlistId: string,
  expectedRevision: number,
  track: RegistryTrackSearchResult,
): Promise<PlaylistCommandResult> {
  const { data, error } = await supabase.rpc(
    "add_playlist_registry_track_with_intake_slots",
    {
      p_playlist_id: playlistId,
      p_expected_authority_revision: expectedRevision,
      p_registry_track_id: track.id,
      p_idempotency_key: idempotencyKey("item-add"),
      p_correlation_id: correlationId(),
    },
  );
  if (error) throw error;
  return commandResult(firstRpcRow(data, "Add Playlist track"));
}

type UntypedRpcResponse = {
  data: unknown;
  error: { message: string } | null;
};

async function invokeUntypedRpc(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const client = supabase as unknown as {
    rpc: (
      functionName: string,
      payload: Record<string, unknown>,
    ) => PromiseLike<UntypedRpcResponse>;
  };

  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

type YouTubePlayerEvent = {
  data: number;
  target: YouTubePlayerInstance;
};

type YouTubePlayerInstance = {
  cueVideoById: (videoId: string) => void;
  destroy: () => void;
};

type YouTubePlayerConstructor = new (
  element: HTMLElement,
  options: {
    width: string;
    height: string;
    videoId: string;
    playerVars: Record<string, string | number>;
    events: {
      onReady: (event: YouTubePlayerEvent) => void;
      onStateChange: (event: YouTubePlayerEvent) => void;
      onError: (event: YouTubePlayerEvent) => void;
    };
  },
) => YouTubePlayerInstance;

type WindowWithYouTube = Window & {
  YT?: {
    Player?: YouTubePlayerConstructor;
  };
};

let youtubeIframeApiPromise: Promise<YouTubePlayerConstructor> | null = null;

function loadYouTubeIframeApi(): Promise<YouTubePlayerConstructor> {
  const current = (window as WindowWithYouTube).YT?.Player;
  if (current) return Promise.resolve(current);

  if (youtubeIframeApiPromise) return youtubeIframeApiPromise;

  youtubeIframeApiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );

    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const constructor = (window as WindowWithYouTube).YT?.Player;
      if (constructor) {
        window.clearInterval(timer);
        resolve(constructor);
        return;
      }

      if (Date.now() - startedAt > 10_000) {
        window.clearInterval(timer);
        youtubeIframeApiPromise = null;
        reject(
          new Error(
            "YouTube playback checker did not load. Check your connection and try again.",
          ),
        );
      }
    }, 50);
  });

  return youtubeIframeApiPromise;
}

function youtubeProbeError(code: number): string {
  if (code === 100) {
    return "That YouTube video was removed, is private, or cannot be found.";
  }
  if (code === 101 || code === 150) {
    return "That YouTube video does not allow embedded playback.";
  }
  if (code === 5) {
    return "That YouTube video cannot be played in the browser player.";
  }
  if (code === 153) {
    return "YouTube could not identify this WAKILISHA player request.";
  }
  return `YouTube playback failed with player error ${code}.`;
}

async function probeYouTubePlayback(
  videoId: string,
): Promise<void> {
  const Player = await loadYouTubeIframeApi();

  await new Promise<void>((resolve, reject) => {
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    Object.assign(host.style, {
      position: "fixed",
      left: "-10000px",
      top: "0",
      width: "200px",
      height: "200px",
      pointerEvents: "none",
      opacity: "0.01",
      zIndex: "-1",
    });
    document.body.appendChild(host);

    let settled = false;
    let player: YouTubePlayerInstance | null = null;
    let timeout = 0;

    const cleanup = () => {
      window.clearTimeout(timeout);
      try {
        player?.destroy();
      } catch {
        // The IFrame API may already have removed the node.
      }
      host.remove();
    };

    const succeed = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };

    timeout = window.setTimeout(() => {
      fail(
        "YouTube did not confirm embedded playback in time. Try another source.",
      );
    }, 12_000);

    player = new Player(host, {
      width: "200",
      height: "200",
      videoId,
      playerVars: {
        origin: window.location.origin,
        playsinline: 1,
      },
      events: {
        onReady: (event) => {
          event.target.cueVideoById(videoId);
        },
        onStateChange: (event) => {
          if (event.data === 5) succeed();
        },
        onError: (event) => {
          fail(youtubeProbeError(event.data));
        },
      },
    });
  });
}

async function playlistProductErrorText(
  reason: unknown,
): Promise<string> {
  if (
    reason &&
    typeof reason === "object" &&
    "context" in reason
  ) {
    const context = (reason as { context?: unknown }).context;
    if (
      context &&
      typeof context === "object" &&
      "clone" in context
    ) {
      try {
        const response = context as Response;
        const payload = objectValue(
          await response.clone().json().catch(() => ({})),
        );
        const message = nullableString(payload.error);
        if (message) return message;
      } catch {
        // Fall through to the normal Error message.
      }
    }
  }

  return reason instanceof Error
    ? reason.message
    : "Playlist provider request failed.";
}

export async function validatePlaylistPlaybackUrl(
  playlistId: string,
  url: string,
): Promise<PlaylistPlaybackValidation> {
  const { data, error } = await supabase.functions.invoke(
    "playlist-product-api",
    {
      body: {
        action: "validate_playback",
        playlist_id: playlistId,
        url: url.trim(),
      },
    },
  );

  if (error) {
    throw new Error(await playlistProductErrorText(error));
  }

  let row = objectValue(data);
  if (row.ok !== true || !row.validation_id) {
    throw new Error(
      nullableString(row.error) ??
        "The provider link could not be validated.",
    );
  }

  if (row.validation_status === "probe_required") {
    if (
      String(row.providerKey ?? "") !== "youtube" ||
      !row.providerObjectId
    ) {
      throw new Error(
        "This playback source requires an unsupported browser probe.",
      );
    }

    await probeYouTubePlayback(String(row.providerObjectId));

    const { data: confirmed, error: confirmError } =
      await supabase.functions.invoke(
        "playlist-product-api",
        {
          body: {
            action: "confirm_playback",
            playlist_id: playlistId,
            validation_id: String(row.validation_id),
          },
        },
      );

    if (confirmError) {
      throw new Error(await playlistProductErrorText(confirmError));
    }

    const confirmation = objectValue(confirmed);
    if (
      confirmation.ok !== true ||
      confirmation.validation_status !== "playable"
    ) {
      throw new Error(
        nullableString(confirmation.error) ??
          "YouTube playback could not be confirmed.",
      );
    }

    row = {
      ...row,
      validation_status: "playable",
      expires_at:
        confirmation.expires_at ??
        row.expires_at,
    };
  }

  if (row.validation_status !== "playable") {
    throw new Error(
      nullableString(row.error) ??
        "The provider link is not playable.",
    );
  }

  return {
    validationId: String(row.validation_id),
    validationStatus: "playable",
    providerKey: String(row.providerKey ?? ""),
    providerObjectId: String(row.providerObjectId ?? ""),
    providerUrl: String(row.providerUrl ?? ""),
    canonicalUrl: String(row.canonicalUrl ?? ""),
    playbackKind:
      row.playbackKind === "video" ? "video" : "audio",
    embedUrl: nullableString(row.embedUrl),
    previewUrl: nullableString(row.previewUrl),
    titleHint: nullableString(row.titleHint),
    artistNamesHint: stringArray(row.artistNamesHint),
    releaseTitleHint: nullableString(row.releaseTitleHint),
    artworkUrl: nullableString(row.artworkUrl),
    expiresAt: String(row.expires_at ?? ""),
  };
}

export async function addValidatedPlaybackTrack(
  playlistId: string,
  expectedRevision: number,
  validationId: string,
  track: RegistryTrackSearchResult,
): Promise<PlaylistCommandResult> {
  const data = await invokeUntypedRpc(
    "add_playlist_validated_provider_track_with_intake_slots",
    {
      p_playlist_id: playlistId,
      p_expected_authority_revision: expectedRevision,
      p_registry_track_id: track.id,
      p_validation_id: validationId,
      p_idempotency_key: idempotencyKey("item-provider-add"),
      p_correlation_id: correlationId(),
    },
  );

  return commandResult(firstRpcRow(data, "Add validated Playlist track"));
}

export async function submitPlaylistRegistryIntake(
  playlistId: string,
  expectedRevision: number,
  validationId: string,
  artistCredits: RegistryIntakeArtistCreditInput[],
): Promise<{
  suggestionId: string;
  reservedPosition: number;
  authorityRevision: number;
}> {
  const data = await invokeUntypedRpc(
    "submit_playlist_registry_intake",
    {
      p_playlist_id: playlistId,
      p_expected_authority_revision: expectedRevision,
      p_validation_id: validationId,
      p_artist_credits: artistCredits.map((credit) => ({
        credit_role: credit.creditRole,
        resolution_mode: credit.resolutionMode,
        registry_artist_id: credit.registryArtistId,
        observed_name: credit.observedName,
      })),
      p_idempotency_key:
        idempotencyKey("registry-intake"),
      p_correlation_id: correlationId(),
    },
  );

  const row = objectValue(data);
  const suggestionId = nullableString(row.suggestion_id);
  const reservedPosition = numberValue(
    row.reserved_position,
  );
  const authorityRevision = numberValue(
    row.authority_revision,
  );

  if (!suggestionId || reservedPosition < 1) {
    throw new Error(
      "Registry intake suggestion was not created with a reserved Playlist position.",
    );
  }

  return {
    suggestionId,
    reservedPosition,
    authorityRevision,
  };
}


export async function savePlaylistPendingRegistryNote(
  playlistId: string,
  suggestionId: string,
  expectedRevision: number,
  note: string,
): Promise<number> {
  const data = await invokeUntypedRpc(
    "save_playlist_pending_registry_note",
    {
      p_playlist_id: playlistId,
      p_suggestion_id: suggestionId,
      p_expected_authority_revision: expectedRevision,
      p_note: note,
      p_idempotency_key:
        idempotencyKey("pending-registry-note"),
      p_correlation_id: correlationId(),
    },
  );

  return numberValue(
    objectValue(data).authority_revision,
    expectedRevision,
  );
}

export async function movePlaylistPendingRegistryIntake(
  playlistId: string,
  suggestionId: string,
  expectedRevision: number,
  direction: "up" | "down",
): Promise<number> {
  const data = await invokeUntypedRpc(
    "move_playlist_pending_registry_intake",
    {
      p_playlist_id: playlistId,
      p_suggestion_id: suggestionId,
      p_expected_authority_revision: expectedRevision,
      p_direction: direction,
      p_idempotency_key:
        idempotencyKey(`pending-registry-move-${direction}`),
      p_correlation_id: correlationId(),
    },
  );

  return numberValue(
    objectValue(data).authority_revision,
    expectedRevision,
  );
}


export async function searchPlaylistCuratorCandidates(
  query: string,
): Promise<PlaylistCuratorCandidate[]> {
  const normalized = query.trim();
  if (normalized.length < 2) return [];

  const pattern = `%${escapeLike(normalized)}%`;

  const [authorResponse, userResponse] = await Promise.all([
    supabase
      .from("registry_authors")
      .select("id,name,slug,avatar_url")
      .ilike("name", pattern)
      .order("name", { ascending: true })
      .limit(12),
    supabase
      .from("user_profiles")
      .select(
        "user_id,display_name,username,avatar_url,status,is_public",
      )
      .eq("status", "active")
      .eq("is_public", true)
      .ilike("display_name", pattern)
      .order("display_name", { ascending: true })
      .limit(12),
  ]);

  if (authorResponse.error) {
    throw authorResponse.error;
  }

  const authors: PlaylistCuratorCandidate[] =
    (authorResponse.data ?? []).map((author) => ({
      kind: "registry_author",
      id: author.id,
      displayName: author.name,
      slug: author.slug,
      username: null,
      avatarUrl: author.avatar_url,
    }));

  const users: PlaylistCuratorCandidate[] =
    userResponse.error
      ? []
      : (userResponse.data ?? [])
          .filter((profile) =>
            Boolean(profile.display_name?.trim()),
          )
          .map((profile) => ({
            kind: "user",
            id: profile.user_id,
            displayName: profile.display_name?.trim() ?? "",
            slug: null,
            username: profile.username,
            avatarUrl: profile.avatar_url,
          }));

  return [...authors, ...users].sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  );
}

export async function searchRegistryArtists(
  query: string,
): Promise<RegistryArtistSearchResult[]> {
  const normalized = query.trim();
  if (normalized.length < 2) return [];

  const { data, error } = await supabase
    .from("registry_artists")
    .select("id,display_name,slug,status")
    .in("status", ["active", "draft"])
    .ilike("display_name", `%${escapeLike(normalized)}%`)
    .order("display_name", { ascending: true })
    .limit(20);

  if (error) throw error;

  return (data ?? []).map((artist) => ({
    id: artist.id,
    displayName: artist.display_name,
    slug: artist.slug,
    status: artist.status,
  }));
}

function canvasBlob(
  canvas: HTMLCanvasElement,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Playlist cover variant could not be encoded."));
      },
      "image/webp",
      0.9,
    );
  });
}

export async function preparePlaylistCoverVariant(
  playlistId: string,
  sourceAssetId: string,
): Promise<{ assetId: string; url: string | null }> {
  const { data: authData, error: authError } =
    await supabase.auth.getSession();

  if (authError || !authData.session?.access_token) {
    throw new Error("Sign in again before preparing a Playlist cover.");
  }

  const supabaseUrl = String(
    import.meta.env.VITE_PUBLIC_SUPABASE_URL ?? "",
  ).replace(/\/+$/, "");
  const anonKey = String(
    import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY ?? "",
  );

  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase browser configuration is unavailable.");
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/playlist-product-api`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authData.session.access_token}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "cover_source",
        playlist_id: playlistId,
        asset_id: sourceAssetId,
      }),
    },
  );

  if (!response.ok) {
    const payload = objectValue(
      await response.json().catch(() => ({})),
    );
    throw new Error(
      nullableString(payload.error) ??
        "The selected image could not be prepared.",
    );
  }

  const sourceBlob = await response.blob();
  const bitmap = await createImageBitmap(sourceBlob);

  try {
    const side = Math.min(bitmap.width, bitmap.height);
    if (side <= 0) {
      throw new Error("The selected image has invalid dimensions.");
    }

    const sourceX = Math.floor((bitmap.width - side) / 2);
    const sourceY = Math.floor((bitmap.height - side) / 2);
    const size = 1200;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d", {
      alpha: false,
    });
    if (!context) {
      throw new Error("Playlist cover preparation is unavailable.");
    }

    context.drawImage(
      bitmap,
      sourceX,
      sourceY,
      side,
      side,
      0,
      0,
      size,
      size,
    );

    const blob = await canvasBlob(canvas);
    const file = new File(
      [blob],
      `playlist-cover-${playlistId}-${Date.now()}.webp`,
      { type: "image/webp" },
    );

    const asset = await mediaService.upload(file, {
      title: "Playlist cover variant",
      fileKind: "image",
      assetPurpose: "playlist_cover",
      sourceKind: "derived",
      sourceEntity: "playlist_cover_variant",
      sourceRecordId: sourceAssetId,
      altText: "Playlist cover",
      description:
        "Prepared square Playlist-cover variant derived from a canonical Media image.",
    });

    return {
      assetId: asset.id,
      url: asset.url ?? null,
    };
  } finally {
    bitmap.close();
  }
}

export async function removePlaylistItem(
  playlistId: string,
  playlistItemId: string,
  expectedRevision: number,
): Promise<PlaylistCommandResult> {
  const { data, error } = await supabase.rpc(
    "remove_playlist_item_with_intake_slots",
    {
      p_playlist_id: playlistId,
      p_playlist_item_id: playlistItemId,
      p_expected_authority_revision: expectedRevision,
      p_idempotency_key: idempotencyKey("item-remove"),
      p_correlation_id: correlationId(),
    },
  );
  if (error) throw error;
  return commandResult(firstRpcRow(data, "Remove Playlist track"));
}

export async function reorderPlaylistItems(
  playlistId: string,
  expectedRevision: number,
  orderedItemIds: string[],
): Promise<PlaylistCommandResult> {
  const { data, error } = await supabase.rpc(
    "reorder_playlist_items_with_intake_slots",
    {
      p_playlist_id: playlistId,
      p_expected_authority_revision: expectedRevision,
      p_ordered_item_ids: orderedItemIds,
      p_idempotency_key: idempotencyKey("reorder"),
      p_correlation_id: correlationId(),
    },
  );
  if (error) throw error;
  return commandResult(firstRpcRow(data, "Reorder Playlist"));
}

export async function savePlaylistItemNote(
  playlistId: string,
  playlistItemId: string,
  expectedRevision: number,
  note: string,
): Promise<PlaylistCommandResult> {
  const { data, error } = await supabase.rpc(
    "save_playlist_item_note",
    {
      p_playlist_id: playlistId,
      p_playlist_item_id: playlistItemId,
      p_expected_authority_revision: expectedRevision,
      p_note: note,
      p_idempotency_key: idempotencyKey("item-note"),
      p_correlation_id: correlationId(),
    },
  );
  if (error) throw error;
  return commandResult(firstRpcRow(data, "Save Playlist note"));
}

export async function resolvePlaylistItemMatch(
  playlistId: string,
  playlistItemId: string,
  expectedRevision: number,
  track: RegistryTrackSearchResult,
): Promise<PlaylistCommandResult> {
  const { data, error } = await supabase.rpc(
    "resolve_playlist_item_match",
    {
      p_playlist_id: playlistId,
      p_playlist_item_id: playlistItemId,
      p_expected_authority_revision: expectedRevision,
      p_match_status: "matched",
      p_registry_track_id: track.id,
      p_match_confidence: 1,
      p_idempotency_key: idempotencyKey("item-match"),
      p_correlation_id: correlationId(),
    },
  );
  if (error) throw error;
  return commandResult(firstRpcRow(data, "Match Playlist track"));
}

export async function setPlaylistCurator(
  playlistId: string,
  expectedRevision: number,
  selection: PlaylistCuratorSelection,
): Promise<PlaylistCommandResult> {
  const data = await invokeUntypedRpc(
    "set_playlist_curator",
    {
      p_playlist_id: playlistId,
      p_expected_authority_revision: expectedRevision,
      p_registry_author_id:
        selection.kind === "registry_author"
          ? selection.registryAuthorId
          : null,
      p_user_id:
        selection.kind === "user"
          ? selection.userId
          : null,
      p_idempotency_key:
        idempotencyKey("curator-set"),
      p_correlation_id: correlationId(),
    },
  );

  return commandResult(
    firstRpcRow(data, "Set Playlist Curator"),
  );
}

export async function createPlaylistPreviewLink(
  playlistId: string,
  versionId?: string | null,
  expiresAt?: string | null,
): Promise<PlaylistPreviewLink> {
  const { data, error } = await supabase.rpc(
    "create_playlist_preview_link",
    {
      p_playlist_id: playlistId,
      ...(versionId
        ? { p_version_id: versionId }
        : {}),
      ...(expiresAt
        ? { p_expires_at: expiresAt }
        : {}),
    },
  );

  if (error) throw error;
  const row = firstRpcRow(
    data,
    "Create Playlist Preview",
  );

  return {
    nonce: String(row.nonce),
    expiresAt: String(row.expires_at),
    versionId: String(row.version_id),
  };
}

export async function schedulePlaylistPublication(
  playlistId: string,
  expectedRevision: number,
  approvedVersionId: string,
  publishAt: string,
  note?: string,
): Promise<PlaylistCommandResult> {
  const { data, error } = await supabase.rpc(
    "schedule_playlist_publication",
    {
      p_playlist_id: playlistId,
      p_expected_authority_revision: expectedRevision,
      p_approved_version_id: approvedVersionId,
      p_publish_at: publishAt,
      p_idempotency_key:
        idempotencyKey("schedule"),
      p_note: note?.trim() || null,
      p_correlation_id: correlationId(),
    },
  );

  if (error) throw error;
  return commandResult(
    firstRpcRow(data, "Schedule Playlist"),
  );
}

export async function publishPlaylistVersion(
  playlistId: string,
  expectedRevision: number,
  approvedVersionId: string,
  note?: string,
): Promise<PlaylistCommandResult> {
  const { data, error } = await supabase.rpc(
    "publish_playlist_version",
    {
      p_playlist_id: playlistId,
      p_expected_authority_revision: expectedRevision,
      p_approved_version_id: approvedVersionId,
      p_idempotency_key:
        idempotencyKey("publish"),
      p_note: note?.trim() || null,
      p_correlation_id: correlationId(),
    },
  );

  if (error) throw error;
  return commandResult(
    firstRpcRow(data, "Publish Playlist"),
  );
}

export async function unschedulePlaylistPublication(
  playlistId: string,
  expectedRevision: number,
  note?: string,
): Promise<PlaylistCommandResult> {
  const { data, error } = await supabase.rpc(
    "unschedule_playlist_publication",
    {
      p_playlist_id: playlistId,
      p_expected_authority_revision: expectedRevision,
      p_idempotency_key:
        idempotencyKey("unschedule"),
      p_note: note?.trim() || null,
      p_correlation_id: correlationId(),
    },
  );

  if (error) throw error;
  return commandResult(
    firstRpcRow(data, "Unschedule Playlist"),
  );
}

export async function unpublishPlaylist(
  playlistId: string,
  expectedRevision: number,
  note?: string,
): Promise<PlaylistCommandResult> {
  const { data, error } = await supabase.rpc(
    "unpublish_playlist",
    {
      p_playlist_id: playlistId,
      p_expected_authority_revision: expectedRevision,
      p_idempotency_key:
        idempotencyKey("unpublish"),
      p_note: note?.trim() || null,
      p_correlation_id: correlationId(),
    },
  );

  if (error) throw error;
  return commandResult(
    firstRpcRow(data, "Unpublish Playlist"),
  );
}

export async function archivePlaylist(
  playlistId: string,
  expectedRevision: number,
  note?: string,
): Promise<PlaylistCommandResult> {
  const { data, error } = await supabase.rpc(
    "archive_playlist",
    {
      p_playlist_id: playlistId,
      p_expected_authority_revision: expectedRevision,
      p_idempotency_key:
        idempotencyKey("archive"),
      p_note: note?.trim() || null,
      p_correlation_id: correlationId(),
    },
  );

  if (error) throw error;
  return commandResult(
    firstRpcRow(data, "Archive Playlist"),
  );
}

export async function restorePlaylistFromArchive(
  playlistId: string,
  expectedRevision: number,
  note?: string,
): Promise<PlaylistCommandResult> {
  const { data, error } = await supabase.rpc(
    "restore_playlist_from_archive",
    {
      p_playlist_id: playlistId,
      p_expected_authority_revision: expectedRevision,
      p_idempotency_key:
        idempotencyKey("restore"),
      p_note: note?.trim() || null,
      p_correlation_id: correlationId(),
    },
  );

  if (error) throw error;
  return commandResult(
    firstRpcRow(data, "Restore Playlist"),
  );
}

export async function snapshotPlaylistWorkingVersion(
  playlistId: string,
  expectedRevision: number,
): Promise<PlaylistCommandResult> {
  const { data, error } = await supabase.rpc(
    "snapshot_playlist_working_version",
    {
      p_playlist_id: playlistId,
      p_expected_authority_revision: expectedRevision,
      p_idempotency_key: idempotencyKey("snapshot"),
      p_correlation_id: correlationId(),
    },
  );
  if (error) throw error;
  return commandResult(firstRpcRow(data, "Snapshot Playlist"));
}

export async function submitPlaylistForReview(
  playlistId: string,
  expectedRevision: number,
  note?: string,
): Promise<PlaylistCommandResult> {
  const { data, error } = await supabase.rpc(
    "submit_playlist_for_review",
    {
      p_playlist_id: playlistId,
      p_expected_authority_revision: expectedRevision,
      p_note: note?.trim() || null,
      p_idempotency_key: idempotencyKey("review-submit"),
      p_correlation_id: correlationId(),
    },
  );
  if (error) throw error;
  return commandResult(firstRpcRow(data, "Submit Playlist"));
}

export async function reviewPlaylist(
  playlistId: string,
  submittedVersionId: string,
  expectedRevision: number,
  decision: "start_review" | "request_changes" | "approve",
  note?: string,
): Promise<PlaylistCommandResult> {
  const { data, error } = await supabase.rpc("review_playlist", {
    p_playlist_id: playlistId,
    p_submitted_version_id: submittedVersionId,
    p_expected_authority_revision: expectedRevision,
    p_decision: decision,
    p_note: note?.trim() || null,
    p_idempotency_key: idempotencyKey(`review-${decision}`),
    p_correlation_id: correlationId(),
  });
  if (error) throw error;
  return commandResult(firstRpcRow(data, "Review Playlist"));
}

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

export async function searchRegistryTracks(
  query: string,
): Promise<RegistryTrackSearchResult[]> {
  const normalized = query.trim();
  if (normalized.length < 2) return [];

  const pattern = `%${escapeLike(normalized)}%`;

  const [titleResponse, artistResponse] = await Promise.all([
    supabase
      .from("registry_tracks")
      .select(
        "id,slug,title,artwork_url,preview_url,release_id",
      )
      .eq("status", "active")
      .ilike("title", pattern)
      .limit(20),
    supabase
      .from("registry_track_artists")
      .select("track_id,artist_name_text")
      .eq("status", "active")
      .ilike("artist_name_text", pattern)
      .limit(30),
  ]);

  if (titleResponse.error) throw titleResponse.error;
  if (artistResponse.error) throw artistResponse.error;

  const titleRows = titleResponse.data ?? [];
  const artistTrackIds = (artistResponse.data ?? [])
    .map((row) => row.track_id)
    .filter(Boolean);

  const titleIds = titleRows.map((row) => row.id);
  const allIds = Array.from(new Set([...titleIds, ...artistTrackIds]))
    .slice(0, 30);

  if (allIds.length === 0) return [];

  const [trackResponse, creditResponse] = await Promise.all([
    supabase
      .from("registry_tracks")
      .select(
        "id,slug,title,artwork_url,preview_url,release_id",
      )
      .in("id", allIds)
      .eq("status", "active"),
    supabase
      .from("registry_track_artists")
      .select("track_id,artist_name_text,is_primary")
      .in("track_id", allIds)
      .eq("status", "active"),
  ]);

  if (trackResponse.error) throw trackResponse.error;
  if (creditResponse.error) throw creditResponse.error;

  const tracks = trackResponse.data ?? [];
  const releaseIds = Array.from(
    new Set(
      tracks.map((track) => track.release_id).filter(Boolean),
    ),
  ) as string[];

  const releaseResponse = releaseIds.length
    ? await supabase
        .from("registry_releases")
        .select("id,title")
        .in("id", releaseIds)
    : { data: [], error: null };

  if (releaseResponse.error) throw releaseResponse.error;

  const releaseTitleById = new Map(
    (releaseResponse.data ?? []).map((release) => [
      release.id,
      release.title,
    ]),
  );

  const artistsByTrack = new Map<string, string[]>();
  (creditResponse.data ?? []).forEach((credit) => {
    const names = artistsByTrack.get(credit.track_id) ?? [];
    const name = credit.artist_name_text?.trim();
    if (name && !names.includes(name)) names.push(name);
    artistsByTrack.set(credit.track_id, names);
  });

  const trackById = new Map(
    tracks.map((track) => [track.id, track]),
  );

  return allIds.flatMap((id) => {
    const track = trackById.get(id);
    if (!track) return [];
    return [{
      id: track.id,
      slug: track.slug,
      title: track.title,
      artistNames: artistsByTrack.get(track.id) ?? [],
      releaseId: track.release_id,
      releaseTitle: track.release_id
        ? releaseTitleById.get(track.release_id) ?? null
        : null,
      artworkUrl: track.artwork_url,
      previewUrl: track.preview_url,
    } satisfies RegistryTrackSearchResult];
  });
}
