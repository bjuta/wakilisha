/**
 * API Contract Assertions
 * Lightweight runtime shape validation for development.
 * Catches backend shape drift before it reaches the UI.
 */

import type {
  IngestJob,
  IngestSource,
  IngestCandidate,
  ReviewIssue,
  DraftEntry,
  Snapshot,
  ChartEdition,
  ChartFamily,
} from "./types";

interface ValidationError {
  field: string;
  expected: string;
  received: string;
  value: unknown;
}

function validate(
  condition: boolean,
  field: string,
  expected: string,
  value: unknown
): ValidationError | null {
  if (!condition) {
    return { field, expected, received: typeof value, value };
  }
  return null;
}

function assertNoErrors(errors: ValidationError[], methodName: string): void {
  if (errors.length === 0) return;

  const message = errors
    .map((e) => `  - ${e.field}: expected ${e.expected}, got ${e.received}`)
    .join("\n");

  const fullMessage = `[contract] ${methodName} shape mismatch:\n${message}`;

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error(fullMessage, errors);
    throw new Error(fullMessage);
  }
}

// ─── Ingest Job ───
export function assertIngestJobShape(value: unknown, methodName = "assertIngestJobShape"): asserts value is IngestJob {
  if (!value || typeof value !== "object") {
    throw new Error(`[contract] ${methodName}: expected object, got ${typeof value}`);
  }

  const v = value as Record<string, unknown>;
  const errors: ValidationError[] = [];

  errors.push(validate(typeof v.id === "string", "id", "string", v.id));
  errors.push(validate(typeof v.chartFamilyId === "string", "chartFamilyId", "string", v.chartFamilyId));
  errors.push(validate(typeof v.status === "string", "status", "string", v.status));
  errors.push(validate(typeof v.editionDate === "string", "editionDate", "string", v.editionDate));
  errors.push(validate(typeof v.periodStart === "string", "periodStart", "string", v.periodStart));
  errors.push(validate(typeof v.periodEnd === "string", "periodEnd", "string", v.periodEnd));
  errors.push(validate(typeof v.chartSize === "number", "chartSize", "number", v.chartSize));
  errors.push(validate(typeof v.createdAt === "string", "createdAt", "string", v.createdAt));
  errors.push(validate(v.sourceSummary && typeof v.sourceSummary === "object", "sourceSummary", "object", v.sourceSummary));
  errors.push(validate(v.jobSummary && typeof v.jobSummary === "object", "jobSummary", "object", v.jobSummary));

  assertNoErrors(errors.filter(Boolean) as ValidationError[], methodName);
}

// ─── Source ───
export function assertSourceShape(value: unknown, methodName = "assertSourceShape"): asserts value is IngestSource {
  if (!value || typeof value !== "object") {
    throw new Error(`[contract] ${methodName}: expected object, got ${typeof value}`);
  }

  const v = value as Record<string, unknown>;
  const errors: ValidationError[] = [];

  errors.push(validate(typeof v.id === "string", "id", "string", v.id));
  errors.push(validate(typeof v.jobId === "string", "jobId", "string", v.jobId));
  errors.push(validate(typeof v.sourceType === "string", "sourceType", "string", v.sourceType));
  errors.push(validate(typeof v.provider === "string", "provider", "string", v.provider));
  errors.push(validate(typeof v.weight === "number", "weight", "number", v.weight));
  errors.push(validate(typeof v.priority === "number", "priority", "number", v.priority));
  errors.push(validate(typeof v.status === "string", "status", "string", v.status));

  assertNoErrors(errors.filter(Boolean) as ValidationError[], methodName);
}

// ─── Candidate ───
export function assertCandidateShape(value: unknown, methodName = "assertCandidateShape"): asserts value is IngestCandidate {
  if (!value || typeof value !== "object") {
    throw new Error(`[contract] ${methodName}: expected object, got ${typeof value}`);
  }

  const v = value as Record<string, unknown>;
  const errors: ValidationError[] = [];

  errors.push(validate(typeof v.id === "string", "id", "string", v.id));
  errors.push(validate(typeof v.jobId === "string", "jobId", "string", v.jobId));
  errors.push(validate(typeof v.normalizedTitle === "string", "normalizedTitle", "string", v.normalizedTitle));
  errors.push(validate(typeof v.normalizedArtistLine === "string", "normalizedArtistLine", "string", v.normalizedArtistLine));
  errors.push(validate(Array.isArray(v.normalizedArtists), "normalizedArtists", "string[]", v.normalizedArtists));
  errors.push(validate(typeof v.score === "number", "score", "number", v.score));
  errors.push(validate(typeof v.status === "string", "status", "string", v.status));

  assertNoErrors(errors.filter(Boolean) as ValidationError[], methodName);
}

// ─── Issue ───
export function assertIssueShape(value: unknown, methodName = "assertIssueShape"): asserts value is ReviewIssue {
  if (!value || typeof value !== "object") {
    throw new Error(`[contract] ${methodName}: expected object, got ${typeof value}`);
  }

  const v = value as Record<string, unknown>;
  const errors: ValidationError[] = [];

  errors.push(validate(typeof v.id === "string", "id", "string", v.id));
  errors.push(validate(typeof v.jobId === "string", "jobId", "string", v.jobId));
  errors.push(validate(typeof v.severity === "string", "severity", "string", v.severity));
  errors.push(validate(typeof v.issueType === "string", "issueType", "string", v.issueType));
  errors.push(validate(typeof v.message === "string", "message", "string", v.message));
  errors.push(validate(typeof v.status === "string", "status", "string", v.status));

  assertNoErrors(errors.filter(Boolean) as ValidationError[], methodName);
}

