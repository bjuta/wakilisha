/**
 * Provider Fetch Orchestrator
 * Ties together Spotify and Apple Music fetch services.
 * Attempts real API calls when credentials are available, falls back to realistic mock.
 * Handles partial failures per source URL.
 */

import type { NormalizedChartRow } from "./ingestStudioTypes";
import { detectProviderFromUrl } from "./providerDetection";
import { fetchFromSpotify } from "./spotifyFetch";
import { fetchFromAppleMusic } from "./appleMusicFetch";

export type ProviderFetchConfig = {
  market?: string;
  maxRows?: number;
  spotifyClientId?: string;
  spotifyClientSecret?: string;
  appleMusicDeveloperToken?: string;
};

export type SourceFetchResult = {
  sourceUrl: string;
  provider: "spotify" | "apple_music" | "unknown";
  success: boolean;
  normalizedRows: NormalizedChartRow[];
  error?: string;
  rawPayload: unknown;
  warnings: string[];
  metrics: {
    fetchedCount: number;
    normalizedCount: number;
    droppedCount: number;
    durationMs: number;
  };
};

export type ProviderFetchAggregateResult = {
  success: boolean;
  sourceResults: SourceFetchResult[];
  allNormalizedRows: NormalizedChartRow[];
  overallError?: string;
  overallWarnings: string[];
  overallMetrics: {
    totalSources: number;
    successfulSources: number;
    failedSources: number;
    totalFetched: number;
    totalNormalized: number;
    totalDropped: number;
    totalDurationMs: number;
  };
};

export async function fetchFromAllSources(
  sourceUrls: string[],
  config: ProviderFetchConfig
): Promise<ProviderFetchAggregateResult> {
  const sourceResults: SourceFetchResult[] = [];
  const allNormalizedRows: NormalizedChartRow[] = [];
  const overallWarnings: string[] = [];
  let totalDurationMs = 0;
  let successfulSources = 0;
  let failedSources = 0;

  for (const sourceUrl of sourceUrls) {
    const provider = detectProviderFromUrl(sourceUrl);

    if (provider === "unknown") {
      const result: SourceFetchResult = {
        sourceUrl,
        provider: "unknown",
        success: false,
        normalizedRows: [],
        error: `Unrecognized provider for URL: ${sourceUrl}`,
        rawPayload: { unrecognized: true, sourceUrl },
        warnings: ["Provider not recognized — skipping source"],
        metrics: { fetchedCount: 0, normalizedCount: 0, droppedCount: 0, durationMs: 0 },
      };
      sourceResults.push(result);
      failedSources++;
      overallWarnings.push(result.error);
      continue;
    }

    let result: SourceFetchResult;
    const start = performance.now();

    try {
      if (provider === "spotify") {
        const spotifyResult = await fetchFromSpotify(sourceUrl, config.market || "KE", config.maxRows || 100);
        result = {
          sourceUrl,
          provider: "spotify",
          success: spotifyResult.success,
          normalizedRows: spotifyResult.normalizedRows,
          error: spotifyResult.error,
          rawPayload: spotifyResult.rawPayload,
          warnings: spotifyResult.warnings,
          metrics: spotifyResult.metrics,
        };
      } else {
        const appleResult = await fetchFromAppleMusic(sourceUrl, config.market || "KE", config.maxRows || 100);
        result = {
          sourceUrl,
          provider: "apple_music",
          success: appleResult.success,
          normalizedRows: appleResult.normalizedRows,
          error: appleResult.error,
          rawPayload: appleResult.rawPayload,
          warnings: appleResult.warnings,
          metrics: appleResult.metrics,
        };
      }
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      const message = err instanceof Error ? err.message : "Unknown fetch error";
      result = {
        sourceUrl,
        provider,
        success: false,
        normalizedRows: [],
        error: message,
        rawPayload: { unexpectedError: true, sourceUrl, error: message },
        warnings: [`Unexpected error fetching from ${provider}: ${message}`],
        metrics: { fetchedCount: 0, normalizedCount: 0, droppedCount: 0, durationMs },
      };
    }

    sourceResults.push(result);
    totalDurationMs += result.metrics.durationMs;

    if (result.success) {
      successfulSources++;
      allNormalizedRows.push(...result.normalizedRows);
    } else {
      failedSources++;
      overallWarnings.push(result.error || `Source failed: ${sourceUrl}`);
    }

    overallWarnings.push(...result.warnings);
  }

  // If all sources failed, mark overall as failed
  const overallSuccess = successfulSources > 0;
  const overallError = failedSources === sourceUrls.length && sourceUrls.length > 0
    ? "All sources failed to fetch. Check provider credentials and source URLs."
    : undefined;

  return {
    success: overallSuccess,
    sourceResults,
    allNormalizedRows,
    overallError,
    overallWarnings: [...new Set(overallWarnings)],
    overallMetrics: {
      totalSources: sourceUrls.length,
      successfulSources,
      failedSources,
      totalFetched: allNormalizedRows.reduce((sum, r) => sum + 1, 0),
      totalNormalized: allNormalizedRows.length,
      totalDropped: sourceResults.reduce((sum, r) => sum + r.metrics.droppedCount, 0),
      totalDurationMs,
    },
  };
}

export function getProviderFetchStatusSummary(results: SourceFetchResult[]): string {
  const parts: string[] = [];
  for (const r of results) {
    if (r.success) {
      parts.push(`${r.provider}: ${r.normalizedRows.length} rows`);
    } else {
      parts.push(`${r.provider}: FAILED (${r.error || "unknown error"})`);
    }
  }
  return parts.join(" | ");
}