import { buildCultureContext, type CultureContextSurface } from "./index";
import type { PublicRelease, PublicReleaseDetail } from "@/services/publicContent/client";

type ReleaseLike = Partial<PublicRelease> & Partial<PublicReleaseDetail>;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = name.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function namesFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return clean(item);
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          return clean(record.name) || clean(record.title) || clean(record.displayName);
        }
        return "";
      })
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function releaseMetadata(release: ReleaseLike): Record<string, unknown> {
  const metadata = (release as PublicReleaseDetail).metadata;
  return metadata && typeof metadata === "object" ? metadata as Record<string, unknown> : {};
}

function splitArtistRoles(value: unknown): { primary: string[]; featured: string[] } {
  if (!Array.isArray(value)) return { primary: [], featured: [] };

  const artists = value
    .map((item, index) => {
      if (typeof item === "string") {
        return {
          name: clean(item),
          isPrimary: false,
          isFeatured: false,
          creditOrder: index,
        };
      }

      if (!item || typeof item !== "object") return null;

      const record = item as Record<string, unknown>;
      return {
        name: clean(record.name) || clean(record.title) || clean(record.displayName),
        isPrimary: record.isPrimary === true || record.role === "primary" || record.creditRole === "primary",
        isFeatured: record.isFeatured === true || record.role === "featured" || record.creditRole === "featured",
        creditOrder: typeof record.creditOrder === "number"
          ? record.creditOrder
          : typeof record.position === "number"
            ? record.position
            : index,
      };
    })
    .filter((artist): artist is { name: string; isPrimary: boolean; isFeatured: boolean; creditOrder: number } => Boolean(artist?.name))
    .sort((a, b) => a.creditOrder - b.creditOrder);

  const explicitPrimary = artists.filter((artist) => artist.isPrimary).map((artist) => artist.name);
  const fallbackPrimary = artists.filter((artist) => !artist.isFeatured).map((artist) => artist.name);
  const primary = explicitPrimary.length > 0
    ? explicitPrimary
    : fallbackPrimary.length > 0
      ? fallbackPrimary
      : [];

  const primarySet = new Set(primary.map((name) => name.toLowerCase()));
  const featured = artists
    .filter((artist) => artist.isFeatured && !primarySet.has(artist.name.toLowerCase()))
    .map((artist) => artist.name);

  return { primary: uniqueNames(primary), featured: uniqueNames(featured) };
}

function releaseArtistCredits(release: ReleaseLike): { artistNames: string[]; featuredArtistNames: string[] } {
  const metadata = releaseMetadata(release);
  const anyRelease = release as Record<string, unknown>;
  const roleCredits = splitArtistRoles(anyRelease.artists || metadata.artists || metadata.artistCredits);

  const artistNames = uniqueNames([
    ...roleCredits.primary,
    ...namesFromUnknown(anyRelease.artistNames),
    ...namesFromUnknown(anyRelease.primaryArtistNames),
    ...namesFromUnknown(anyRelease.primaryArtists),
    ...namesFromUnknown(metadata.artistNames),
    ...namesFromUnknown(metadata.primaryArtistNames),
    ...namesFromUnknown(metadata.primaryArtists),
    ...namesFromUnknown(release.artist),
  ]);

  const primarySet = new Set(artistNames.map((name) => name.toLowerCase()));
  const featuredArtistNames = uniqueNames([
    ...roleCredits.featured,
    ...namesFromUnknown((release as PublicReleaseDetail).featuredArtists),
    ...namesFromUnknown(anyRelease.featuredArtistNames),
    ...namesFromUnknown(anyRelease.featuredArtists),
    ...namesFromUnknown(metadata.featuredArtistNames),
    ...namesFromUnknown(metadata.featuredArtists),
  ]).filter((name) => !primarySet.has(name.toLowerCase()));

  return { artistNames, featuredArtistNames };
}

function releaseArtistNames(release: ReleaseLike): string[] {
  return releaseArtistCredits(release).artistNames;
}

function releaseFeaturedArtistNames(release: ReleaseLike): string[] {
  return releaseArtistCredits(release).featuredArtistNames;
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
    featuredArtistNames: releaseFeaturedArtistNames(release),
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
