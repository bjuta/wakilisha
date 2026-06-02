import type {
  ChartMethodology,
  ChartMethodologyComponent,
  ChartMethodologyComponentScore,
  ChartMethodologyEvaluationContext,
  ChartMethodologyScoreBreakdown,
  ChartRawMetricSnapshot,
} from "./methodologyTypes";
import { getDefaultMethodology } from "./defaultMethodologies";
import type { IngestResolvedRow } from "../chartsIngestion/ingestStudioTypes";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, precision = 4): number {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

function rawObject(row: IngestResolvedRow): Record<string, unknown> {
  return row.raw && typeof row.raw === "object" ? (row.raw as Record<string, unknown>) : {};
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeLinear(value: number | null, min = 0, max = 100): number {
  if (value === null) return 0;
  if (max === min) return 0;
  return clamp(((value - min) / (max - min)) * 100);
}

function normalizeInverseRank(rank: number | null, maxRank = 100): number {
  if (rank === null || rank <= 0) return 0;
  if (maxRank <= 1) return rank === 1 ? 100 : 0;
  return clamp(100 * (1 - ((rank - 1) / (maxRank - 1))));
}

function normalizeLog(value: number | null, max = 10_000_000): number {
  if (value === null || value <= 0) return 0;
  const denominator = Math.log10(max + 1);
  if (denominator <= 0) return 0;
  return clamp((Math.log10(value + 1) / denominator) * 100);
}

function normalizeBoundedDelta(value: number | null, min = -100, max = 100): number {
  if (value === null) return 50;
  return normalizeLinear(value, min, max);
}

function daysBetween(a: string, b: string): number | null {
  const aDate = new Date(a);
  const bDate = new Date(b);
  if (Number.isNaN(aDate.getTime()) || Number.isNaN(bDate.getTime())) return null;
  return Math.max(0, Math.round((bDate.getTime() - aDate.getTime()) / 86_400_000));
}

function normalizeFreshness(releaseDate: string | null, contextDate: string, halfLifeDays = 45): number {
  if (!releaseDate) return 0;
  const ageDays = daysBetween(releaseDate, contextDate);
  if (ageDays === null) return 0;
  return clamp(100 * Math.pow(0.5, ageDays / halfLifeDays));
}

function getRawMetric(component: ChartMethodologyComponent, metrics: ChartRawMetricSnapshot, context: ChartMethodologyEvaluationContext): number | null {
  if (component.key === "source_position") return metrics.sourceRank ?? null;
  if (component.key === "spotify_performance") return metrics.spotify_performance ?? metrics.spotifyPopularity ?? null;
  if (component.key === "apple_music_performance") return metrics.apple_music_performance ?? metrics.applePosition ?? metrics.sourceRank ?? null;
  if (component.key === "youtube_performance") return metrics.youtube_performance ?? metrics.youtubeViews ?? null;
  if (component.key === "airplay_performance") return metrics.airplay_performance ?? metrics.airplaySpins ?? null;
  if (component.key === "velocity") return metrics.velocity ?? deriveVelocity(metrics);
  if (component.key === "market_relevance") return metrics.market_relevance ?? (metrics.marketAvailable === true ? 100 : metrics.marketAvailable === false ? 0 : 50);
  if (component.key === "freshness") return metrics.freshness ?? freshnessAsRaw(metrics, context, component);
  if (component.key === "editorial_adjustment") return metrics.editorial_adjustment ?? metrics.editorialBoost ?? 0;
  if (component.key === "quality_penalty") return metrics.quality_penalty ?? metrics.penalty ?? 0;
  return null;
}

function deriveVelocity(metrics: ChartRawMetricSnapshot): number | null {
  if (typeof metrics.velocity === "number") return metrics.velocity;
  if (metrics.sourceRank === null || metrics.sourceRank === undefined || metrics.previousRank === null || metrics.previousRank === undefined) return 0;
  return metrics.previousRank - metrics.sourceRank;
}

function freshnessAsRaw(metrics: ChartRawMetricSnapshot, context: ChartMethodologyEvaluationContext, component: ChartMethodologyComponent): number | null {
  return normalizeFreshness(metrics.releaseDate ?? null, context.editionDate, component.halfLifeDays ?? 45);
}

function normalizeComponentValue(component: ChartMethodologyComponent, raw: number | null, metrics: ChartRawMetricSnapshot, context: ChartMethodologyEvaluationContext): number {
  if (component.normalization === "none") return clamp(raw ?? 0);
  if (component.normalization === "linear_0_100") return normalizeLinear(raw, component.min ?? 0, component.max ?? 100);
  if (component.normalization === "inverse_rank") return normalizeInverseRank(raw, component.max ?? metrics.chartSize ?? context.chartSize ?? 100);
  if (component.normalization === "log_0_100") return normalizeLog(raw, component.max ?? 10_000_000);
  if (component.normalization === "bounded_delta") return normalizeBoundedDelta(raw, component.min ?? -100, component.max ?? 100);
  if (component.normalization === "exponential_decay") return clamp(raw ?? 0);
  return clamp(raw ?? 0);
}

function positiveWeightTotal(methodology: ChartMethodology): number {
  const total = methodology.components
    .filter((component) => component.enabled && component.direction === "positive")
    .reduce((sum, component) => sum + Math.max(0, component.weight), 0);
  return total > 0 ? total : 1;
}

function componentExplanation(component: ChartMethodologyComponent, raw: number | null, normalized: number, weighted: number): string {
  return `${component.label}: raw ${raw ?? "missing"}, normalized ${round(normalized, 2)}, weighted contribution ${round(weighted, 2)}.`;
}

export function extractRawMetricsFromRow(row: IngestResolvedRow, context: ChartMethodologyEvaluationContext): ChartRawMetricSnapshot {
  const raw = rawObject(row);
  const sourceRank = row.rank;
  const previousRank = row.previousRank ?? null;
  const releaseDate = stringValue(raw.releaseDate) ?? stringValue(raw.release_date);
  const spotifyPopularity = row.sourceProvider === "spotify" ? numberValue(raw.popularity) : null;
  const applePosition = row.sourceProvider === "apple_music" ? sourceRank : null;
  const youtubeViews = numberValue(raw.youtubeViews) ?? numberValue(raw.youtube_views);
  const airplaySpins = numberValue(raw.airplaySpins) ?? numberValue(raw.airplay_spins);
  const editorialBoost = numberValue(raw.editorialBoost) ?? numberValue(raw.editorial_adjustment);
  const explicit = raw.explicit === true;
  const missingArtwork = !row.artworkUrl;
  const unresolved = row.matchStatus === "needs_review" || row.matchStatus === "no_match";
  const duplicateRisk = row.matchStatus === "duplicate_candidate";
  const penalty = Math.min(100, (explicit ? 5 : 0) + (missingArtwork ? 8 : 0) + (unresolved ? 25 : 0) + (duplicateRisk ? 10 : 0));

  return {
    sourceRank,
    previousRank,
    chartSize: context.chartSize,
    spotifyPopularity,
    applePosition,
    youtubeViews,
    airplaySpins,
    releaseDate,
    marketAvailable: true,
    editorialBoost,
    penalty,
  };
}

export function scoreRawMetrics(
  methodology: ChartMethodology,
  metrics: ChartRawMetricSnapshot,
  context: ChartMethodologyEvaluationContext
): ChartMethodologyScoreBreakdown {
  const positiveTotal = positiveWeightTotal(methodology);
  const componentScores: ChartMethodologyComponentScore[] = [];
  let prePenaltyScore = 0;
  let penaltyScore = 0;
  const warnings: string[] = [];

  for (const component of methodology.components) {
    const raw = getRawMetric(component, metrics, context);
    const normalized = normalizeComponentValue(component, raw, metrics, context);
    const effectiveWeight = component.direction === "positive"
      ? (component.enabled ? component.weight / positiveTotal : 0)
      : component.weight;
    const weightedValue = component.enabled ? normalized * effectiveWeight : 0;

    if (component.enabled && raw === null && component.key !== "editorial_adjustment") {
      warnings.push(`${component.label} is missing; treated as 0.`);
    }

    if (component.direction === "negative") {
      penaltyScore += Math.min(component.cap ?? 100, weightedValue);
    } else {
      prePenaltyScore += weightedValue;
    }

    componentScores.push({
      key: component.key,
      label: component.label,
      rawValue: raw,
      normalizedValue: round(normalized),
      weight: round(effectiveWeight),
      weightedValue: round(weightedValue),
      direction: component.direction,
      enabled: component.enabled,
      explanation: componentExplanation(component, raw, normalized, weightedValue),
    });
  }

  const finalScore = clamp(prePenaltyScore - penaltyScore);

  return {
    methodologyId: methodology.id,
    methodologyVersion: methodology.version,
    formula: methodology.formula,
    rawMetrics: metrics,
    componentScores,
    prePenaltyScore: round(prePenaltyScore),
    penaltyScore: round(penaltyScore),
    finalScore: round(finalScore),
    tieBreakerValues: {
      higher_source_position: metrics.sourceRank ?? null,
      higher_velocity: metrics.velocity ?? deriveVelocity(metrics),
      higher_market_relevance: metrics.market_relevance ?? null,
      newer_release: metrics.releaseDate ?? null,
      higher_canonical_confidence: null,
      lower_previous_rank: metrics.previousRank ?? null,
    },
    warnings,
  };
}

export function scoreIngestRow(
  row: IngestResolvedRow,
  context: ChartMethodologyEvaluationContext,
  methodology: ChartMethodology = getDefaultMethodology()
): ChartMethodologyScoreBreakdown {
  return scoreRawMetrics(methodology, extractRawMetricsFromRow(row, context), context);
}

export function scoreAndRankRows(
  rows: IngestResolvedRow[],
  context: ChartMethodologyEvaluationContext,
  methodology: ChartMethodology = getDefaultMethodology()
): Array<IngestResolvedRow & { methodologyScore: ChartMethodologyScoreBreakdown }> {
  return rows
    .map((row) => ({ ...row, methodologyScore: scoreIngestRow(row, context, methodology) }))
    .sort((a, b) => {
      const scoreDelta = b.methodologyScore.finalScore - a.methodologyScore.finalScore;
      if (Math.abs(scoreDelta) > 0.0001) return scoreDelta;
      return a.rank - b.rank;
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
