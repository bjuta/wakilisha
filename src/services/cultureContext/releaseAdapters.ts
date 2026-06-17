import { buildCultureContext, type CultureContextSurface } from "./index";
import type { RepairedRelease, RepairedReleaseDetail } from "@/services/repairedContent/client";

type ReleaseLike = Partial<RepairedRelease> & Partial<RepairedReleaseDetail>;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function releaseArtistNames(release: ReleaseLike): string[] {
  const artist = clean(release.artist);
  return artist ? [artist] : [];
}

function releaseYear(release: ReleaseLike): string {
  const year = clean(release.year);
  if (year && year !== "Unknown year") return year;
  const releaseDate = clean(release.releaseDate);
  return releaseDate.match(/\d{4}/)?.[0] || "";
}

function releaseStandoutTracks(release: ReleaseLike): Array<{ title: string; artistNames: string[]; peakRank?: number }> {
  if (!Array.isArray(release.tracks)) return [];
  return release.tracks
    .slice(0, 3)
    .map((track) => ({
      title: clean(track.title),
      artistNames: clean(track.artist) ? [clean(track.artist)] : releaseArtistNames(release),
    }))
    .filter((track) => track.title);
}

export function releaseContextData(release: ReleaseLike) {
  const chartStats = release.chartStats;
  return {
    title: clean(release.title),
    releaseType: clean(release.releaseType),
    artistNames: releaseArtistNames(release),
    releaseYear: releaseYear(release),
    releaseDate: clean(release.releaseDate),
    trackCount: typeof release.trackCount === "number" ? release.trackCount : undefined,
    labelName: clean(release.labelName),
    chartEntryCount: chartStats?.totalChartAppearances,
    topChartPeak: chartStats?.topPeakPosition ?? undefined,
    standoutTracks: releaseStandoutTracks(release),
  };
}

export function buildReleaseCultureText(
  release: ReleaseLike,
  surface: CultureContextSurface,
): string {
  return buildCultureContext({
    entityType: "release",
    surface,
    data: releaseContextData(release),
  }).text;
}

export function buildReleaseHeroIntro(release: ReleaseLike): string {
  return buildReleaseCultureText(release, "heroIntro");
}

export function buildReleaseCardBlurb(release: ReleaseLike): string {
  return buildReleaseCultureText(release, "cardBlurb");
}

export function buildReleaseSearchSnippet(release: ReleaseLike): string {
  return buildReleaseCultureText(release, "searchSnippet");
}

export function buildReleaseSeoDescription(release: ReleaseLike): string {
  return buildReleaseCultureText(release, "seoDescription");
}

export function buildReleaseStartHere(release: ReleaseLike): string {
  return buildReleaseCultureText(release, "startHere");
}

export function releaseEmptyStateCopy(hasFilters = false): { title: string; body: string; action: string } {
  if (hasFilters) {
    return {
      title: "Nothing on this shelf yet.",
      body: "Try another artist, year, or release type. The shelf is big, but spellings can be dramatic.",
      action: "Clear all filters",
    };
  }

  return {
    title: "The release shelf is still filling up.",
    body: "Albums, EPs, singles, mixtapes, and more will show up here as WAKILISHA connects them.",
    action: "Browse artists",
  };
}
