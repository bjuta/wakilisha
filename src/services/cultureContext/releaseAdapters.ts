import { buildCultureContext, type CultureContextSurface } from "./index";
import type { PublicRelease, PublicReleaseDetail } from "@/services/publicContent/client";

type ReleaseLike = Partial<PublicRelease> & Partial<PublicReleaseDetail>;

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

function releaseMonth(release: ReleaseLike): string {
  const date = clean(release.releaseDate);
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    // Try "June 2022" or "2022-06" format
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    for (const m of monthNames) {
      if (date.toLowerCase().includes(m.toLowerCase())) return m;
    }
    const dashMatch = date.match(/^\d{4}-(\d{2})/);
    if (dashMatch) {
      const idx = parseInt(dashMatch[1], 10) - 1;
      if (idx >= 0 && idx < 12) return monthNames[idx];
    }
    return "";
  }
  return parsed.toLocaleDateString("en-US", { month: "long" });
}

function releaseGenres(release: ReleaseLike): string[] {
  const metadata = (release as PublicReleaseDetail).metadata;
  if (!metadata || typeof metadata !== "object") return [];
  const genres = (metadata as Record<string, unknown>).genres;
  if (Array.isArray(genres)) return genres.map((g) => String(g).trim()).filter(Boolean);
  if (typeof genres === "string") return genres.split(",").map((g) => g.trim()).filter(Boolean);
  return [];
}

function releaseCountry(release: ReleaseLike): string {
  const metadata = (release as PublicReleaseDetail).metadata;
  if (!metadata || typeof metadata !== "object") return "";
  const country = (metadata as Record<string, unknown>).country;
  if (typeof country === "string") return country.trim();
  return "";
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
    releaseMonth: releaseMonth(release),
    releaseDate: clean(release.releaseDate),
    trackCount: typeof release.trackCount === "number" ? release.trackCount : undefined,
    labelName: clean(release.labelName),
    genres: releaseGenres(release),
    country: releaseCountry(release),
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
    action: "Browse releases",
  };
}
