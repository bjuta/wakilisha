export type ChartMetricKey =
  | "spotify_performance"
  | "apple_music_performance"
  | "youtube_performance"
  | "airplay_performance"
  | "source_position"
  | "velocity"
  | "market_relevance"
  | "freshness"
  | "editorial_adjustment"
  | "quality_penalty";

export type ChartMetricDirection = "positive" | "negative";
export type ChartNormalizationMode = "none" | "linear_0_100" | "inverse_rank" | "log_0_100" | "exponential_decay" | "bounded_delta";

export type ChartMethodologyComponent = {
  key: ChartMetricKey;
  label: string;
  description: string;
  weight: number;
  direction: ChartMetricDirection;
  normalization: ChartNormalizationMode;
  enabled: boolean;
  min?: number;
  max?: number;
  halfLifeDays?: number;
  cap?: number;
};

export type ChartMethodologyFormula = {
  plainText: string;
  latex: string;
  explanation: string[];
};

export type ChartMethodology = {
  id: string;
  version: string;
  name: string;
  description: string;
  chartKind: "tracks" | "releases" | "artists" | "videos";
  visibility: "public" | "admin_only" | "internal_only";
  components: ChartMethodologyComponent[];
  formula: ChartMethodologyFormula;
  defaultTieBreakers: ChartTieBreaker[];
  createdAt: string;
  updatedAt: string;
};

export type ChartTieBreaker =
  | "higher_source_position"
  | "higher_velocity"
  | "higher_market_relevance"
  | "newer_release"
  | "higher_canonical_confidence"
  | "lower_previous_rank";

export type ChartRawMetricSnapshot = Partial<Record<ChartMetricKey, number | null>> & {
  sourceRank?: number | null;
  previousRank?: number | null;
  chartSize?: number | null;
  spotifyPopularity?: number | null;
  applePosition?: number | null;
  youtubeViews?: number | null;
  airplaySpins?: number | null;
  releaseDate?: string | null;
  marketAvailable?: boolean | null;
  editorialBoost?: number | null;
  penalty?: number | null;
};

export type ChartMethodologyComponentScore = {
  key: ChartMetricKey;
  label: string;
  rawValue: number | null;
  normalizedValue: number;
  weight: number;
  weightedValue: number;
  direction: ChartMetricDirection;
  enabled: boolean;
  explanation: string;
};

export type ChartMethodologyScoreBreakdown = {
  methodologyId: string;
  methodologyVersion: string;
  formula: ChartMethodologyFormula;
  rawMetrics: ChartRawMetricSnapshot;
  componentScores: ChartMethodologyComponentScore[];
  prePenaltyScore: number;
  penaltyScore: number;
  finalScore: number;
  tieBreakerValues: Partial<Record<ChartTieBreaker, number | string | null>>;
  warnings: string[];
};

export type ChartMethodologyEvaluationContext = {
  chartSize: number;
  editionDate: string;
  market: string;
  now?: string;
};
