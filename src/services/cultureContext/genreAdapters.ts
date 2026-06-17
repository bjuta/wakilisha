import { buildCultureContext, type CultureContextSurface } from "./index";
import type { RepairedGenreDetail } from "@/services/repaired/client";

type GenreLike = Partial<{
  name: string;
  artistCount: number;
  trackCount: number;
  releaseCount: number;
  countries: string[];
  topArtists: string[];
  representativeArtists: string[];
  topTracks: string[];
}>;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

export function genreContextData(input: GenreLike | RepairedGenreDetail) {
  if ("genre" in input && input.genre) {
    const detail = input as RepairedGenreDetail;
    return {
      name: clean(detail.genre.name),
      artistCount: detail.artists?.length || undefined,
      trackCount: detail.topTracks?.length || undefined,
      releaseCount: detail.releases?.length || undefined,
      countries: [],
      topArtists: Array.isArray(detail.artists) ? detail.artists.slice(0, 4).map((artist) => clean(artist.name)).filter(Boolean) : [],
      topTracks: Array.isArray(detail.topTracks) ? detail.topTracks.slice(0, 4).map((track) => clean(track.title)).filter(Boolean) : [],
    };
  }

  const genre = input as GenreLike;
  return {
    name: clean(genre.name),
    artistCount: numberValue(genre.artistCount),
    trackCount: numberValue(genre.trackCount),
    releaseCount: numberValue(genre.releaseCount),
    countries: Array.isArray(genre.countries) ? genre.countries.map(clean).filter(Boolean) : [],
    topArtists: Array.isArray(genre.topArtists)
      ? genre.topArtists.map(clean).filter(Boolean)
      : Array.isArray(genre.representativeArtists)
        ? genre.representativeArtists.map(clean).filter(Boolean)
        : [],
    topTracks: Array.isArray(genre.topTracks) ? genre.topTracks.map(clean).filter(Boolean) : [],
  };
}

export function buildGenreCultureText(input: GenreLike | RepairedGenreDetail, surface: CultureContextSurface): string {
  return buildCultureContext({
    entityType: "genre",
    surface,
    data: genreContextData(input),
  }).text;
}

export function buildGenreHeroIntro(input: GenreLike | RepairedGenreDetail): string {
  return buildGenreCultureText(input, "heroIntro");
}

export function buildGenreCardBlurb(input: GenreLike | RepairedGenreDetail): string {
  return buildGenreCultureText(input, "cardBlurb");
}

export function buildGenreSearchSnippet(input: GenreLike | RepairedGenreDetail): string {
  return buildGenreCultureText(input, "searchSnippet");
}

export function buildGenreSeoDescription(input: GenreLike | RepairedGenreDetail): string {
  return buildGenreCultureText(input, "seoDescription");
}
