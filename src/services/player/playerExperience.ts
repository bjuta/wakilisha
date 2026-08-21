import type {
  PlaybackBackend,
  PlayerTrack,
} from "@/context/PlayerContext";

export type PlayerMediaKind =
  | "music_track"
  | "audio_episode"
  | "standalone_audio";

export type PlayerAvailability =
  | "full"
  | "excerpt"
  | "unavailable";

export interface PlayerChapter {
  id: string;
  startSeconds: number;
  title: string;
}

export interface PlayerTranscript {
  url: string;
  label?: string | null;
}

export interface PlayerCapabilities {
  previousNext: boolean;
  jumpBySeconds: number | null;
  shuffle: boolean;
  repeat: boolean;
  queue: boolean;
  lyrics: boolean;
  chapters: boolean;
  transcript: boolean;
  moments: boolean;
  addToPlaylist: boolean;
  save: boolean;
  share: boolean;
  playbackSpeed: boolean;
}

export interface PlayerExperienceFields {
  mediaKind?: PlayerMediaKind;
  canonicalPath?: string | null;
  creatorLabel?: string | null;
  contextLabel?: string | null;
  playbackAvailability?: PlayerAvailability;
  chapters?: PlayerChapter[];
  transcript?: PlayerTranscript | null;
  capabilities?: Partial<PlayerCapabilities>;
}

export type PlayerMediaItem =
  PlayerTrack &
  PlayerExperienceFields;

export interface PlayerExperience {
  mediaKind: PlayerMediaKind;
  spokenAudio: boolean;
  canonicalPath: string | null;
  creatorLabel: string;
  contextLabel: string | null;
  availability: PlayerAvailability;
  chapters: PlayerChapter[];
  transcript: PlayerTranscript | null;
  capabilities: PlayerCapabilities;
}

const MUSIC_CAPABILITIES: PlayerCapabilities = {
  previousNext: true,
  jumpBySeconds: null,
  shuffle: true,
  repeat: true,
  queue: true,
  lyrics: true,
  chapters: false,
  transcript: false,
  moments: true,
  addToPlaylist: true,
  save: true,
  share: true,
  playbackSpeed: false,
};

const SPOKEN_AUDIO_CAPABILITIES: PlayerCapabilities = {
  previousNext: false,
  jumpBySeconds: 15,
  shuffle: false,
  repeat: false,
  queue: true,
  lyrics: false,
  chapters: true,
  transcript: true,
  moments: false,
  addToPlaylist: false,
  save: false,
  share: true,
  playbackSpeed: true,
};

function asMediaItem(
  track: PlayerTrack,
): PlayerMediaItem {
  return track as PlayerMediaItem;
}

function defaultTrackPath(
  track: PlayerTrack,
): string | null {
  if (
    track.artistSlug &&
    track.trackSlug
  ) {
    return `/tracks/${track.artistSlug}/${track.trackSlug}`;
  }

  if (track.trackSlug) {
    return `/tracks/${track.trackSlug}`;
  }

  return null;
}

function resolveAvailability(
  item: PlayerMediaItem,
  backend: PlaybackBackend,
  spokenAudio: boolean,
): PlayerAvailability {
  if (item.playbackAvailability) {
    return item.playbackAvailability;
  }

  if (spokenAudio) {
    return item.previewUrl
      ? "full"
      : "unavailable";
  }

  if (backend !== "audio") {
    return "full";
  }

  return item.previewUrl
    ? "excerpt"
    : "unavailable";
}

export function resolvePlayerExperience(
  track: PlayerTrack,
  backend: PlaybackBackend,
): PlayerExperience {
  const item = asMediaItem(track);
  const mediaKind =
    item.mediaKind ??
    "music_track";
  const spokenAudio =
    mediaKind === "audio_episode" ||
    mediaKind === "standalone_audio";
  const defaults = spokenAudio
    ? SPOKEN_AUDIO_CAPABILITIES
    : MUSIC_CAPABILITIES;

  return {
    mediaKind,
    spokenAudio,
    canonicalPath:
      item.canonicalPath ??
      defaultTrackPath(track),
    creatorLabel:
      item.creatorLabel?.trim() ||
      track.artist ||
      "WAKILISHA",
    contextLabel:
      item.contextLabel?.trim() ||
      track.album?.trim() ||
      null,
    availability:
      resolveAvailability(
        item,
        backend,
        spokenAudio,
      ),
    chapters:
      Array.isArray(item.chapters)
        ? item.chapters
        : [],
    transcript:
      item.transcript?.url
        ? item.transcript
        : null,
    capabilities: {
      ...defaults,
      ...(item.capabilities ?? {}),
    },
  };
}

export function playerMediaItem(
  track: PlayerTrack,
  fields: PlayerExperienceFields,
): PlayerMediaItem {
  return {
    ...track,
    ...fields,
  };
}

export function formatPlayerClock(
  seconds: number,
): string {
  if (
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {
    return "0:00";
  }

  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remainder = String(whole % 60)
    .padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${remainder}`;
  }

  return `${minutes}:${remainder}`;
}
