import type { ChartEdition, ChartEditionEntry, ChartFamily, TrackChartHistory } from "./types";

export type CsvPublicChartData = {
  generatedAt: string | null;
  sourceFiles: string[];
  families: ChartFamily[];
  editions: ChartEdition[];
  entries: ChartEditionEntry[];
};

// This file is overwritten by `npm run charts:generate-public-csv-data` when
// actual CSV exports are available in data/supabase-imports/2026-05-30/raw.
export const CSV_PUBLIC_CHART_DATA: CsvPublicChartData = {
  generatedAt: null,
  sourceFiles: [],
  families: [],
  editions: [],
  entries: [],
};

export function hasCsvPublicChartData() {
  return (
    CSV_PUBLIC_CHART_DATA.families.length > 0 &&
    CSV_PUBLIC_CHART_DATA.editions.length > 0 &&
    CSV_PUBLIC_CHART_DATA.entries.length > 0
  );
}

export function getCsvFamily(familySlug: string): ChartFamily | null {
  return (
    CSV_PUBLIC_CHART_DATA.families.find(
      (family) => family.slug === familySlug || family.familyKey === familySlug || family.id === familySlug
    ) ?? null
  );
}

export function getCsvEditionsForFamily(familySlug: string): ChartEdition[] {
  const family = getCsvFamily(familySlug);
  if (!family) return [];
  return CSV_PUBLIC_CHART_DATA.editions
    .filter((edition) => edition.familyId === family.id)
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.label.localeCompare(a.label));
}

export function getCsvLatestEdition(familySlug: string): ChartEdition | null {
  return getCsvEditionsForFamily(familySlug)[0] ?? null;
}

export function getCsvEdition(familySlug: string, editionSlug: string): ChartEdition | null {
  const family = getCsvFamily(familySlug);
  if (!family) return null;
  return (
    CSV_PUBLIC_CHART_DATA.editions.find(
      (edition) => edition.familyId === family.id && (edition.slug === editionSlug || edition.id === editionSlug)
    ) ?? null
  );
}

export function getCsvEntriesForEdition(familySlug: string, editionSlug: string): ChartEditionEntry[] {
  const edition = getCsvEdition(familySlug, editionSlug);
  if (!edition) return [];
  return CSV_PUBLIC_CHART_DATA.entries
    .filter((entry) => entry.editionId === edition.id)
    .slice()
    .sort((a, b) => a.rank - b.rank);
}

export function getCsvTrackHistory(trackSlug: string): TrackChartHistory | null {
  const appearances = CSV_PUBLIC_CHART_DATA.entries
    .filter((entry) => entry.trackSlug === trackSlug)
    .sort((a, b) => {
      const editionA = CSV_PUBLIC_CHART_DATA.editions.find((edition) => edition.id === a.editionId);
      const editionB = CSV_PUBLIC_CHART_DATA.editions.find((edition) => edition.id === b.editionId);
      return new Date(editionB?.date ?? 0).getTime() - new Date(editionA?.date ?? 0).getTime();
    });

  if (!appearances.length) return null;

  const first = appearances[appearances.length - 1];
  const latest = appearances[0];
  const firstEdition = CSV_PUBLIC_CHART_DATA.editions.find((edition) => edition.id === first.editionId);
  const latestEdition = CSV_PUBLIC_CHART_DATA.editions.find((edition) => edition.id === latest.editionId);

  return {
    trackSlug,
    trackTitle: latest.trackTitle,
    artistNames: latest.artistNames,
    appearances: appearances.map((entry) => {
      const edition = CSV_PUBLIC_CHART_DATA.editions.find((item) => item.id === entry.editionId);
      return {
        editionSlug: edition?.slug ?? entry.editionId,
        editionLabel: edition?.label ?? entry.editionId,
        rank: entry.rank,
        weeksOnChart: entry.weeksOnChart ?? 0,
        movement: entry.movement,
      };
    }),
    peakPosition: Math.min(...appearances.map((entry) => entry.rank)),
    totalWeeksOnChart: Math.max(...appearances.map((entry) => entry.weeksOnChart ?? 0)),
    firstAppearance: firstEdition?.date ?? null,
    latestAppearance: latestEdition?.date ?? null,
  };
}
