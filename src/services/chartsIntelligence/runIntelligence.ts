import type { ChartEligibilityDecision } from "../chartsEligibility/eligibilityTypes";
import type { IngestResolvedRow, IngestRun } from "../chartsIngestion/ingestStudioTypes";
import { evaluateCommercialReadiness } from "./commercialReadiness";
import type {
  IngestExcludedRow,
  IngestRowIntelligence,
  IngestRunIntelligence,
  RelationalArtistCredit,
  RichTrackMetadata,
} from "./intelligenceTypes";

function normalizeName(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ");
}

function parseProviderRaw(row: IngestResolvedRow): Record<string, unknown> {
  return row.raw && typeof row.raw === "object" ? (row.raw as Record<string, unknown>) : {};
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return items.length ? items : undefined;
}

function toNumber(value: unknown): number | null | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function toBoolean(value: unknown): boolean | null | undefined {
  if (typeof value === "boolean") return value;
  return undefined;
}

function toString(value: unknown): string | null | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function buildRichTrackMetadata(row: IngestResolvedRow): RichTrackMetadata {
  const raw = parseProviderRaw(row);
  const providerTrackId = toString(raw.providerTrackId) ?? toString(raw.trackId);
  const providerReleaseId = toString(raw.providerReleaseId) ?? toString(raw.albumId) ?? toString(raw.releaseId);
  const providerArtistIds = toStringArray(raw.providerArtistIds) ?? toStringArray(raw.artistIds) ?? [];
  const externalUrl = toString(raw.externalUrl) ?? toString(raw.url);

  return {
    title: row.title,
    normalizedTitle: normalizeName(row.title),
    canonicalTrackId: row.canonicalTrackId ?? null,
    canonicalReleaseId: row.canonicalReleaseId ?? null,
    isrc: toString(raw.isrc),
    upc: toString(raw.upc),
    durationMs: toNumber(raw.durationMs) ?? toNumber(raw.duration_ms),
    explicit: toBoolean(raw.explicit),
    trackNumber: toNumber(raw.trackNumber) ?? toNumber(raw.track_number),
    discNumber: toNumber(raw.discNumber) ?? toNumber(raw.disc_number),
    releaseDate: toString(raw.releaseDate) ?? toString(raw.release_date),
    releaseDatePrecision: (toString(raw.releaseDatePrecision) as RichTrackMetadata["releaseDatePrecision"]) ?? "unknown",
    releaseTitle: toString(raw.releaseTitle) ?? toString(raw.albumTitle) ?? null,
    releaseType: (toString(raw.releaseType) as RichTrackMetadata["releaseType"]) ?? "unknown",
    labelName: toString(raw.labelName) ?? toString(raw.label) ?? null,
    albumArtworkUrl: toString(raw.albumArtworkUrl) ?? null,
    trackArtworkUrl: row.artworkUrl ?? toString(raw.trackArtworkUrl) ?? null,
    previewUrl: toString(raw.previewUrl) ?? null,
    providerIds: [
      {
        provider: row.sourceProvider,
        trackId: providerTrackId ?? null,
        releaseId: providerReleaseId ?? null,
        artistIds: providerArtistIds,
        isrc: toString(raw.isrc) ?? null,
        upc: toString(raw.upc) ?? null,
        externalUrl: externalUrl ?? null,
        payloadHash: toString(raw.payloadHash) ?? null,
      },
    ],
    providerUrls: externalUrl ? [{ provider: row.sourceProvider, url: externalUrl }] : [],
    availableMarkets: toStringArray(raw.availableMarkets),
    restrictedMarkets: toStringArray(raw.restrictedMarkets),
    providerPayloads: [
      {
        provider: row.sourceProvider,
        capturedAt: new Date().toISOString(),
        payloadHash: toString(raw.payloadHash) ?? null,
        rawPayload: row.raw,
      },
    ],
  };
}

