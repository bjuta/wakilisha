import type {
  ArtistFacts,
  ChartFacts,
  CultureEntityType,
  CultureFacts,
  GenreFacts,
  LabelFacts,
  ReleaseFacts,
  SearchResultFacts,
  TrackFacts,
} from "./types";
import {
  cleanStringArray,
  cleanText,
  extractMonthName,
  extractYear,
  normalizeCountry,
  normalizeReleaseType,
  numberValue,
} from "./formatters";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function firstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = cleanText(record[key]);
    if (value) return value;
  }
  return "";
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = numberValue(record[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function artistNamesFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const record = asRecord(item);
        return cleanText(record.name) || cleanText(item);
      })
      .filter(Boolean);
  }
  return cleanStringArray(value);
}

function normalizeTrackArtistNames(rawArtists: Record<string, unknown>[]): { primaryArtists: string[]; featuredArtists: string[] } {
  const namedArtists = rawArtists
    .map((artist, index) => ({
      name: cleanText(artist.name),
      isPrimary: artist.isPrimary === true,
      isFeatured: artist.isFeatured === true,
      creditOrder: numberValue(artist.creditOrder) ?? index,
    }))
    .filter((artist) => artist.name)
    .sort((a, b) => a.creditOrder - b.creditOrder);

  const explicitPrimaryArtists = namedArtists
    .filter((artist) => artist.isPrimary)
    .map((artist) => artist.name);

  const fallbackPrimaryArtists = namedArtists
    .filter((artist) => !artist.isFeatured)
    .map((artist) => artist.name);

  const primaryArtists = explicitPrimaryArtists.length > 0
    ? explicitPrimaryArtists
    : fallbackPrimaryArtists.length > 0
      ? fallbackPrimaryArtists
      : namedArtists.slice(0, 1).map((artist) => artist.name);

  const primarySet = new Set(primaryArtists);
  const featuredArtists = namedArtists
    .filter((artist) => artist.isFeatured && !primarySet.has(artist.name))
    .map((artist) => artist.name);

  return { primaryArtists, featuredArtists };
}

export function normalizeTrackFacts(data: unknown): TrackFacts {
  const record = asRecord(data);
  const rawArtists = Array.isArray(record.artists) ? record.artists.map(asRecord) : [];
  const { primaryArtists, featuredArtists } = normalizeTrackArtistNames(rawArtists);

  return {
    title: firstString(record, ["title", "name"]),
    primaryArtists,
    featuredArtists,
    releaseTitle: firstString(record, ["releaseTitle", "albumTitle"]),
    releaseType: normalizeReleaseType(record.releaseType),
    releaseYear: firstString(record, ["releaseYear"]) || extractYear(record.releaseDate),
    releaseMonth: firstString(record, ["releaseMonth"]) || extractMonthName(record.releaseDate),
    releaseDate: firstString(record, ["releaseDate", "date"]),
    trackNumber: firstNumber(record, ["trackNumber"]),
    trackCount: firstNumber(record, ["trackCount"]),
    genres: cleanStringArray(record.genres),
    country: normalizeCountry(record.country || record.originCountry || record.countryCode),
    labelName: firstString(record, ["labelName", "label"]),
    peakRank: firstNumber(record, ["peakRank", "peakChartPosition"]),
    weeksOnChart: firstNumber(record, ["weeksOnChart"]),
    latestRank: firstNumber(record, ["latestRank"]),
    isNewEntry: record.isNewEntry === true,
    isLongRunner: record.isLongRunner === true,
    isRising: record.isRising === true,
    previewAvailable: record.previewAvailable === true,
  };
}

export function normalizeArtistFacts(data: unknown): ArtistFacts {
  const record = asRecord(data);
  return {
    name: firstString(record, ["name", "title"]),
    country: normalizeCountry(record.country || record.originCountry || record.countryCode),
    genres: cleanStringArray(record.genres),
    releaseCount: firstNumber(record, ["releaseCount"]),
    trackCount: firstNumber(record, ["trackCount"]),
    chartEntryCount: firstNumber(record, ["chartEntryCount"]),
    peakChartPosition: firstNumber(record, ["peakChartPosition", "peakRank"]),
    collaborations: Array.isArray(record.collaborations)
      ? record.collaborations.map((item) => {
          const collab = asRecord(item);
          return { name: cleanText(collab.name), count: numberValue(collab.count) };
        }).filter((item) => item.name)
      : [],
    labels: cleanStringArray(record.labels || record.labelAffiliations),
    yearsActive: firstString(record, ["yearsActive"]),
  };
}

