/**
 * Normalization Layer — Ingest Pipeline
 *
 * This module is a THIN WRAPPER around the canonical normalization engine
 * (src/services/chartsScoring/normalize.ts — Bible §3). It applies the
 * production-grade title/artist identity key generation and then enriches
 * each row with rich metadata for registry-ready ingestion.
 *
 * The hash-based mock match-status logic has been removed. Identity keys
 * are now pure, deterministic, and byte-for-byte reproducible.
 *
 * PR 2 — Normalization Module Port (2026-06-11)
 */

import type { NormalizedChartRow, IngestResolvedRow, MatchStatus } from "./ingestStudioTypes";
import { enrichRawWithRichMetadata } from "./richMetadataNormalize";
import {
  build_normalized_key,
  lead_artist_key,
  normalize_title,
  normalize_artist,
} from "@/services/chartsScoring/normalize";

export type NormalizeResult = {
  resolvedRows: IngestResolvedRow[];
  summary: {
    totalRows: number;
    canonicalMatches: number;
    shells: number;
    gaps: number;
    duplicateCandidates: number;
    needsReview: number;
    richMetadataRows: number;
    artistCreditRows: number;
    matchRate: number;
    warnings: string[];
  };
};

// ── Row ID generation ─────────────────────────────────────────────────────────

function generateResolvedRowId(row: NormalizedChartRow, index: number): string {
  const provider = row.sourceProvider === "spotify" ? "sp" : "am";
  const trackId = row.providerTrackId || `track-${index}`;
  return `row-${provider}-${trackId}`;
}

// ── Canonical ID generation ───────────────────────────────────────────────────

function generateCanonicalIds(
  row: NormalizedChartRow,
  status: MatchStatus,
): {
  canonicalTrackId: string | null;
  canonicalReleaseId: string | null;
  canonicalArtistIds: string[];
  releaseShellId: string | null;
} {
  if (status === "canonical") {
    return {
      canonicalTrackId: row.providerTrackId ? `wk-${row.providerTrackId}` : null,
      canonicalReleaseId: row.providerReleaseId
        ? `wk-${row.providerReleaseId}`
        : null,
      canonicalArtistIds: (row.providerArtistIds ?? []).map((id) => `wk-${id}`),
      releaseShellId: null,
    };
  }
  if (status === "shell") {
    return {
      canonicalTrackId: null,
      canonicalReleaseId: null,
      canonicalArtistIds: [],
      releaseShellId: row.providerReleaseId
        ? `shell-${row.providerReleaseId}`
        : `shell-${row.providerTrackId ?? "unknown"}`,
    };
  }
  return {
    canonicalTrackId: null,
    canonicalReleaseId: null,
    canonicalArtistIds: [],
    releaseShellId: null,
  };
}

// ── Rich metadata helpers ─────────────────────────────────────────────────────

function hasRichMetadata(raw: unknown): boolean {
  return Boolean(
    raw && typeof raw === "object" && "richMetadata" in raw,
  );
}

function hasArtistCredits(raw: unknown): boolean {
  return Boolean(
    raw &&
      typeof raw === "object" &&
      "artistCredits" in raw &&
      Array.isArray((raw as Record<string, unknown>).artistCredits),
  );
}

// ── Core normalization entry point ────────────────────────────────────────────

/**
 * Normalize a batch of provider-fetched rows into ingest-resolved rows.
 *
 * Each row receives:
 *  - normalized_key  (Bible §3: "{normalized_title}::{lead_artist_key}")
 *  - lead_artist_key (Bible §3: primary artist extracted & normalized)
 *  - Rich metadata (ISRC, UPC, release date, artist credits, etc.)
 *  - Default matchStatus of "needs_review" (canonical matching is deferred
 *    to the backend pipeline — canonicalMatch.ts / canonical_match stage)
 *
 * This function is PURE and deterministic — same input always produces
 * the same normalized_key for every row.
 */
