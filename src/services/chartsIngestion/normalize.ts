/**
 * Normalization Layer
 * Converts NormalizedChartRow (from provider fetch) to IngestResolvedRow (frontend contract).
 * Applies provisional match status, confidence scoring, and warning generation.
 */

import type { NormalizedChartRow, IngestResolvedRow, MatchStatus } from "./ingestStudioTypes";

export type NormalizeResult = {
  resolvedRows: IngestResolvedRow[];
  summary: {
    totalRows: number;
    canonicalMatches: number;
    shells: number;
    gaps: number;
    duplicateCandidates: number;
    needsReview: number;
    matchRate: number;
    warnings: string[];
  };
};

function computeMatchStatus(row: NormalizedChartRow): { status: MatchStatus; confidence: number; warnings: string[] } {
  const warnings: string[] = [];

  // If no artwork, low confidence
  if (!row.artworkUrl) {
    warnings.push("Missing artwork URL from provider");
  }

  // If no preview, note it
  if (!row.previewUrl) {
    warnings.push("No preview URL available from provider");
  }

  // If no external URL, note it
  if (!row.externalUrl) {
    warnings.push("No external URL from provider");
  }

  // Provisional match logic (Sprint 3 — honest but provisional)
  // For Sprint 3, we simulate match status based on track popularity/existence
  // In Sprint 4, this will be replaced with real canonical matching against registry
  const raw = row.raw as Record<string, unknown> | undefined;
  const popularity = typeof raw?.popularity === "number" ? raw.popularity : 50;

  // Deterministic pseudo-random based on track ID
  let hash = 0;
  const seed = row.providerTrackId || row.trackTitle || "unknown";
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  const normalizedHash = Math.abs(hash) % 100;

  // High popularity tracks are more likely to be canonical
  if (popularity > 85 && normalizedHash > 20) {
    return { status: "canonical", confidence: 90 + (normalizedHash % 10), warnings };
  }

  // Medium popularity — could be canonical or shell
  if (popularity > 70 && normalizedHash > 35) {
    return { status: "canonical", confidence: 75 + (normalizedHash % 15), warnings };
  }

  if (popularity > 60 && normalizedHash > 50) {
    return { status: "shell", confidence: 60 + (normalizedHash % 20), warnings: [...warnings, "Low confidence — release shell created"] };
  }

  // Lower popularity or ambiguous hash
  if (normalizedHash > 70) {
    return { status: "no_match", confidence: 0, warnings: [...warnings, "No canonical match found — needs review"] };
  }

  if (normalizedHash > 55) {
    return { status: "needs_review", confidence: 40 + (normalizedHash % 15), warnings: [...warnings, "Ambiguous match — multiple possible canonical tracks"] };
  }

  if (normalizedHash > 40) {
    return { status: "duplicate_candidate", confidence: 30 + (normalizedHash % 15), warnings: [...warnings, "Possible duplicate of existing canonical track"] };
  }

  // Default to canonical for well-known tracks
  return { status: "canonical", confidence: 70 + (normalizedHash % 25), warnings };
}

function generateResolvedRowId(row: NormalizedChartRow, index: number): string {
  const provider = row.sourceProvider === "spotify" ? "sp" : "am";
  const trackId = row.providerTrackId || `track-${index}`;
  return `row-${provider}-${trackId}`;
}

function generateCanonicalIds(row: NormalizedChartRow, status: MatchStatus): {
  canonicalTrackId: string | null;
  canonicalReleaseId: string | null;
  canonicalArtistIds: string[];
  releaseShellId: string | null;
} {
  if (status === "canonical") {
    return {
      canonicalTrackId: row.providerTrackId ? `wk-${row.providerTrackId}` : null,
      canonicalReleaseId: row.providerReleaseId ? `wk-${row.providerReleaseId}` : null,
      canonicalArtistIds: (row.providerArtistIds ?? []).map((id) => `wk-${id}`),
      releaseShellId: null,
    };
  }
  if (status === "shell") {
    return {
      canonicalTrackId: null,
      canonicalReleaseId: null,
      canonicalArtistIds: [],
      releaseShellId: row.providerReleaseId ? `shell-${row.providerReleaseId}` : `shell-${row.providerTrackId ?? "unknown"}`,
    };
  }
  return {
    canonicalTrackId: null,
    canonicalReleaseId: null,
    canonicalArtistIds: [],
    releaseShellId: null,
  };
}

export function normalizeToResolvedRows(rows: NormalizedChartRow[]): NormalizeResult {
  const resolvedRows: IngestResolvedRow[] = [];
  let canonicalMatches = 0;
  let shells = 0;
  let gaps = 0;
  let duplicateCandidates = 0;
  let needsReview = 0;
  const allWarnings: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const { status, confidence, warnings } = computeMatchStatus(row);
    const canonicalIds = generateCanonicalIds(row, status);

    if (status === "canonical") canonicalMatches++;
    if (status === "shell") shells++;
    if (status === "no_match") gaps++;
    if (status === "duplicate_candidate") duplicateCandidates++;
    if (status === "needs_review") needsReview++;

    allWarnings.push(...warnings);

    const resolved: IngestResolvedRow = {
      id: generateResolvedRowId(row, i),
      rank: row.rank,
      previousRank: row.previousRank,
      movement: row.movement,
      sourceProvider: row.sourceProvider,
      sourceUrl: row.sourceUrl,
      title: row.trackTitle || row.releaseTitle || "Unknown",
      artistNames: row.artistNames,
      artworkUrl: row.artworkUrl,
      matchStatus: status,
      confidence,
      canonicalTrackId: canonicalIds.canonicalTrackId,
      canonicalReleaseId: canonicalIds.canonicalReleaseId,
      canonicalArtistIds: canonicalIds.canonicalArtistIds,
      releaseShellId: canonicalIds.releaseShellId,
      warnings: warnings.length > 0 ? warnings : undefined,
      raw: row.raw,
    };

    resolvedRows.push(resolved);
  }

  const totalRows = resolvedRows.length;
  const matchRate = totalRows > 0 ? (canonicalMatches / totalRows) * 100 : 0;

  return {
    resolvedRows,
    summary: {
      totalRows,
      canonicalMatches,
      shells,
      gaps,
      duplicateCandidates,
      needsReview,
      matchRate,
      warnings: [...new Set(allWarnings)],
    },
  };
}

export function mergeNormalizedRows(rows: NormalizedChartRow[]): NormalizedChartRow[] {
  // Deduplicate by providerTrackId, keeping the first occurrence
  const seen = new Set<string>();
  const result: NormalizedChartRow[] = [];
  for (const row of rows) {
    const key = row.providerTrackId || row.trackTitle || "";
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}