import { buildCultureContext, type CultureContextSurface } from "./index";
import type { PublicArtist, PublicArtistDetail } from "@/services/publicContent/client";

type ArtistLike = Partial<PublicArtist> & Partial<PublicArtistDetail> & Partial<{
  chartEntryCount: number;
  peakChartPosition: number;
  collaborations: Array<{ name: string; count?: number }>;
  labels: string[];
  labelAffiliations: string[];
  yearsActive: string;
}>;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function topCollaborations(artist: ArtistLike): Array<{ name: string; count?: number }> {
  if (Array.isArray(artist.collaborations)) return artist.collaborations.filter((item) => clean(item.name));
  if (Array.isArray(artist.relatedArtists)) {
    return artist.relatedArtists
      .slice(0, 4)
      .map((item) => ({ name: clean(item.name), count: numberValue(item.sharedTracksAll) }))
      .filter((item) => item.name);
  }
  return [];
}

function labels(artist: ArtistLike): string[] {
  if (Array.isArray(artist.labels)) return artist.labels.map(clean).filter(Boolean);
  if (Array.isArray(artist.labelAffiliations)) return artist.labelAffiliations.map(clean).filter(Boolean);
  if (Array.isArray(artist.releases)) {
    return Array.from(new Set(artist.releases.map((release) => clean(release.labelName)).filter(Boolean)));
  }
  return [];
}

export function artistContextData(artist: ArtistLike) {
  const chartEntryCount = numberValue(artist.chartEntryCount) || (Array.isArray(artist.chartEntries) ? artist.chartEntries.length : undefined);
  const peakChartPosition = numberValue(artist.peakChartPosition) || numberValue(artist.topChartPosition);

  return {
    name: clean(artist.name),
    country: clean(artist.country),
    genres: Array.isArray(artist.genres) ? artist.genres.map(clean).filter(Boolean) : [],
    releaseCount: numberValue(artist.releaseCount) || (Array.isArray(artist.releases) ? artist.releases.length : undefined),
    trackCount: numberValue(artist.trackCount) || (Array.isArray(artist.topSongs) ? artist.topSongs.length : undefined),
    chartEntryCount,
    peakChartPosition,
    collaborations: topCollaborations(artist),
    labels: labels(artist),
    yearsActive: clean(artist.yearsActive),
  };
}

export function buildArtistCultureText(artist: ArtistLike, surface: CultureContextSurface): string {
  return buildCultureContext({
    entityType: "artist",
    surface,
    data: artistContextData(artist),
  }).text;
}

export function buildArtistHeroIntro(artist: ArtistLike): string {
  return buildArtistCultureText(artist, "heroIntro");
}

export function buildArtistCardBlurb(artist: ArtistLike): string {
  return buildArtistCultureText(artist, "cardBlurb");
}

export function buildArtistSearchSnippet(artist: ArtistLike): string {
  return buildArtistCultureText(artist, "searchSnippet");
}

export function buildArtistSeoDescription(artist: ArtistLike): string {
  return buildArtistCultureText(artist, "seoDescription");
}
