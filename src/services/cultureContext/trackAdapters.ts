import { buildCultureContext, type CultureContextSurface } from "./index";
import type { PublicTrackDetail } from "@/services/publicApi/types";

type TrackLike = Partial<{
  title: string;
  artist: string;
  artists: Array<{ name?: string; slug?: string; isPrimary?: boolean; isFeatured?: boolean; creditOrder?: number }>;
  genre: string;
  genres: string[];
  label: string;
  labelName: string;
  albumTitle: string;
  releaseTitle: string;
  releaseType: string;
  releaseDate: string;
  releaseYear: string;
  trackNumber: number;
  trackCount: number;
  peakRank: number;
  peakPosition: number;
  weeksOnChart: number;
  latestRank: number;
  currentRank: number;
  isPlayable: boolean;
  previewUrl: string | null;
}>;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function fallbackPrimaryFlag(hasPrimary: boolean, hasNonFeatured: boolean, isPrimary: unknown, isFeatured: unknown, index: number): boolean {
  if (hasPrimary) return isPrimary === true;
  if (hasNonFeatured) return isFeatured !== true;
  return index === 0;
}

function artistRolesFromDetail(track: PublicTrackDetail): Array<{ name: string; slug: string; isPrimary: boolean; isFeatured: boolean; creditOrder: number }> {
  const roles = Array.isArray(track.artists) ? track.artists : [];
  if (roles.length > 0) {
    const sorted = [...roles].sort((a, b) => (a.creditOrder ?? 0) - (b.creditOrder ?? 0));
    const hasPrimary = sorted.some((artist) => artist.isPrimary);
    const hasNonFeatured = sorted.some((artist) => artist.isFeatured !== true);
    return sorted
      .map((artist, index) => ({
        name: clean(artist.name),
        slug: clean(artist.slug),
        isPrimary: fallbackPrimaryFlag(hasPrimary, hasNonFeatured, artist.isPrimary, artist.isFeatured, index),
        isFeatured: artist.isFeatured === true,
        creditOrder: artist.creditOrder ?? index,
      }))
      .filter((artist) => artist.name);
  }

  const fallback = clean(track.artist?.name);
  return fallback ? [{ name: fallback, slug: clean(track.artist?.slug), isPrimary: true, isFeatured: false, creditOrder: 0 }] : [];
}

function artistRolesFromLike(track: TrackLike): Array<{ name: string; isPrimary: boolean; isFeatured: boolean; creditOrder: number }> {
  const roles = Array.isArray(track.artists) ? track.artists : [];
  if (roles.length > 0) {
    const sorted = [...roles].sort((a, b) => (a.creditOrder ?? 0) - (b.creditOrder ?? 0));
    const hasPrimary = sorted.some((artist) => artist.isPrimary);
    const hasNonFeatured = sorted.some((artist) => artist.isFeatured !== true);
    return sorted
      .map((artist, index) => ({
        name: clean(artist.name),
        isPrimary: fallbackPrimaryFlag(hasPrimary, hasNonFeatured, artist.isPrimary, artist.isFeatured, index),
        isFeatured: artist.isFeatured === true,
        creditOrder: artist.creditOrder ?? index,
      }))
      .filter((artist) => artist.name);
  }

  const artist = clean(track.artist);
  return artist ? [{ name: artist, isPrimary: true, isFeatured: false, creditOrder: 0 }] : [];
}

export function trackContextData(track: PublicTrackDetail | TrackLike) {
  if ("track" in track && track.track) {
    return {
      title: clean(track.track.title),
      artists: artistRolesFromDetail(track as PublicTrackDetail),
      releaseTitle: clean(track.release?.title),
      releaseDate: clean(track.release?.releaseDate),
      releaseType: clean(track.release?.releaseType),
      trackNumber: numberValue(track.track.trackNumber),
      trackCount: numberValue(track.release?.trackCount),
      labelName: clean(track.label?.name) || clean(track.release?.labelName),
      genres: Array.isArray(track.genres) ? track.genres.map((genre) => clean(genre.name)).filter(Boolean) : [],
      peakRank: numberValue(track.peakRank),
      weeksOnChart: numberValue(track.weeksOnChart),
      latestRank: numberValue(track.currentRank),
      previewAvailable: Boolean(track.previewUrl || track.track.previewUrl),
    };
  }

  const item = track as TrackLike;
  return {
    title: clean(item.title),
    artists: artistRolesFromLike(item),
    releaseTitle: clean(item.releaseTitle) || clean(item.albumTitle),
    releaseDate: clean(item.releaseDate),
    releaseYear: clean(item.releaseYear),
    releaseType: clean(item.releaseType),
    trackNumber: numberValue(item.trackNumber),
    trackCount: numberValue(item.trackCount),
    labelName: clean(item.labelName) || clean(item.label),
    genres: Array.isArray(item.genres) ? item.genres.map(clean).filter(Boolean) : clean(item.genre) ? [clean(item.genre)] : [],
    peakRank: numberValue(item.peakRank) || numberValue(item.peakPosition),
    weeksOnChart: numberValue(item.weeksOnChart),
    latestRank: numberValue(item.latestRank) || numberValue(item.currentRank),
    previewAvailable: Boolean(item.previewUrl || item.isPlayable),
  };
}

export function buildTrackCultureText(track: PublicTrackDetail | TrackLike, surface: CultureContextSurface): string {
  return buildCultureContext({
    entityType: "track",
    surface,
    data: trackContextData(track),
  }).text;
}

export function buildTrackHeroIntro(track: PublicTrackDetail | TrackLike): string {
  return buildTrackCultureText(track, "heroIntro");
}

export function buildTrackCardBlurb(track: PublicTrackDetail | TrackLike): string {
  return buildTrackCultureText(track, "cardBlurb");
}

export function buildTrackSearchSnippet(track: PublicTrackDetail | TrackLike): string {
  return buildTrackCultureText(track, "searchSnippet");
}

export function buildTrackSeoDescription(track: PublicTrackDetail | TrackLike): string {
  return buildTrackCultureText(track, "seoDescription");
}
