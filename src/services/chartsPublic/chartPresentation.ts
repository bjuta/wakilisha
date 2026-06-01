import type { ChartFamily } from "./types";

export type ChartPresentationOverride = {
  sourceFamilySlug: string;
  seriesSlug: string;
  seriesLabel: string;
  marketSlug: string;
  marketLabel: string;
  publicSlug: string;
  publicLabel: string;
  shortLabel: string;
  description: string;
  chartMode: "data" | "editorial" | "hybrid";
  periodType: "weekly" | "monthly" | "yearly" | "evergreen";
  methodologyVersion: string;
  eligibilityRulesVersion: string;
  legacySlugs: string[];
};

export const CHART_PRESENTATION_OVERRIDES: Record<string, ChartPresentationOverride> = {
  kenya: {
    sourceFamilySlug: "kenya",
    seriesSlug: "top-songs",
    seriesLabel: "Top Songs",
    marketSlug: "kenya",
    marketLabel: "Kenya",
    publicSlug: "top-songs-kenya",
    publicLabel: "Top 100 Songs · Kenya",
    shortLabel: "Kenya Top 100",
    description: "A weekly ranking of the biggest songs in Kenya.",
    chartMode: "data",
    periodType: "weekly",
    methodologyVersion: "csv-registry-import-v1",
    eligibilityRulesVersion: "top-songs-kenya-v1",
    legacySlugs: ["kenya", "top-100-kenya", "kenya-top-100"],
  },
  rnb: {
    sourceFamilySlug: "rnb",
    seriesSlug: "rnb",
    seriesLabel: "R&B Songs",
    marketSlug: "kenya",
    marketLabel: "Kenya",
    publicSlug: "rnb-kenya",
    publicLabel: "R&B Songs · Kenya",
    shortLabel: "Kenyan R&B",
    description: "A weekly ranking of R&B songs performing in Kenya, built to expand into other markets later.",
    chartMode: "data",
    periodType: "weekly",
    methodologyVersion: "csv-registry-import-v1",
    eligibilityRulesVersion: "rnb-kenya-v1",
    legacySlugs: ["rnb", "kenyan-rnb", "top-kenyan-rnb-songs"],
  },
  gengetone: {
    sourceFamilySlug: "gengetone",
    seriesSlug: "gengetone",
    seriesLabel: "Gengetone Songs",
    marketSlug: "kenya",
    marketLabel: "Kenya",
    publicSlug: "gengetone-kenya",
    publicLabel: "Gengetone Songs · Kenya",
    shortLabel: "Gengetone",
    description: "A weekly ranking of Gengetone songs in Kenya.",
    chartMode: "data",
    periodType: "weekly",
    methodologyVersion: "csv-registry-import-v1",
    eligibilityRulesVersion: "gengetone-kenya-v1",
    legacySlugs: ["gengetone", "top-gengetone-songs"],
  },
  "2026": {
    sourceFamilySlug: "2026",
    seriesSlug: "2026-releases",
    seriesLabel: "2026 Releases",
    marketSlug: "kenya",
    marketLabel: "Kenya",
    publicSlug: "2026-releases-kenya",
    publicLabel: "2026 Releases · Kenya",
    shortLabel: "2026 Releases",
    description: "A weekly ranking of songs released in 2026, currently scoped to Kenya and ready to expand into other markets.",
    chartMode: "data",
    periodType: "weekly",
    methodologyVersion: "csv-registry-import-v1",
    eligibilityRulesVersion: "2026-releases-kenya-v1",
    legacySlugs: ["2026", "top-kenyan-songs-released-in-2026"],
  },
};

export function getPresentationBySource(sourceFamilySlug: string): ChartPresentationOverride | null {
  return CHART_PRESENTATION_OVERRIDES[sourceFamilySlug] ?? null;
}

export function resolveSourceFamilySlug(slug: string): string {
  for (const override of Object.values(CHART_PRESENTATION_OVERRIDES)) {
    if (
      slug === override.sourceFamilySlug ||
      slug === override.publicSlug ||
      slug === `${override.seriesSlug}-${override.marketSlug}` ||
      override.legacySlugs.includes(slug)
    ) {
      return override.sourceFamilySlug;
    }
  }
  return slug;
}

export function applyChartFamilyPresentation(family: ChartFamily): ChartFamily {
  const sourceFamilySlug = family.familyKey || family.slug || family.id;
  const override = getPresentationBySource(sourceFamilySlug);
  if (!override) {
    return {
      ...family,
      sourceFamilySlug,
      seriesSlug: family.slug ?? family.familyKey,
      seriesLabel: family.label,
      marketSlug: "unspecified",
      marketLabel: "Unspecified",
      publicSlug: family.slug ?? family.familyKey,
      publicLabel: family.label,
      shortLabel: family.label,
      chartMode: "data",
      periodType: "weekly",
      methodologyVersion: family.defaultScoringModel,
      eligibilityRulesVersion: family.defaultRuleset,
      legacySlugs: [family.slug, family.familyKey, family.id].filter(Boolean) as string[],
    };
  }

  return {
    ...family,
    slug: override.publicSlug,
    label: override.publicLabel,
    description: override.description,
    sourceFamilySlug: override.sourceFamilySlug,
    seriesSlug: override.seriesSlug,
    seriesLabel: override.seriesLabel,
    marketSlug: override.marketSlug,
    marketLabel: override.marketLabel,
    publicSlug: override.publicSlug,
    publicLabel: override.publicLabel,
    shortLabel: override.shortLabel,
    chartMode: override.chartMode,
    periodType: override.periodType,
    methodologyVersion: override.methodologyVersion,
    eligibilityRulesVersion: override.eligibilityRulesVersion,
    legacySlugs: override.legacySlugs,
  };
}

export function getSourceFamilySlugFromPresentedFamily(family: ChartFamily): string {
  return family.sourceFamilySlug || family.familyKey || family.id || family.slug || "";
}
