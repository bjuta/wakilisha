/**
 * Compatibility wrapper for the Culture Context Engine.
 *
 * This file keeps the old exported function names alive while the app migrates
 * to src/services/cultureContext directly. The old prose builders have been
 * replaced by adapters that normalize legacy relationship data and delegate to
 * Culture Context Engine recipes.
 */

import { buildCultureContext } from "./cultureContext";

export type TrackArtistRole = {
  name: string;
  slug: string;
  isPrimary: boolean;
  isFeatured: boolean;
  creditOrder: number;
};

export type TrackReleaseContext = {
  title: string;
  slug: string;
  releaseDate: string;
  releaseType: string;
  trackCount: number;
  trackNumber: number;
  discNumber: number;
  labelName: string;
  labelSlug: string;
};

export type TrackChartContext = {
  peakRank: number;
  weeksOnChart: number;
  firstChartedDate: string;
  latestRank: number;
  appearances: number;
  editionLabels: string[];
};

export type TrackRelationshipData = {
  title: string;
  artists: TrackArtistRole[];
  release: TrackReleaseContext | null;
  genres: string[];
  isrc: string | null;
  durationMs: number;
  explicit: boolean;
  chartContext: TrackChartContext | null;
  previewAvailable: boolean;
  sourceProviders: string[];
};

export type ArtistRelationshipData = {
  name: string;
  genres: string[];
  originCountry: string;
  releaseCount: number;
  trackCount: number;
  chartEntryCount: number;
  peakChartPosition: number | null;
  topChartEditions: string[];
  collaborations: Array<{ name: string; count: number }>;
  labelAffiliations: string[];
  yearsActive: string;
};

export type ReleaseRelationshipData = {
  title: string;
  artistNames: string[];
  releaseType: string;
  releaseDate: string;
  trackCount: number;
  totalDurationMs: number;
  labelName: string;
  genres: string[];
  chartEntryCount: number;
  isCompilation: boolean;
};

export type LabelRelationshipData = {
  name: string;
  countryCode: string;
  artistCount: number;
  releaseCount: number;
  trackCount: number;
  chartEntryCount: number;
  genresRepresented: string[];
  topArtists: string[];
  yearsActive: string;
};

