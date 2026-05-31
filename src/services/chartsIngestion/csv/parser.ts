/**
 * CSV parsing utilities for the chart ingestion pipeline.
 * Simulates the CSV normalization flow used in production.
 */

import type { DiscoveredCsvFile, CsvRowProvenance, CsvNormalizationResult } from "./types";

export function getMappedValue(
  row: Record<string, string>,
  csv: DiscoveredCsvFile,
  field: string
): string | null {
  const csvColumn = csv.mappedFields[field];
  if (!csvColumn) return null;
  const value = row[csvColumn];
  return value && value.trim() !== "" ? value.trim() : null;
}

export function getPositionFromRow(row: Record<string, string>, csv: DiscoveredCsvFile): number | null {
  const rankValue = getMappedValue(row, csv, "rank");
  if (rankValue) {
    const parsed = parseInt(rankValue, 10);
    if (!isNaN(parsed)) return parsed;
  }
  const positionValue = getMappedValue(row, csv, "position");
  if (positionValue) {
    const parsed = parseInt(positionValue, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

export function getTitleFromRow(row: Record<string, string>, csv: DiscoveredCsvFile): string | null {
  return getMappedValue(row, csv, "title") ?? getMappedValue(row, csv, "track_title");
}

export function getArtistFromRow(row: Record<string, string>, csv: DiscoveredCsvFile): string | null {
  return getMappedValue(row, csv, "artist_line") ?? getMappedValue(row, csv, "artist_name");
}

export function getIsrcFromRow(row: Record<string, string>, csv: DiscoveredCsvFile): string | null {
  return getMappedValue(row, csv, "isrc");
}

export function getReleaseTitleFromRow(row: Record<string, string>, csv: DiscoveredCsvFile): string | null {
  return getMappedValue(row, csv, "release_title") ?? getMappedValue(row, csv, "album");
}

export function getArtworkUrlFromRow(row: Record<string, string>, csv: DiscoveredCsvFile): string | null {
  return getMappedValue(row, csv, "artwork_url");
}

export function getSpotifyUrlFromRow(row: Record<string, string>, csv: DiscoveredCsvFile): string | null {
  return getMappedValue(row, csv, "spotify_url");
}

export function getAppleUrlFromRow(row: Record<string, string>, csv: DiscoveredCsvFile): string | null {
  return getMappedValue(row, csv, "apple_music_url") ?? getMappedValue(row, csv, "apple_url");
}

export function getYoutubeUrlFromRow(row: Record<string, string>, csv: DiscoveredCsvFile): string | null {
  return getMappedValue(row, csv, "youtube_url");
}

export function getLabelFromRow(row: Record<string, string>, csv: DiscoveredCsvFile): string | null {
  return getMappedValue(row, csv, "label");
}

export function computeRowHash(row: Record<string, string>): string {
  const entries = Object.entries(row).sort((a, b) => a[0].localeCompare(b[0]));
  const str = JSON.stringify(entries);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36).padStart(8, "0");
}

export function normalizeRowToCandidate(
  row: Record<string, string>,
  csv: DiscoveredCsvFile,
  rowNumber: number
): {
  position: number | null;
  title: string | null;
  artist: string | null;
  isrc: string | null;
  releaseTitle: string | null;
  artworkUrl: string | null;
  externalUrls: Record<string, string>;
  label: string | null;
  provenance: CsvRowProvenance;
} | null {
  const position = getPositionFromRow(row, csv);
  const title = getTitleFromRow(row, csv);
  const artist = getArtistFromRow(row, csv);

  if (!title || !artist) {
    return null;
  }

  const isrc = getIsrcFromRow(row, csv);
  const releaseTitle = getReleaseTitleFromRow(row, csv);
  const artworkUrl = getArtworkUrlFromRow(row, csv);
  const label = getLabelFromRow(row, csv);

  const externalUrls: Record<string, string> = {};
  const spotify = getSpotifyUrlFromRow(row, csv);
  const apple = getAppleUrlFromRow(row, csv);
  const youtube = getYoutubeUrlFromRow(row, csv);
  if (spotify) externalUrls.spotify = spotify;
  if (apple) externalUrls.apple = apple;
  if (youtube) externalUrls.youtube = youtube;

  const rawPayload: Record<string, string> = {};
  for (const key of Object.keys(row)) {
    rawPayload[key] = row[key];
  }

  const mappedFields: Record<string, string> = {};
  for (const [field, col] of Object.entries(csv.mappedFields)) {
    if (col && row[col] !== undefined) {
      mappedFields[field] = row[col];
    }
  }

  const provenance: CsvRowProvenance = {
    sourceFilename: csv.filename,
    sourceRowNumber: rowNumber,
    rawRowHash: computeRowHash(row),
    rawPayload,
    mappedFields,
    sourcePosition: position,
  };

  return {
    position,
    title,
    artist,
    isrc,
    releaseTitle,
    artworkUrl,
    externalUrls,
    label,
    provenance,
  };
}

export function normalizeCsvToCandidates(
  csv: DiscoveredCsvFile
): CsvNormalizationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let skippedRows = 0;
  const provenance: CsvRowProvenance[] = [];

  for (let i = 0; i < csv.sampleRows.length; i++) {
    const row = csv.sampleRows[i];
    const normalized = normalizeRowToCandidate(row, csv, i + 1);
    if (!normalized) {
      skippedRows++;
      errors.push(`Row ${i + 1}: missing title or artist`);
      continue;
    }
    provenance.push(normalized.provenance);
  }

  if (csv.rowCount > csv.sampleRows.length) {
    warnings.push(`Full file has ${csv.rowCount} rows — only ${csv.sampleRows.length} sample rows processed in preview`);
  }

  if (csv.validationStatus === "warnings") {
    warnings.push(...csv.validationIssues);
  }
  if (csv.validationStatus === "errors") {
    errors.push(...csv.validationIssues);
  }

  return {
    candidateCount: provenance.length,
    errors,
    warnings,
    skippedRows,
    provenance,
  };
}

export function validateCsvMapping(csv: DiscoveredCsvFile): {
  readyToNormalize: boolean;
  missingRequired: string[];
  missingRecommended: string[];
} {
  const mappedKeys = Object.keys(csv.mappedFields);
  const missingRequired: string[] = [];
  const missingRecommended: string[] = [];

  if (!mappedKeys.includes("rank") && !mappedKeys.includes("position")) {
    missingRequired.push("rank/position");
  }
  if (!mappedKeys.includes("title") && !mappedKeys.includes("track_title")) {
    missingRequired.push("title");
  }
  if (!mappedKeys.includes("artist_line") && !mappedKeys.includes("artist_name")) {
    missingRequired.push("artist");
  }

  if (!mappedKeys.includes("isrc")) missingRecommended.push("isrc");
  if (!mappedKeys.includes("spotify_url")) missingRecommended.push("spotify_url");
  if (!mappedKeys.includes("artwork_url")) missingRecommended.push("artwork_url");

  return {
    readyToNormalize: missingRequired.length === 0,
    missingRequired,
    missingRecommended,
  };
}