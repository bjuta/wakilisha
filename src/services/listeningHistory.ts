import type {
  PlaybackBackend,
  PlayerTrack,
  PlaySource,
} from "@/context/PlayerContext";
import {
  resolvePlayerExperience,
  type PlayerMediaKind,
  type PlayerAvailability,
} from "@/services/player/playerExperience";

const LS_HISTORY = "wk-listening-history-v1";
const MAX_HISTORY = 100;

export type ListeningEventKind =
  | "start"
  | "progress"
  | "complete";

export interface ListeningHistoryItem {
  id: string;
  trackId: string;
  trackSlug?: string;
  artistSlug?: string;
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  trackUrl: string;
  source?: string | null;
  backend: PlaybackBackend;
  mediaKind?: PlayerMediaKind;
  playbackAvailability?: PlayerAvailability;
  canonicalPath?: string | null;
  firstPlayedAt: string;
  lastPlayedAt: string;
  playCount: number;
  fullPlayCount: number;
  completedCount: number;
  currentTime: number;
  duration: number;
  progress: number;
  pageType?: string | null;
  entityType?: string | null;
  entitySlug?: string | null;
  sourceSection?: string | null;
}

export interface ListeningEventInput {
  kind: ListeningEventKind;
  backend: PlaybackBackend;
  currentTime?: number;
  duration?: number;
  playSource?: PlaySource | null;
}

function safeRead(): ListeningHistoryItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw =
      localStorage.getItem(LS_HISTORY);
    const parsed = raw
      ? JSON.parse(raw)
      : [];
    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function safeWrite(
  items: ListeningHistoryItem[],
) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      LS_HISTORY,
      JSON.stringify(
        items.slice(0, MAX_HISTORY),
      ),
    );
    window.dispatchEvent(
      new CustomEvent(
        "wk-listening-history-changed",
      ),
    );
  } catch {
    // localStorage may be unavailable or full.
  }
}

function mediaKey(
  track: PlayerTrack,
  backend: PlaybackBackend = "audio",
): string {
  const experience =
    resolvePlayerExperience(
      track,
      backend,
    );

  return (
    experience.canonicalPath ||
    track.trackSlug ||
    track.id
  );
}

function mediaUrl(
  track: PlayerTrack,
  backend: PlaybackBackend,
): string {
  const experience =
    resolvePlayerExperience(
      track,
      backend,
    );

  if (experience.canonicalPath) {
    return experience.canonicalPath;
  }

  if (
    track.artistSlug &&
    track.trackSlug
  ) {
    return `/tracks/${track.artistSlug}/${track.trackSlug}`;
  }

  if (track.trackSlug) {
    return `/tracks/${track.trackSlug}`;
  }

  return `/tracks/${track.id}`;
}

function matchesTrack(
  item: ListeningHistoryItem,
  track: PlayerTrack | string,
): boolean {
  if (typeof track === "string") {
    return (
      item.trackId === track ||
      item.trackSlug === track ||
      item.canonicalPath === track ||
      item.trackUrl === track
    );
  }

  const keys = new Set(
    [
      track.id,
      track.trackSlug,
      mediaKey(track),
    ].filter(
      (value): value is string =>
        Boolean(value),
    ),
  );

  return (
    keys.has(item.trackId) ||
    Boolean(
      item.trackSlug &&
      keys.has(item.trackSlug),
    ) ||
    Boolean(
      item.canonicalPath &&
      keys.has(item.canonicalPath),
    ) ||
    keys.has(item.trackUrl)
  );
}

export function getListeningHistory(): ListeningHistoryItem[] {
  return safeRead().sort(
    (a, b) =>
      new Date(b.lastPlayedAt).getTime() -
      new Date(a.lastPlayedAt).getTime(),
  );
}

export function getListeningHistoryForTrack(
  trackIdOrSlug: string,
): ListeningHistoryItem | null {
  return (
    getListeningHistory().find(
      (item) =>
        matchesTrack(
          item,
          trackIdOrSlug,
        ),
    ) || null
  );
}

export function clearListeningHistory() {
  safeWrite([]);
}

export function recordListeningEvent(
  track: PlayerTrack,
  input: ListeningEventInput,
) {
  if (!track?.id || !track?.title) return;

  const now = new Date().toISOString();
  const items = safeRead();
  const index = items.findIndex(
    (item) => matchesTrack(item, track),
  );
  const existing =
    index >= 0
      ? items[index]
      : null;
  const experience =
    resolvePlayerExperience(
      track,
      input.backend,
    );

  const duration = Math.max(
    0,
    input.duration ||
      track.duration ||
      existing?.duration ||
      0,
  );
  const currentTime = Math.max(
    0,
    Math.min(
      input.currentTime || 0,
      duration || input.currentTime || 0,
    ),
  );
  const progress =
    duration > 0
      ? Math.max(
          0,
          Math.min(
            1,
            currentTime / duration,
          ),
        )
      : existing?.progress || 0;
  const isFullPlayback =
    experience.availability === "full";
  const shouldCountFullPlay =
    isFullPlayback &&
    (
      input.kind === "start" ||
      existing?.playbackAvailability !==
        "full"
    );

  const canonicalPath =
    experience.canonicalPath ??
    existing?.canonicalPath ??
    null;

  const next: ListeningHistoryItem = {
    id:
      existing?.id ||
      `${mediaKey(track, input.backend)}:${Date.now()}`,
    trackId: track.id,
    trackSlug:
      track.trackSlug ||
      existing?.trackSlug,
    artistSlug:
      track.artistSlug ||
      existing?.artistSlug,
    title: track.title,
    artist:
      experience.creatorLabel ||
      track.artist,
    album:
      experience.contextLabel ||
      track.album ||
      existing?.album,
    artworkUrl:
      track.artworkUrl ||
      existing?.artworkUrl,
    trackUrl:
      mediaUrl(
        track,
        input.backend,
      ),
    source:
      track.source ??
      existing?.source ??
      null,
    backend: input.backend,
    mediaKind:
      experience.mediaKind,
    playbackAvailability:
      experience.availability,
    canonicalPath,
    firstPlayedAt:
      existing?.firstPlayedAt ||
      now,
    lastPlayedAt: now,
    playCount:
      (existing?.playCount || 0) +
      (input.kind === "start" ? 1 : 0),
    fullPlayCount:
      (existing?.fullPlayCount || 0) +
      (shouldCountFullPlay ? 1 : 0),
    completedCount:
      (existing?.completedCount || 0) +
      (input.kind === "complete" ? 1 : 0),
    currentTime,
    duration,
    progress,
    pageType:
      input.playSource?.pageType ??
      existing?.pageType ??
      null,
    entityType:
      input.playSource?.entityType ??
      existing?.entityType ??
      experience.mediaKind,
    entitySlug:
      input.playSource?.entitySlug ??
      existing?.entitySlug ??
      canonicalPath,
    sourceSection:
      input.playSource?.sourceSection ??
      existing?.sourceSection ??
      null,
  };

  const nextItems =
    index >= 0
      ? [
          next,
          ...items.filter(
            (_, i) => i !== index,
          ),
        ]
      : [next, ...items];

  safeWrite(nextItems);
}

export function formatListeningProgress(
  item: ListeningHistoryItem,
): string {
  if (
    item.completedCount > 0 ||
    item.progress >= 0.9
  ) {
    return "Finished";
  }

  if (item.progress > 0.08) {
    return `${Math.round(item.progress * 100)}% played`;
  }

  return "Started";
}
