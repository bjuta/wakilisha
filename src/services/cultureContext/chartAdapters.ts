import { buildCultureContext, type CultureContextSurface } from "./index";
import type { ChartEditionViewModel, ChartEntryRowViewModel } from "@/services/chartsPublic/viewModels";

type ChartLike = Partial<{
  title: string;
  label: string;
  country: string;
  countryCode: string;
  periodLabel: string;
  weekLabel: string;
  dateLabel: string;
  totalEntries: number;
  newEntries: number;
  biggestClimbers: string[];
  longestRunners: string[];
  numberOne: string;
  numberOneArtists: string[];
}>;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function entryName(entry: ChartEntryRowViewModel | undefined): string {
  if (!entry) return "";
  return clean(entry.title);
}

function climbers(entries: ChartEntryRowViewModel[]): string[] {
  return entries
    .filter((entry) => entry.movement === "up")
    .sort((a, b) => (b.movementAmount || 0) - (a.movementAmount || 0))
    .slice(0, 3)
    .map((entry) => entryName(entry))
    .filter(Boolean);
}

function runners(entries: ChartEntryRowViewModel[]): string[] {
  return entries
    .filter((entry) => entry.weeksOnChart > 0)
    .sort((a, b) => b.weeksOnChart - a.weeksOnChart)
    .slice(0, 3)
    .map((entry) => entryName(entry))
    .filter(Boolean);
}

export function chartContextData(input: ChartLike | { edition: ChartEditionViewModel; entries: ChartEntryRowViewModel[] }) {
  if ("edition" in input && input.edition) {
    const topEntry = input.entries?.[0];
    return {
      title: clean(input.edition.publicLabel) || clean(input.edition.label) || clean(input.edition.familyLabel),
      country: clean(input.edition.marketLabel),
      periodLabel: clean(input.edition.label) || clean(input.edition.date),
      totalEntries: numberValue(input.edition.totalEntries) || input.entries?.length || undefined,
      newEntries: numberValue(input.edition.newEntries),
      biggestClimbers: climbers(input.entries || []),
      longestRunners: runners(input.entries || []),
      numberOne: entryName(topEntry),
      numberOneArtists: topEntry?.artistNames?.length ? topEntry.artistNames : topEntry?.artist ? [topEntry.artist] : [],
    };
  }

  const chart = input as ChartLike;
  return {
    title: clean(chart.title) || clean(chart.label),
    country: clean(chart.country) || clean(chart.countryCode),
    periodLabel: clean(chart.periodLabel) || clean(chart.weekLabel) || clean(chart.dateLabel),
    totalEntries: numberValue(chart.totalEntries),
    newEntries: numberValue(chart.newEntries),
    biggestClimbers: Array.isArray(chart.biggestClimbers) ? chart.biggestClimbers.map(clean).filter(Boolean) : [],
    longestRunners: Array.isArray(chart.longestRunners) ? chart.longestRunners.map(clean).filter(Boolean) : [],
    numberOne: clean(chart.numberOne),
    numberOneArtists: Array.isArray(chart.numberOneArtists) ? chart.numberOneArtists.map(clean).filter(Boolean) : [],
  };
}

export function buildChartCultureText(input: ChartLike | { edition: ChartEditionViewModel; entries: ChartEntryRowViewModel[] }, surface: CultureContextSurface): string {
  return buildCultureContext({
    entityType: "chart",
    surface,
    data: chartContextData(input),
  }).text;
}

export function buildChartHeroIntro(input: ChartLike | { edition: ChartEditionViewModel; entries: ChartEntryRowViewModel[] }): string {
  return buildChartCultureText(input, "heroIntro");
}

export function buildChartCardBlurb(input: ChartLike | { edition: ChartEditionViewModel; entries: ChartEntryRowViewModel[] }): string {
  return buildChartCultureText(input, "cardBlurb");
}

export function buildChartSearchSnippet(input: ChartLike | { edition: ChartEditionViewModel; entries: ChartEntryRowViewModel[] }): string {
  return buildChartCultureText(input, "searchSnippet");
}

export function buildChartSeoDescription(input: ChartLike | { edition: ChartEditionViewModel; entries: ChartEntryRowViewModel[] }): string {
  return buildChartCultureText(input, "seoDescription");
}
