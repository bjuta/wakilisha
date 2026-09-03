import {
  decodePublicAudioPublication,
  type PublicAudioPublication,
  type PublicAudioSeason,
} from "@/services/audio/audioPublicModel";
import {
  decodePublicVideoPublication,
  type PublicVideoPublication,
} from "@/services/video/videoPublicModel";
import {
  showEpisodePath,
  showPath,
} from "./showIdentity";

type UnknownRecord = Record<string, unknown>;

export interface PublicShowHeader {
  resourceId: string;
  slug: string;
  title: string;
  description: string | null;
  canonicalPath: string;
  feedPath: string | null;
  episodeCount: number;
  audioEpisodeCount: number;
  videoEpisodeCount: number;
}

export interface PublicShowEpisodeIdentity {
  resourceId: string;
  showResourceId: string;
  slug: string;
  canonicalPath: string;
  title: string;
  summary: string | null;
  episodeNumber: number | null;
}

export interface PublicShowEpisode {
  episode: PublicShowEpisodeIdentity;
  audio: PublicAudioPublication | null;
  video: PublicVideoPublication | null;
}

export interface PublicShowDetail {
  show: PublicShowHeader;
  seasons: PublicAudioSeason[];
  episodes: PublicShowEpisode[];
}

export interface PublicShowIndex {
  items: PublicShowHeader[];
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
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
  return stringValue(value) || null;
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = numberValue(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function decodeSeason(value: unknown): PublicAudioSeason | null {
  const input = record(value);
  const id = stringValue(input.id);
  const resourceId = stringValue(input.resource_id);
  const title = stringValue(input.title);

  if (!id || !resourceId || !title) return null;

  return {
    id,
    resourceId,
    seasonNumber: numberValue(input.season_number),
    title,
    description: nullableString(input.description),
  };
}

function decodeShowHeader(value: unknown): PublicShowHeader | null {
  const input = record(value);
  const resourceId = stringValue(input.resource_id);
  const slug = stringValue(input.slug);
  const title = stringValue(input.title);
  const canonicalPath = stringValue(input.canonical_path);

  if (
    !resourceId
    || !slug
    || !title
    || canonicalPath !== showPath(slug)
  ) {
    return null;
  }

  return {
    resourceId,
    slug,
    title,
    description: nullableString(input.description),
    canonicalPath,
    feedPath: nullableString(input.feed_path),
    episodeCount: numberValue(input.episode_count),
    audioEpisodeCount: numberValue(input.audio_episode_count),
    videoEpisodeCount: numberValue(input.video_episode_count),
  };
}

export function decodePublicShowEpisode(
  value: unknown,
  expectedShowSlug?: string,
): PublicShowEpisode | null {
  const root = record(value);
  const episodeInput = record(root.episode);
  const audio = root.audio
    ? decodePublicAudioPublication(root.audio)
    : null;
  const video = root.video
    ? decodePublicVideoPublication(root.video)
    : null;

  const resourceId = stringValue(episodeInput.resource_id);
  const showResourceId = stringValue(episodeInput.show_resource_id);
  const slug = stringValue(episodeInput.slug);
  const canonicalPath = stringValue(episodeInput.canonical_path);
  const title = stringValue(episodeInput.title);
  const showSlug = expectedShowSlug?.trim() || "";

  if (
    !resourceId
    || !showResourceId
    || !slug
    || !canonicalPath
    || !title
    || (!audio && !video)
    || (showSlug && canonicalPath !== showEpisodePath(showSlug, slug))
  ) {
    return null;
  }

  if (
    audio
    && (
      audio.publicationKind !== "episode"
      || audio.canonicalPath !== canonicalPath
      || (showSlug && audio.show?.slug !== showSlug)
    )
  ) {
    return null;
  }

  if (
    video
    && (
      video.publicationKind !== "episode"
      || video.canonicalPath !== canonicalPath
      || (showSlug && video.show?.slug !== showSlug)
    )
  ) {
    return null;
  }

  return {
    episode: {
      resourceId,
      showResourceId,
      slug,
      canonicalPath,
      title,
      summary: nullableString(episodeInput.summary),
      episodeNumber: nullableNumber(episodeInput.episode_number),
    },
    audio,
    video,
  };
}

export function decodePublicShow(
  value: unknown,
): PublicShowDetail | null {
  if (!value) return null;

  const root = record(value);
  const show = decodeShowHeader(root.show);
  if (!show) return null;

  const episodes = array(root.episodes)
    .map((episode) => decodePublicShowEpisode(episode, show.slug))
    .filter((episode): episode is PublicShowEpisode => episode !== null)
    .filter((episode) => episode.episode.showResourceId === show.resourceId);

  if (
    episodes.length === 0
    || show.episodeCount !== episodes.length
    || show.audioEpisodeCount
       !== episodes.filter((episode) => episode.audio !== null).length
    || show.videoEpisodeCount
       !== episodes.filter((episode) => episode.video !== null).length
  ) {
    return null;
  }

  const seasons = array(root.seasons)
    .map(decodeSeason)
    .filter((season): season is PublicAudioSeason => season !== null);

  return {
    show,
    seasons,
    episodes,
  };
}

export function decodePublicShowIndex(
  value: unknown,
): PublicShowIndex {
  const root = record(value);
  const items = array(root.items)
    .map(decodeShowHeader)
    .filter((item): item is PublicShowHeader => item !== null);

  return { items };
}