// ─── Draft Entry ───
export function assertDraftEntryShape(value: unknown, methodName = "assertDraftEntryShape"): asserts value is DraftEntry {
  if (!value || typeof value !== "object") {
    throw new Error(`[contract] ${methodName}: expected object, got ${typeof value}`);
  }

  const v = value as Record<string, unknown>;
  const errors: ValidationError[] = [];

  errors.push(validate(typeof v.id === "string", "id", "string", v.id));
  errors.push(validate(typeof v.jobId === "string", "jobId", "string", v.jobId));
  errors.push(validate(typeof v.candidateId === "string", "candidateId", "string", v.candidateId));
  errors.push(validate(typeof v.finalRank === "number", "finalRank", "number", v.finalRank));
  errors.push(validate(typeof v.canonicalTrackId === "string", "canonicalTrackId", "string", v.canonicalTrackId));

  assertNoErrors(errors.filter(Boolean) as ValidationError[], methodName);
}

// ─── Snapshot ───
export function assertSnapshotShape(value: unknown, methodName = "assertSnapshotShape"): asserts value is Snapshot {
  if (!value || typeof value !== "object") {
    throw new Error(`[contract] ${methodName}: expected object, got ${typeof value}`);
  }

  const v = value as Record<string, unknown>;
  const errors: ValidationError[] = [];

  errors.push(validate(typeof v.id === "string", "id", "string", v.id));
  errors.push(validate(typeof v.editionId === "string", "editionId", "string", v.editionId));
  errors.push(validate(typeof v.familyId === "string", "familyId", "string", v.familyId));
  errors.push(validate(typeof v.publishedAt === "string", "publishedAt", "string", v.publishedAt));
  errors.push(validate(typeof v.publishedBy === "string", "publishedBy", "string", v.publishedBy));
  errors.push(validate(v.snapshotJson && typeof v.snapshotJson === "object", "snapshotJson", "object", v.snapshotJson));

  assertNoErrors(errors.filter(Boolean) as ValidationError[], methodName);
}

// ─── Chart Edition ───
export function assertChartEditionShape(value: unknown, methodName = "assertChartEditionShape"): asserts value is ChartEdition {
  if (!value || typeof value !== "object") {
    throw new Error(`[contract] ${methodName}: expected object, got ${typeof value}`);
  }

  const v = value as Record<string, unknown>;
  const errors: ValidationError[] = [];

  errors.push(validate(typeof v.id === "string", "id", "string", v.id));
  errors.push(validate(typeof v.familyId === "string", "familyId", "string", v.familyId));
  errors.push(validate(typeof v.slug === "string", "slug", "string", v.slug));
  errors.push(validate(typeof v.label === "string", "label", "string", v.label));
  errors.push(validate(typeof v.date === "string", "date", "string", v.date));
  errors.push(validate(typeof v.status === "string", "status", "string", v.status));

  assertNoErrors(errors.filter(Boolean) as ValidationError[], methodName);
}

// ─── Chart Family ───
export function assertChartFamilyShape(value: unknown, methodName = "assertChartFamilyShape"): asserts value is ChartFamily {
  if (!value || typeof value !== "object") {
    throw new Error(`[contract] ${methodName}: expected object, got ${typeof value}`);
  }

  const v = value as Record<string, unknown>;
  const errors: ValidationError[] = [];

  errors.push(validate(typeof v.id === "string", "id", "string", v.id));
  errors.push(validate(typeof v.familyKey === "string", "familyKey", "string", v.familyKey));
  errors.push(validate(typeof v.label === "string", "label", "string", v.label));
  errors.push(validate(typeof v.defaultChartSize === "number", "defaultChartSize", "number", v.defaultChartSize));

  assertNoErrors(errors.filter(Boolean) as ValidationError[], methodName);
}

// ─── Bulk Assertion Helpers ───

export function assertIngestJobArray(value: unknown, methodName = "assertIngestJobArray"): asserts value is IngestJob[] {
  if (!Array.isArray(value)) {
    throw new Error(`[contract] ${methodName}: expected array, got ${typeof value}`);
  }
  for (const item of value) {
    assertIngestJobShape(item, methodName);
  }
}

export function assertSourceArray(value: unknown, methodName = "assertSourceArray"): asserts value is IngestSource[] {
  if (!Array.isArray(value)) {
    throw new Error(`[contract] ${methodName}: expected array, got ${typeof value}`);
  }
  for (const item of value) {
    assertSourceShape(item, methodName);
  }
}

export function assertCandidateArray(value: unknown, methodName = "assertCandidateArray"): asserts value is IngestCandidate[] {
  if (!Array.isArray(value)) {
    throw new Error(`[contract] ${methodName}: expected array, got ${typeof value}`);
  }
  for (const item of value) {
    assertCandidateShape(item, methodName);
  }
}

export function assertIssueArray(value: unknown, methodName = "assertIssueArray"): asserts value is ReviewIssue[] {
  if (!Array.isArray(value)) {
    throw new Error(`[contract] ${methodName}: expected array, got ${typeof value}`);
  }
  for (const item of value) {
    assertIssueShape(item, methodName);
  }
}