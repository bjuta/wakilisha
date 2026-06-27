import { buildCultureContext } from "./index";
import { humanList, pluralize } from "./formatters";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

export type SearchArtistLike = Partial<{
  name: string;
  country: string;
  genres: string[];
  trackCount: number;
  releaseCount: number;
  chartEntryCount: number;
  topChartPosition: number | null;
}>;

export type SearchGenreLike = Partial<{
  name: string;
  artistCount: number;
  trackCount: number;
  releaseCount: number;
  representativeArtists: string[];
  topArtists: string[];
  topTracks: string[];
  countries: string[];
}>;

export type SearchLabelLike = Partial<{
  name: string;
  country: string;
  artistCount: number;
  releaseCount: number;
  trackCount: number;
  chartEntryCount: number;
  genres: string[];
  topArtists: string[];
}>;

export type SearchChartEntryLike = Partial<{
  title: string;
  artist: string;
  rank: number;
  movement: string;
  movementAmount: number;
}>;

export function buildGenreSearchSnippet(genre: SearchGenreLike): string {
  return buildCultureContext({
    recordType: "genre",
    surface: "searchSnippet",
    data: {
      name: clean(genre.name),
      artistCount: numberValue(genre.artistCount),
      trackCount: numberValue(genre.trackCount),
      releaseCount: numberValue(genre.releaseCount),
      topArtists: Array.isArray(genre.topArtists)
        ? genre.topArtists
        : Array.isArray(genre.representativeArtists)
          ? genre.representativeArtists
          : [],
      topTracks: Array.isArray(genre.topTracks) ? genre.topTracks : [],
      countries: Array.isArray(genre.countries) ? genre.countries : [],
    },
  }).text;
}

export function buildLabelSearchSnippet(label: SearchLabelLike): string {
  return buildCultureContext({
    recordType: "label",
    surface: "searchSnippet",
    data: {
      name: clean(label.name),
      country: clean(label.country),
      artistCount: numberValue(label.artistCount),
      releaseCount: numberValue(label.releaseCount),
      trackCount: numberValue(label.trackCount),
      chartEntryCount: numberValue(label.chartEntryCount),
      genres: Array.isArray(label.genres) ? label.genres : [],
      topArtists: Array.isArray(label.topArtists) ? label.topArtists : [],
    },
  }).text;
}

export function buildChartEntrySearchSnippet(entry: SearchChartEntryLike): string {
  const title = clean(entry.title) || "This song";
  const artist = clean(entry.artist);
  const rank = numberValue(entry.rank);
  const movement = clean(entry.movement);
  const movementAmount = numberValue(entry.movementAmount);
  const artistPhrase = artist ? ` by ${artist}` : "";

  if (movement === "new" && rank) {
    return `${title}${artistPhrase} is new on the latest WAKILISHA chart at #${rank}.`;
  }

  if (movement === "up" && rank) {
    const move = movementAmount ? ` after climbing ${pluralize(movementAmount, "place")}` : " after climbing";
    return `${title}${artistPhrase} is at #${rank}${move} on the latest WAKILISHA chart.`;
  }

  if (movement === "down" && rank) {
    const move = movementAmount ? ` after slipping ${pluralize(movementAmount, "place")}` : " after slipping";
    return `${title}${artistPhrase} is at #${rank}${move} on the latest WAKILISHA chart.`;
  }

  if (rank) {
    return `${title}${artistPhrase} is holding at #${rank} on the latest WAKILISHA chart.`;
  }

  return buildCultureContext({
    recordType: "searchResult",
    surface: "searchSnippet",
    data: {
      title,
      recordType: "track",
      artists: artist ? [artist] : [],
      hasChartContext: true,
    },
  }).text;
}

export function buildGenericSearchSnippet(input: {
  title: string;
  recordType: "track" | "artist" | "release" | "label" | "genre" | "chart" | "searchResult";
  artists?: string[];
  subtitle?: string;
  country?: string;
  genres?: string[];
  releaseType?: string;
  hasChartContext?: boolean;
}): string {
  const text = buildCultureContext({
    recordType: "searchResult",
    surface: "searchSnippet",
    data: {
      title: clean(input.title),
      entityType: input.entityType,
      artists: input.artists || [],
      subtitle: clean(input.subtitle),
      country: clean(input.country),
      genres: input.genres || [],
      releaseType: input.releaseType,
      hasChartContext: input.hasChartContext === true,
    },
  }).text;

  const fallbackBits = humanList([clean(input.subtitle), clean(input.country)].filter(Boolean), 2);
  return text || fallbackBits || `${input.title} on WAKILISHA.`;
}
