import type { PlaybackBackend, PlayerTrack, PlaySource } from "@/context/PlayerContext";

const LS_HISTORY = "wk-listening-history-v1";
const MAX_HISTORY = 100;

export type ListeningEventKind = "start" | "progress" | "complete";

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
    const raw = localStorage.getItem(LS_HISTORY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(items: ListeningHistoryItem[]) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(LS_HISTORY, JSON.stringify(items.slice(0, MAX_HISTORY)));
    window.dispatchEvent(new CustomEvent("wk-listening-history-changed"));
  } catch {
    // localStorage may be unavailable or full.
  }
}

function trackKey(track: PlayerTrack): string {
  return track.trackSlug || track.id;
}

function trackUrl(track: PlayerTrack): string {
  if (track.artistSlug && track.trackSlug) return `/tracks/${track.artistSlug}/${track.trackSlug}`;
  if (track.trackSlug) return `/tracks/${track.trackSlug}`;
  return `/tracks/${track.id}`;
}

function matchesTrack(item: ListeningHistoryItem, track: PlayerTrack | string): boolean {
  const key = typeof track === "string" ? track : trackKey(track);
  const id = typeof track === "string" ? track : track.id;
  const slug = typeof track === "string" ? track : track.trackSlug;

  return item.trackId === id ||
    item.trackId === key ||
    item.trackSlug === key ||
    Boolean(slug && item.trackSlug === slug);
}

export function getListeningHistory(): ListeningHistoryItem[] {
  return safeRead().sort((a, b) => new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime());
}

export function getListeningHistoryForTrack(trackIdOrSlug: string): ListeningHistoryItem | null {
  return getListeningHistory().find((item) => matchesTrack(item, trackIdOrSlug)) || null;
}

export function clearListeningHistory() {
  safeWrite([]);
}

export function recordListeningEvent(track: PlayerTrack, input: ListeningEventInput) {
  if (!track?.id || !track?.title) return;

  const now = new Date().toISOString();
  const items = safeRead();
  const index = items.findIndex((item) => matchesTrack(item, track));
  const existing = index >= 0 ? items[index] : null;

  const duration = Math.max(0, input.duration || track.duration || existing?.duration || 0);
  const currentTime = Math.max(0, Math.min(input.currentTime || 0, duration || input.currentTime || 0));
  const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : existing?.progress || 0;
  const isFullPlayback =
    input.backend !== "audio";

  const shouldCountFullPlay =
    isFullPlayback &&
    (
      input.kind === "start" ||
      existing?.backend !==
        input.backend
    );

  const next: ListeningHistoryItem = {
    id: existing?.id || `${trackKey(track)}:${Date.now()}`,
    trackId: track.id,
    trackSlug: track.trackSlug || existing?.trackSlug,
    artistSlug: track.artistSlug || existing?.artistSlug,
    title: track.title,
    artist: track.artist,
    album: track.album || existing?.album,
    artworkUrl: track.artworkUrl || existing?.artworkUrl,
    trackUrl: trackUrl(track),
    source: track.source ?? existing?.source ?? null,
    backend: input.backend,
    firstPlayedAt: existing?.firstPlayedAt || now,
    lastPlayedAt: now,
    playCount: (existing?.playCount || 0) + (input.kind === "start" ? 1 : 0),
    fullPlayCount: (existing?.fullPlayCount || 0) + (shouldCountFullPlay ? 1 : 0),
    completedCount: (existing?.completedCount || 0) + (input.kind === "complete" ? 1 : 0),
    currentTime,
    duration,
    progress,
    pageType: input.playSource?.pageType ?? existing?.pageType ?? null,
    entityType: input.playSource?.entityType ?? existing?.entityType ?? null,
    entitySlug: input.playSource?.entitySlug ?? existing?.entitySlug ?? null,
    sourceSection: input.playSource?.sourceSection ?? existing?.sourceSection ?? null,
  };

  const nextItems = index >= 0
    ? [next, ...items.filter((_, i) => i !== index)]
    : [next, ...items];

  safeWrite(nextItems);
}

export function formatListeningProgress(item: ListeningHistoryItem): string {
  if (item.completedCount > 0 || item.progress >= 0.9) return "Finished";
  if (item.progress > 0.08) return `${Math.round(item.progress * 100)}% played`;
  return "Started";
}
