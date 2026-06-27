import { buildCultureContext, type CultureContextSurface } from "./index";
import type { PublicArtist, PublicArtistDetail } from "@/services/publicContent/client";

type LooseRecord = Record<string, unknown>;

type ArtistLike = Partial<PublicArtist> & Partial<PublicArtistDetail> & Partial<{
  chartEntryCount: number;
  peakChartPosition: number;
  collaborations: Array<{ name: string; count?: number }>;
  labels: string[];
  labelAffiliations: string[];
  yearsActive: string;
  topTracks: Array<string | LooseRecord>;
  tracks: Array<string | LooseRecord>;
}>;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function titleFromUnknown(value: unknown): string {
  if (typeof value === "string") return clean(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";

  const record = value as LooseRecord;
  for (const key of ["title", "name", "display_title", "trackTitle", "releaseTitle", "normalized_title"]) {
    const candidate = clean(record[key]);
    if (candidate) return candidate;
  }

  return "";
}

function uniqueTitles(values: unknown[], limit = 6): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    const title = titleFromUnknown(value);
    const key = title.toLowerCase();
    if (!title || seen.has(key)) continue;
    seen.add(key);
    out.push(title);
    if (out.length >= limit) break;
  }

  return out;
}

function topTrackTitles(artist: ArtistLike): string[] {
  const topTracks = (artist as { topTracks?: unknown[] }).topTracks;
  if (Array.isArray(topTracks)) return uniqueTitles(topTracks, 8);

  const topSongs = (artist as { topSongs?: unknown[] }).topSongs;
  if (Array.isArray(topSongs)) return uniqueTitles(topSongs, 8);

  const tracks = (artist as { tracks?: unknown[] }).tracks;
  if (Array.isArray(tracks)) return uniqueTitles(tracks, 8);

  return [];
}

function topReleaseTitles(artist: ArtistLike): string[] {
  const releases = (artist as { releases?: unknown[] }).releases;
  if (Array.isArray(releases)) return uniqueTitles(releases, 6);

  return [];
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
  const topTracks = topTrackTitles(artist);
  const topReleases = topReleaseTitles(artist);
  const chartEntryCount = numberValue(artist.chartEntryCount) || (Array.isArray(artist.chartEntries) ? artist.chartEntries.length : undefined);
  const peakChartPosition = numberValue(artist.peakChartPosition) || numberValue(artist.topChartPosition);

  return {
    name: clean(artist.name),
    country: clean(artist.country),
    genres: Array.isArray(artist.genres) ? artist.genres.map(clean).filter(Boolean) : [],
    releaseCount: numberValue(artist.releaseCount) || (Array.isArray(artist.releases) ? artist.releases.length : topReleases.length || undefined),
    trackCount: numberValue(artist.trackCount) || topTracks.length || undefined,
    chartEntryCount,
    peakChartPosition,
    collaborations: topCollaborations(artist),
    labels: labels(artist),
    yearsActive: clean(artist.yearsActive),
    topTracks,
    topReleases,
  };
}

export function buildArtistCultureText(artist: ArtistLike, surface: CultureContextSurface): string {
  return buildCultureContext({
    recordType: "artist",
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