export function normalizeReleaseFacts(data: unknown): ReleaseFacts {
  const record = asRecord(data);
  const releaseType = normalizeReleaseType(record.releaseType || record.type);
  const artistNames = artistNamesFromUnknown(record.artistNames || record.artists);
  return {
    title: firstString(record, ["title", "name"]),
    releaseType,
    artistNames,
    releaseYear: firstString(record, ["releaseYear"]) || extractYear(record.releaseDate),
    releaseMonth: firstString(record, ["releaseMonth"]) || extractMonthName(record.releaseDate),
    releaseDate: firstString(record, ["releaseDate", "date"]),
    trackCount: firstNumber(record, ["trackCount"]),
    totalDuration: firstString(record, ["totalDuration", "duration"]),
    labelName: firstString(record, ["labelName", "label"]),
    genres: cleanStringArray(record.genres),
    chartEntryCount: firstNumber(record, ["chartEntryCount"]),
    topChartPeak: firstNumber(record, ["topChartPeak", "peakRank"]),
    hasMultipleArtists: artistNames.length > 1,
    isCompilation: record.isCompilation === true || releaseType === "compilation",
    country: normalizeCountry(record.country || record.countryCode),
    standoutTracks: Array.isArray(record.standoutTracks)
      ? record.standoutTracks.map((item) => {
          const track = asRecord(item);
          return {
            title: firstString(track, ["title", "name"]),
            artistNames: artistNamesFromUnknown(track.artistNames || track.artists),
            peakRank: numberValue(track.peakRank),
          };
        }).filter((item) => item.title)
      : [],
  };
}

export function normalizeLabelFacts(data: unknown): LabelFacts {
  const record = asRecord(data);
  return {
    name: firstString(record, ["name", "title"]),
    country: normalizeCountry(record.country || record.countryCode),
    artistCount: firstNumber(record, ["artistCount"]),
    releaseCount: firstNumber(record, ["releaseCount"]),
    trackCount: firstNumber(record, ["trackCount"]),
    chartEntryCount: firstNumber(record, ["chartEntryCount"]),
    genres: cleanStringArray(record.genres || record.genresRepresented),
    topArtists: cleanStringArray(record.topArtists),
    yearsActive: firstString(record, ["yearsActive"]),
  };
}

export function normalizeGenreFacts(data: unknown): GenreFacts {
  const record = asRecord(data);
  return {
    name: firstString(record, ["name", "title"]),
    artistCount: firstNumber(record, ["artistCount"]),
    trackCount: firstNumber(record, ["trackCount"]),
    releaseCount: firstNumber(record, ["releaseCount"]),
    countries: cleanStringArray(record.countries),
    topArtists: cleanStringArray(record.topArtists),
    topTracks: cleanStringArray(record.topTracks),
  };
}

export function normalizeChartFacts(data: unknown): ChartFacts {
  const record = asRecord(data);
  return {
    title: firstString(record, ["title", "name", "label"]),
    country: normalizeCountry(record.country || record.countryCode),
    periodLabel: firstString(record, ["periodLabel", "weekLabel", "dateLabel"]),
    totalEntries: firstNumber(record, ["totalEntries", "positions"]),
    newEntries: firstNumber(record, ["newEntries"]),
    biggestClimbers: cleanStringArray(record.biggestClimbers),
    longestRunners: cleanStringArray(record.longestRunners),
    numberOne: firstString(record, ["numberOne"]),
    numberOneArtists: cleanStringArray(record.numberOneArtists),
  };
}

export function normalizeSearchResultFacts(data: unknown): SearchResultFacts {
  const record = asRecord(data);
  return {
    title: firstString(record, ["title", "name"]),
    entityType: (firstString(record, ["entityType", "type"]) as CultureEntityType) || "searchResult",
    artists: artistNamesFromUnknown(record.artists || record.artistNames),
    subtitle: firstString(record, ["subtitle", "description"]),
    country: normalizeCountry(record.country || record.countryCode),
    genres: cleanStringArray(record.genres),
    releaseType: normalizeReleaseType(record.releaseType),
    hasChartContext: record.hasChartContext === true,
  };
}

export function normalizeCultureFacts(entityType: CultureEntityType, data: unknown): CultureFacts {
  if (entityType === "track") return normalizeTrackFacts(data);
  if (entityType === "artist") return normalizeArtistFacts(data);
  if (entityType === "release") return normalizeReleaseFacts(data);
  if (entityType === "label") return normalizeLabelFacts(data);
  if (entityType === "genre") return normalizeGenreFacts(data);
  if (entityType === "chart") return normalizeChartFacts(data);
  return normalizeSearchResultFacts(data);
}
