import {
  decodePublicAudioPublication,
  type PublicAudioPublication,
  type PublicAudioSeason,
} from "@/services/audio/audioPublicModel";
import {
  showEpisodePath,
  showFeedPath,
  showPath,
} from "./showIdentity";

type UnknownRecord = Record<string, unknown>;

export interface PublicShowHeader {
  resourceId: string;
  slug: string;
  title: string;
  description: string | null;
  canonicalPath: string;
  feedPath: string;
  episodeCount: number;
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
  audio: PublicAudioPublication;
}

export interface PublicShowDetail {
  show: PublicShowHeader;
  seasons: PublicAudioSeason[];
  episodes: PublicShowEpisode[];
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

export function decodePublicShowEpisode(
  value: unknown,
): PublicShowEpisode | null {
  const root = record(value);
  const episodeInput = record(root.episode);
  const audio = decodePublicAudioPublication(root.audio);

  const resourceId = stringValue(episodeInput.resource_id);
  const showResourceId = stringValue(episodeInput.show_resource_id);
  const slug = stringValue(episodeInput.slug);
  const canonicalPath = stringValue(episodeInput.canonical_path);
  const title = stringValue(episodeInput.title);

  if (
    !resourceId ||
    !showResourceId ||
    !slug ||
    !canonicalPath ||
    !title ||
    !audio ||
    audio.publicationKind !== "episode" ||
    !audio.show?.slug ||
    audio.canonicalPath !== canonicalPath ||
    canonicalPath !== showEpisodePath(audio.show.slug, slug)
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
  };
}

export function decodePublicShow(
  value: unknown,
): PublicShowDetail | null {
  if (!value) return null;

  const root = record(value);
  const showInput = record(root.show);
  const resourceId = stringValue(showInput.resource_id);
  const slug = stringValue(showInput.slug);
  const title = stringValue(showInput.title);
  const canonicalPath = stringValue(showInput.canonical_path);
  const feedPath = stringValue(showInput.feed_path);

  const episodes = array(root.episodes)
    .map(decodePublicShowEpisode)
    .filter((episode): episode is PublicShowEpisode => episode !== null)
    .filter((episode) => episode.episode.showResourceId === resourceId);

  if (
    !resourceId ||
    !slug ||
    !title ||
    canonicalPath !== showPath(slug) ||
    feedPath !== showFeedPath(slug) ||
    episodes.length === 0 ||
    numberValue(showInput.episode_count) !== episodes.length
  ) {
    return null;
  }

  const seasons = array(root.seasons)
    .map(decodeSeason)
    .filter((season): season is PublicAudioSeason => season !== null);

  return {
    show: {
      resourceId,
      slug,
      title,
      description: nullableString(showInput.description),
      canonicalPath,
      feedPath,
      episodeCount: episodes.length,
    },
    seasons,
    episodes,
  };
}