export function normalizeToResolvedRows(
  rows: NormalizedChartRow[],
): NormalizeResult {
  const resolvedRows: IngestResolvedRow[] = [];
  let canonicalMatches = 0;
  let shells = 0;
  let gaps = 0;
  let duplicateCandidates = 0;
  let needsReview = 0;
  let richMetadataRows = 0;
  let artistCreditRows = 0;
  const allWarnings: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // ── Build identity keys using the canonical scoring engine ──
    const title = row.trackTitle || row.releaseTitle || "Unknown";
    const artistLine = row.artistNames.join(", ");
    const normalizedKey = build_normalized_key(title, artistLine);
    const leadKey = lead_artist_key(artistLine);
    const normalizedTitle = normalize_title(title);
    const normalizedArtist = normalize_artist(artistLine);

    // ── Warnings for missing provider data ──
    const warnings: string[] = [];
    if (!row.artworkUrl) warnings.push("Missing artwork URL from provider");
    if (!row.previewUrl) warnings.push("No preview URL available from provider");
    if (!row.externalUrl) warnings.push("No external URL from provider");

    // ── Default match status: defer to backend pipeline ──
    // The canonical_match stage (canonicalMatch.ts / backend) handles
    // actual entity resolution. Here we set a sensible default.
    const status: MatchStatus = "needs_review";

    // ── Enrich with rich metadata ──
    const richRaw = enrichRawWithRichMetadata(row);
    const canonicalIds = generateCanonicalIds(row, status);

    // Counters
    needsReview++;
    if (hasRichMetadata(richRaw)) richMetadataRows++;
    if (hasArtistCredits(richRaw)) artistCreditRows++;
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
      confidence: 50, // neutral — actual confidence assigned by canonical_match stage
      canonicalTrackId: canonicalIds.canonicalTrackId,
      canonicalReleaseId: canonicalIds.canonicalReleaseId,
      canonicalArtistIds: canonicalIds.canonicalArtistIds,
      releaseShellId: canonicalIds.releaseShellId,
      warnings: warnings.length > 0 ? warnings : undefined,
      // ── Bible §3 identity keys ──
      normalized_key: normalizedKey,
      lead_artist_key: leadKey,
      raw: {
        ...richRaw,
        canonicalTrackId: canonicalIds.canonicalTrackId,
        canonicalReleaseId: canonicalIds.canonicalReleaseId,
        canonicalArtistIds: canonicalIds.canonicalArtistIds,
        releaseShellId: canonicalIds.releaseShellId,
        normalized_key: normalizedKey,
        lead_artist_key: leadKey,
        normalized_title: normalizedTitle,
        normalized_artist: normalizedArtist,
      },
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
      richMetadataRows,
      artistCreditRows,
      matchRate,
      warnings: [...new Set(allWarnings)],
    },
  };
}

// ── Deduplication ─────────────────────────────────────────────────────────────

/**
 * Deduplicate normalized rows by identity.
 *
 * Priority order:
 *  1. providerTrackId (most reliable — provider-assigned unique ID)
 *  2. normalized_key (Bible §3 composite key from title + lead artist)
 *
 * When duplicates are found, the FIRST occurrence is kept.
 */
export function mergeNormalizedRows(
  rows: NormalizedChartRow[],
): NormalizedChartRow[] {
  const seenProviderIds = new Set<string>();
  const seenKeys = new Set<string>();
  const result: NormalizedChartRow[] = [];

  for (const row of rows) {
    // Check by provider track ID first (strongest signal)
    if (row.providerTrackId) {
      if (seenProviderIds.has(row.providerTrackId)) continue;
      seenProviderIds.add(row.providerTrackId);
    }

    // Check by normalized key (composite identity)
    const title = row.trackTitle || row.releaseTitle || "Unknown";
    const artistLine = row.artistNames.join(", ");
    const key = build_normalized_key(title, artistLine);
    if (key && seenKeys.has(key)) continue;
    if (key) seenKeys.add(key);

    result.push(row);
  }

  return result;
}