function formatDuration(ms: number): string | undefined {
  if (!ms || ms <= 0) return undefined;
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function orderedArtists(artists: TrackArtistRole[]): TrackArtistRole[] {
  return [...artists].sort((a, b) => (a.creditOrder ?? 0) - (b.creditOrder ?? 0));
}

/**
 * Legacy API. Prefer buildCultureContext({ entityType: "track", ... }).
 */
export function buildTrackSummary(data: TrackRelationshipData): string {
  const sortedArtists = orderedArtists(data.artists || []);
  const primaryArtists = sortedArtists.filter((artist) => artist.isPrimary);
  const artistsForEngine = (primaryArtists.length > 0 ? sortedArtists : sortedArtists.map((artist, index) => ({
    ...artist,
    isPrimary: index === 0,
  }))).map((artist) => ({
    name: artist.name,
    slug: artist.slug,
    isPrimary: artist.isPrimary,
    isFeatured: artist.isFeatured,
    creditOrder: artist.creditOrder,
  }));

  return buildCultureContext({
    entityType: "track",
    surface: "heroIntro",
    data: {
      title: data.title,
      artists: artistsForEngine,
      releaseTitle: data.release?.title,
      releaseDate: data.release?.releaseDate,
      releaseType: data.release?.releaseType,
      trackCount: data.release?.trackCount,
      trackNumber: data.release?.trackNumber,
      labelName: data.release?.labelName,
      genres: data.genres,
      peakRank: data.chartContext?.peakRank,
      weeksOnChart: data.chartContext?.weeksOnChart,
      latestRank: data.chartContext?.latestRank,
      previewAvailable: data.previewAvailable,
    },
  }).text;
}

/**
 * Legacy API. Prefer buildCultureContext({ entityType: "artist", ... }).
 */
export function buildArtistSummary(data: ArtistRelationshipData): string {
  return buildCultureContext({
    entityType: "artist",
    surface: "heroIntro",
    data: {
      name: data.name,
      genres: data.genres,
      originCountry: data.originCountry,
      releaseCount: data.releaseCount,
      trackCount: data.trackCount,
      chartEntryCount: data.chartEntryCount,
      peakChartPosition: data.peakChartPosition ?? undefined,
      collaborations: data.collaborations,
      labelAffiliations: data.labelAffiliations,
      yearsActive: data.yearsActive,
    },
  }).text;
}

/**
 * Legacy API. Prefer buildCultureContext({ entityType: "release", ... }).
 */
export function buildReleaseSummary(data: ReleaseRelationshipData): string {
  return buildCultureContext({
    entityType: "release",
    surface: "heroIntro",
    data: {
      title: data.title,
      artistNames: data.artistNames,
      releaseType: data.releaseType,
      releaseDate: data.releaseDate,
      trackCount: data.trackCount,
      totalDuration: formatDuration(data.totalDurationMs),
      labelName: data.labelName,
      genres: data.genres,
      chartEntryCount: data.chartEntryCount,
      isCompilation: data.isCompilation,
    },
  }).text;
}

/**
 * Legacy API. Prefer buildCultureContext({ entityType: "label", ... }).
 */
export function buildLabelSummary(data: LabelRelationshipData): string {
  return buildCultureContext({
    entityType: "label",
    surface: "heroIntro",
    data: {
      name: data.name,
      countryCode: data.countryCode,
      artistCount: data.artistCount,
      releaseCount: data.releaseCount,
      trackCount: data.trackCount,
      chartEntryCount: data.chartEntryCount,
      genresRepresented: data.genresRepresented,
      topArtists: data.topArtists,
      yearsActive: data.yearsActive,
    },
  }).text;
}

export function buildTrackSummaryFromApi(
  track: {
    title: string;
    durationMs: number;
    isrc: string | null;
    explicit: boolean;
    trackNumber: number;
    previewUrl?: string | null;
  },
  artists: Array<{ name: string; slug: string; isPrimary?: boolean; isFeatured?: boolean; creditOrder?: number }>,
  release: {
    title: string;
    slug: string;
    releaseDate: string;
    releaseType: string;
    trackCount?: number;
    labelName?: string;
    labelSlug?: string;
  } | null,
  genres: string[],
  chartContext: {
    peakRank: number;
    weeksOnChart: number;
    firstChartedDate?: string;
    latestRank?: number;
    appearances: number;
    editionLabels?: string[];
  } | null,
  sourceProviders: string[] = [],
): string {
  void sourceProviders;

  return buildTrackSummary({
    title: track.title,
    artists: artists.map((artist, index) => ({
      name: artist.name,
      slug: artist.slug,
      isPrimary: artist.isPrimary ?? index === 0,
      isFeatured: artist.isFeatured ?? false,
      creditOrder: artist.creditOrder ?? index,
    })),
    release: release
      ? {
          title: release.title,
          slug: release.slug,
          releaseDate: release.releaseDate,
          releaseType: release.releaseType,
          trackCount: release.trackCount ?? 0,
          trackNumber: track.trackNumber,
          discNumber: 1,
          labelName: release.labelName ?? "",
          labelSlug: release.labelSlug ?? "",
        }
      : null,
    genres,
    isrc: track.isrc,
    durationMs: track.durationMs,
    explicit: track.explicit,
    chartContext: chartContext
      ? {
          peakRank: chartContext.peakRank,
          weeksOnChart: chartContext.weeksOnChart,
          firstChartedDate: chartContext.firstChartedDate ?? "",
          latestRank: chartContext.latestRank ?? 0,
          appearances: chartContext.appearances,
          editionLabels: chartContext.editionLabels ?? [],
        }
      : null,
    previewAvailable: !!track.previewUrl,
    sourceProviders,
  });
}