export function buildRelationalArtistCredits(row: IngestResolvedRow): RelationalArtistCredit[] {
  return row.artistNames.map((name, index) => ({
    id: `${row.id}:artist:${index + 1}`,
    displayName: name,
    normalizedName: normalizeName(name),
    role: index === 0 ? "primary_artist" : "featured_artist",
    creditOrder: index + 1,
    canonicalArtistId: row.canonicalArtistIds?.[index] ?? null,
    providerArtistIds: [],
    confidence: row.canonicalArtistIds?.[index] ? 0.85 : 0.35,
    reviewStatus: row.canonicalArtistIds?.[index] ? "resolved" : "needs_review",
    sourceProvider: row.sourceProvider,
    sourceText: name,
    warnings: /,| feat\.? | ft\.? | featuring | x | with | & /i.test(name)
      ? ["Possible collaboration string. Requires relational credit review before commercial publishing."]
      : [],
  }));
}

export function buildDefaultEligibilityDecision(row: IngestResolvedRow, profileId?: string | null): ChartEligibilityDecision {
  const reasonCodes: string[] = [];
  const reasonMessages: string[] = [];
  const warnings: string[] = [];

  if (!row.title) {
    reasonCodes.push("missing_title");
    reasonMessages.push("Track title is missing.");
  }

  if (!row.artistNames.length) {
    reasonCodes.push("missing_artists");
    reasonMessages.push("Artist credits are missing.");
  }

  if (row.matchStatus === "no_match" || row.matchStatus === "needs_review") {
    warnings.push(`Row has match status ${row.matchStatus}; eligibility should be reviewed once canonical resolution is complete.`);
  }

  return {
    eligible: reasonCodes.length === 0,
    profileId: profileId ?? "unknown_profile",
    reasonCodes,
    reasonMessages,
    warnings,
    requiresReview: warnings.length > 0,
  };
}

export function buildExcludedRow(run: IngestRun, row: IngestResolvedRow, decision: ChartEligibilityDecision): IngestExcludedRow | null {
  if (decision.eligible) return null;

  return {
    id: `${run.id}:excluded:${row.id}`,
    runId: run.id,
    sourceRowId: row.id,
    rank: row.rank,
    title: row.title,
    artists: row.artistNames,
    reasonCode: decision.reasonCodes[0] ?? "eligibility_failed",
    reasonMessage: decision.reasonMessages[0] ?? "Row failed eligibility checks.",
    eligibilityProfileId: decision.profileId,
    metadataSnapshot: {
      matchStatus: row.matchStatus,
      confidence: row.confidence,
      sourceProvider: row.sourceProvider,
      sourceUrl: row.sourceUrl,
      warnings: row.warnings ?? [],
      raw: row.raw,
    },
    createdAt: new Date().toISOString(),
  };
}

export function assembleIngestRunIntelligence(
  run: IngestRun,
  options: { marketScopeId?: string | null; marketScopeSnapshot?: Record<string, unknown> | null } = {}
): IngestRunIntelligence {
  const rowIntelligence: Record<string, IngestRowIntelligence> = {};
  const excludedRows: IngestExcludedRow[] = [];

  for (const row of run.rows) {
    const richMetadata = buildRichTrackMetadata(row);
    const artistCredits = buildRelationalArtistCredits(row);
    const eligibilityDecision = buildDefaultEligibilityDecision(row, run.eligibilityProfileId);
    const excludedRow = buildExcludedRow(run, row, eligibilityDecision);

    if (excludedRow) excludedRows.push(excludedRow);

    rowIntelligence[row.id] = {
      rowId: row.id,
      richMetadata,
      artistCredits,
      eligibilityDecision,
      excludedRow,
    };
  }

  return {
    marketScopeId: options.marketScopeId ?? null,
    marketScopeSnapshot: options.marketScopeSnapshot ?? null,
    enrichmentOptions: null,
    excludedRows,
    commercialReadiness: evaluateCommercialReadiness(run),
    rowIntelligence,
  };
}
