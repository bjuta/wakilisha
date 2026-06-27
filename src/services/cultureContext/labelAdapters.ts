import { buildCultureContext, type CultureContextSurface } from "./index";
import type { PublicLabelDetail } from "@/services/publicApi/client";

type LabelLike = Partial<{
  name: string;
  country: string;
  countryCode: string;
  artistCount: number;
  releaseCount: number;
  trackCount: number;
  chartEntryCount: number;
  genres: string[];
  genresRepresented: string[];
  topArtists: string[];
  yearsActive: string;
}>;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

export function labelContextData(input: LabelLike | PublicLabelDetail) {
  if ("label" in input && input.label) {
    const detail = input as PublicLabelDetail;
    return {
      name: clean(detail.label.name),
      country: clean(detail.label.countryCode),
      artistCount: detail.roster?.length || undefined,
      releaseCount: detail.releases?.length || undefined,
      trackCount: undefined,
      chartEntryCount: undefined,
      genres: [],
      topArtists: Array.isArray(detail.roster) ? detail.roster.slice(0, 4).map((artist) => clean(artist.name)).filter(Boolean) : [],
    };
  }

  const label = input as LabelLike;
  return {
    name: clean(label.name),
    country: clean(label.country) || clean(label.countryCode),
    artistCount: numberValue(label.artistCount),
    releaseCount: numberValue(label.releaseCount),
    trackCount: numberValue(label.trackCount),
    chartEntryCount: numberValue(label.chartEntryCount),
    genres: Array.isArray(label.genres) ? label.genres.map(clean).filter(Boolean) : Array.isArray(label.genresRepresented) ? label.genresRepresented.map(clean).filter(Boolean) : [],
    topArtists: Array.isArray(label.topArtists) ? label.topArtists.map(clean).filter(Boolean) : [],
    yearsActive: clean(label.yearsActive),
  };
}

export function buildLabelCultureText(input: LabelLike | PublicLabelDetail, surface: CultureContextSurface): string {
  return buildCultureContext({
    recordType: "label",
    surface,
    data: labelContextData(input),
  }).text;
}

export function buildLabelHeroIntro(input: LabelLike | PublicLabelDetail): string {
  return buildLabelCultureText(input, "heroIntro");
}

export function buildLabelCardBlurb(input: LabelLike | PublicLabelDetail): string {
  return buildLabelCultureText(input, "cardBlurb");
}

export function buildLabelSearchSnippet(input: LabelLike | PublicLabelDetail): string {
  return buildLabelCultureText(input, "searchSnippet");
}

export function buildLabelSeoDescription(input: LabelLike | PublicLabelDetail): string {
  return buildLabelCultureText(input, "seoDescription");
}
