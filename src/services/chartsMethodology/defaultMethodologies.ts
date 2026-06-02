import type { ChartMethodology } from "./methodologyTypes";

const now = "2026-06-03T00:00:00.000Z";

export const TOP_SONGS_WEIGHTED_V1: ChartMethodology = {
  id: "top_songs_weighted_v1",
  version: "top_songs_weighted_v1",
  name: "Top Songs Weighted v1",
  description: "Commercial-grade default methodology for ranked track charts. Combines provider performance, velocity, market relevance, freshness, editorial adjustment, and penalties.",
  chartKind: "tracks",
  visibility: "admin_only",
  components: [
    {
      key: "spotify_performance",
      label: "Spotify performance",
      description: "Spotify popularity, playlist position, or normalized Spotify source strength.",
      weight: 0.30,
      direction: "positive",
      normalization: "linear_0_100",
      enabled: true,
      min: 0,
      max: 100,
    },
    {
      key: "apple_music_performance",
      label: "Apple Music performance",
      description: "Apple Music chart or playlist position converted into a normalized score.",
      weight: 0.25,
      direction: "positive",
      normalization: "inverse_rank",
      enabled: true,
      min: 1,
      max: 100,
    },
    {
      key: "youtube_performance",
      label: "YouTube performance",
      description: "Normalized YouTube views/engagement where available.",
      weight: 0.15,
      direction: "positive",
      normalization: "log_0_100",
      enabled: true,
      min: 0,
      max: 10000000,
    },
    {
      key: "airplay_performance",
      label: "Airplay performance",
      description: "Normalized airplay spins or airplay chart rank where available.",
      weight: 0.15,
      direction: "positive",
      normalization: "linear_0_100",
      enabled: true,
      min: 0,
      max: 1000,
    },
    {
      key: "velocity",
      label: "Velocity",
      description: "Momentum from current position, previous position, and recent movement.",
      weight: 0.10,
      direction: "positive",
      normalization: "bounded_delta",
      enabled: true,
      min: -100,
      max: 100,
    },
    {
      key: "editorial_adjustment",
      label: "Editorial adjustment",
      description: "Auditable admin adjustment capped to prevent editorial override from dominating the chart.",
      weight: 0.05,
      direction: "positive",
      normalization: "linear_0_100",
      enabled: true,
      min: -20,
      max: 20,
      cap: 20,
    },
    {
      key: "market_relevance",
      label: "Market relevance",
      description: "Availability and relevance to the selected chart market/scope.",
      weight: 0.00,
      direction: "positive",
      normalization: "linear_0_100",
      enabled: true,
      min: 0,
      max: 100,
    },
    {
      key: "freshness",
      label: "Freshness",
      description: "Optional recency score. Disabled by default for normal top songs; useful for release-year charts.",
      weight: 0.00,
      direction: "positive",
      normalization: "exponential_decay",
      enabled: false,
      halfLifeDays: 45,
    },
    {
      key: "quality_penalty",
      label: "Quality penalty",
      description: "Penalty for missing metadata, unresolved entities, unavailable previews, duplicate risk, or policy issues.",
      weight: 1.00,
      direction: "negative",
      normalization: "linear_0_100",
      enabled: true,
      min: 0,
      max: 100,
      cap: 30,
    },
  ],
  formula: {
    plainText: "Final Score = weighted source performance + velocity + market relevance + freshness + editorial adjustment - penalty score.",
    latex: "S = \sum_i w_i n_i + A_e - P",
    explanation: [
      "Each enabled positive component is normalized to a 0–100 score.",
      "Weights are admin-tunable and normalized at evaluation time so enabled positive components sum to 1.",
      "Editorial adjustment is capped and auditable.",
      "Penalty is subtracted after weighted scoring so poor metadata or unresolved entities can reduce rank without silently deleting rows.",
    ],
  },
  defaultTieBreakers: ["higher_source_position", "higher_velocity", "higher_market_relevance", "newer_release", "higher_canonical_confidence"],
  createdAt: now,
  updatedAt: now,
};

export const CSV_POSITION_ORDER_V1: ChartMethodology = {
  id: "csv_position_order_v1",
  version: "csv_position_order_v1",
  name: "CSV Position Order v1",
  description: "Legacy/import methodology. Preserves imported rank order from old chart CSV exports instead of recalculating rank from performance data.",
  chartKind: "tracks",
  visibility: "admin_only",
  components: [
    {
      key: "source_position",
      label: "Imported source position",
      description: "Rank is determined directly by imported source position. Lower rank is stronger.",
      weight: 1,
      direction: "positive",
      normalization: "inverse_rank",
      enabled: true,
      min: 1,
      max: 100,
    },
  ],
  formula: {
    plainText: "Final Score = inverse imported position. Rank order is preserved from the legacy source.",
    latex: "S = 100 \times \left(1 - \frac{r - 1}{N - 1}\right)",
    explanation: [
      "This methodology is for legacy imports and manual ordered lists.",
      "It does not claim to measure platform performance.",
      "It keeps old WAKILISHA chart history stable while the new weighted model powers future charts.",
    ],
  },
  defaultTieBreakers: ["higher_source_position", "lower_previous_rank"],
  createdAt: now,
  updatedAt: now,
};

export const RELEASE_RECENCY_WEIGHTED_V1: ChartMethodology = {
  ...TOP_SONGS_WEIGHTED_V1,
  id: "release_recency_weighted_v1",
  version: "release_recency_weighted_v1",
  name: "Release Recency Weighted v1",
  description: "Variant for release-year or new-release charts where freshness is intentionally part of the score.",
  components: TOP_SONGS_WEIGHTED_V1.components.map((component) => {
    if (component.key === "freshness") return { ...component, enabled: true, weight: 0.15 };
    if (component.key === "spotify_performance") return { ...component, weight: 0.25 };
    if (component.key === "apple_music_performance") return { ...component, weight: 0.20 };
    if (component.key === "youtube_performance") return { ...component, weight: 0.10 };
    if (component.key === "airplay_performance") return { ...component, weight: 0.10 };
    return component;
  }),
};

export const DEFAULT_CHART_METHODOLOGIES: ChartMethodology[] = [
  TOP_SONGS_WEIGHTED_V1,
  RELEASE_RECENCY_WEIGHTED_V1,
  CSV_POSITION_ORDER_V1,
];

export function getDefaultMethodology(version = "top_songs_weighted_v1"): ChartMethodology {
  return DEFAULT_CHART_METHODOLOGIES.find((methodology) => methodology.version === version || methodology.id === version) ?? TOP_SONGS_WEIGHTED_V1;
}
