import {
  decodePublicAudioPublication,
  type PublicAudioPublication,
  type PublicAudioSeason,
} from "./audioPublicModel";

type UnknownRecord = Record<string, unknown>;

export interface PublicAudioShowHeader {
  id: string;
  resourceId: string;
  slug: string;
  title: string;
  description: string | null;
  canonicalPath: string;
  feedPath: string;
  episodeCount: number;
}

export interface PublicAudioShowDetail {
  show: PublicAudioShowHeader;
  seasons: PublicAudioSeason[];
  episodes: PublicAudioPublication[];
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

export function decodePublicAudioShow(
  value: unknown,
): PublicAudioShowDetail | null {
  if (!value) return null;

  const root = record(value);
  const showInput = record(root.show);
  const id = stringValue(showInput.id);
  const resourceId = stringValue(showInput.resource_id);
  const slug = stringValue(showInput.slug);
  const title = stringValue(showInput.title);
  const canonicalPath = stringValue(showInput.canonical_path);
  const feedPath = stringValue(showInput.feed_path);

  const episodes = array(root.episodes)
    .map(decodePublicAudioPublication)
    .filter(
      (episode): episode is PublicAudioPublication =>
        episode !== null &&
        episode.publicationKind === "episode" &&
        episode.show?.id === id &&
        episode.show.slug === slug &&
        episode.canonicalPath === `/shows/${slug}/${episode.slug}`,
    );

  if (
    !id ||
    !resourceId ||
    !slug ||
    !title ||
    canonicalPath !== `/shows/${slug}` ||
    feedPath !== `/shows/${slug}/feed.xml` ||
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
      id,
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
