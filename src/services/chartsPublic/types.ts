/**
 * Public Charts API Types
 * Types for the public-facing chart consumer interface.
 * Separate from the admin ingestion types.
 */

export interface ChartFamily {
  id: string;
  familyKey: string;
  label: string;
  description: string;
  defaultChartSize: number;
  defaultRegion: string;
  editionFrequency: "weekly" | "monthly" | "daily";
  defaultRuleset: string;
  defaultScoringModel: string;
  createdAt: string;
  updatedAt: string;
  slug?: string;
  sourceFamilySlug?: string;
  seriesSlug?: string;
  seriesLabel?: string;
  marketSlug?: string;
  marketLabel?: string;
  publicSlug?: string;
  publicLabel?: string;
  shortLabel?: string;
  chartMode?: "data" | "editorial" | "hybrid";
  periodType?: "weekly" | "monthly" | "yearly" | "evergreen";
  methodologyVersion?: string;
  eligibilityRulesVersion?: string;
  legacySlugs?: string[];
}

export interface ChartEdition {
  id: string;
  familyId: string;
  slug: string;
  label: string;
  date: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "published";
  ingestJobId: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  entryCount: number;
  newEntries: number;
  reEntries: number;
}

export interface ChartEditionEntry {
  id: string;
  editionId: string;
  rank: number;
  previousRank: number | null;
  movement: "up" | "down" | "same" | "new" | "re_entry";
  peakPosition: number | null;
  weeksOnChart: number | null;
  trackSlug: string;
  trackTitle: string;
  artistSlugs: string[];
  artistNames: string[];
  artworkUrl: string | null;
  score: number;
  entryPayload: Record<string, unknown>;
  // Optional fields for richer mock data and view models
  genre?: string;
  source?: string;
  isPlayable?: boolean;
  duration?: number;
  movementAmount?: number;
  previewUrl?: string;
  appleMusicId?: string | null;
  appleMusicCatalogId?: string | null;
}

export interface ChartEntry {
  rank: number;
  previousRank: number | null;
  movement: "up" | "down" | "same" | "new" | "re_entry";
  peakPosition: number;
  weeksOnChart: number;
  track: {
    slug: string;
    title: string;
    artists: { slug: string; name: string }[];
    artworkUrl: string | null;
  };
  score: number;
}

export interface TrackChartHistory {
  trackSlug: string;
  trackTitle: string;
  artistNames: string[];
  appearances: {
    editionSlug: string;
    editionLabel: string;
    rank: number;
    weeksOnChart: number;
    movement: "up" | "down" | "same" | "new" | "re_entry";
  }[];
  peakPosition: number;
  totalWeeksOnChart: number;
  firstAppearance: string | null;
  latestAppearance: string | null;
}

export interface ChartFamilyWithEditions extends ChartFamily {
  editions: ChartEdition[];
}

export interface ChartEditionWithEntries extends ChartEdition {
  entries: ChartEditionEntry[];
  family: ChartFamily;
}

export type CsvPublicChartData = {
  generatedAt: string | null;
  sourceFiles: string[];
  families: ChartFamily[];
  editions: ChartEdition[];
  entries: ChartEditionEntry[];
};
