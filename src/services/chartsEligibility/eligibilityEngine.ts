import type { IngestExcludedRow } from "../chartsIntelligence/intelligenceTypes";
import type { IngestResolvedRow } from "../chartsIngestion/ingestStudioTypes";
import type { ChartEligibilityDecision, ChartEligibilityProfile, ReleaseTypeEligibility } from "./eligibilityTypes";

export type EligibilityExecutionContext = {
  runId: string;
  market?: string | null;
  profile: ChartEligibilityProfile;
};

export type EligibilityExecutionResult = {
  eligibleRows: IngestResolvedRow[];
  reviewRows: IngestResolvedRow[];
  excludedRows: IngestExcludedRow[];
  allRows: IngestResolvedRow[];
  metrics: {
    profileId: string;
    totalRows: number;
    eligibleRows: number;
    reviewRows: number;
    excludedRows: number;
    warningRows: number;
    eligibilityRate: number;
  };
};

type MutableDecision = ChartEligibilityDecision;

type RowRaw = Record<string, unknown>;

function rawObject(row: IngestResolvedRow): RowRaw {
  return row.raw && typeof row.raw === "object" ? (row.raw as RowRaw) : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

function lowerSet(values: string[] | undefined): Set<string> {
  return new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function isoSet(values: string[] | undefined): Set<string> {
  return new Set((values ?? []).map((value) => value.trim().toUpperCase()).filter(Boolean));
}

function getOriginIso2s(row: IngestResolvedRow): string[] {
  const raw = rawObject(row);
  return [
    stringValue(raw.primaryArtistOriginIso2),
    stringValue(raw.primary_artist_origin_iso2),
    stringValue(raw.artistOriginIso2),
    stringValue(raw.artist_origin_iso2),
    ...stringArray(raw.artistOriginIso2s),
    ...stringArray(raw.artist_origin_iso2s),
    ...stringArray(raw.artistOrigins),
    ...stringArray(raw.artist_origins),
  ].filter((value): value is string => Boolean(value)).map((value) => value.toUpperCase());
}

function getPrimaryOriginIso2(row: IngestResolvedRow): string | null {
  return getOriginIso2s(row)[0] ?? null;
}

function getArtistGender(row: IngestResolvedRow): string | null {
  const raw = rawObject(row);
  return (stringValue(raw.primaryArtistGender) ?? stringValue(raw.artistGender) ?? stringValue(raw.gender))?.toLowerCase() ?? null;
}

function getArtistType(row: IngestResolvedRow): string | null {
  const raw = rawObject(row);
  return (stringValue(raw.primaryArtistType) ?? stringValue(raw.artistType) ?? stringValue(raw.type))?.toLowerCase() ?? null;
}

function getReleaseType(row: IngestResolvedRow): string | null {
  const raw = rawObject(row);
  return (stringValue(raw.releaseType) ?? stringValue(raw.albumType) ?? stringValue(raw.release_type) ?? stringValue(raw.album_type))?.toLowerCase() ?? null;
}

function getReleaseDate(row: IngestResolvedRow): string | null {
  const raw = rawObject(row);
  return stringValue(raw.releaseDate) ?? stringValue(raw.release_date) ?? null;
}

function getDurationMs(row: IngestResolvedRow): number | null {
  const raw = rawObject(row);
  return numberValue(raw.durationMs) ?? numberValue(raw.duration_ms);
}

function hasIsrc(row: IngestResolvedRow): boolean {
  const raw = rawObject(row);
  return Boolean(stringValue(raw.isrc) ?? stringValue(raw.ISRC));
}

function hasPreview(row: IngestResolvedRow): boolean {
  const raw = rawObject(row);
  return Boolean(stringValue(raw.previewUrl) ?? stringValue(raw.preview_url));
}

function hasProviderId(row: IngestResolvedRow): boolean {
  const raw = rawObject(row);
  return Boolean(
    stringValue(raw.providerTrackId) ??
      stringValue(raw.trackId) ??
      stringValue(raw.providerReleaseId) ??
      stringValue(raw.releaseId) ??
      row.canonicalTrackId ??
      row.canonicalReleaseId
  );
}

function hasMarketAvailability(row: IngestResolvedRow, market: string | null | undefined): boolean | null {
  if (!market) return null;
  const raw = rawObject(row);
  const marketKey = market.toUpperCase();
  const available = stringArray(raw.availableMarkets).map((item) => item.toUpperCase());
  const restricted = stringArray(raw.restrictedMarkets).map((item) => item.toUpperCase());
  if (available.length > 0) return available.includes(marketKey);
  if (restricted.length > 0) return !restricted.includes(marketKey);
  return null;
}

function addFailure(decision: MutableDecision, code: string, message: string): void {
  decision.reasonCodes.push(code);
  decision.reasonMessages.push(message);
}

function addReview(decision: MutableDecision, code: string, message: string, allowUnknownWithWarning: boolean): void {
  decision.requiresReview = true;
  if (allowUnknownWithWarning) decision.warnings.push(message);
  else addFailure(decision, code, message);
}

function buildDecision(profileId: string): ChartEligibilityDecision {
  return {
    eligible: true,
    profileId,
    reasonCodes: [],
    reasonMessages: [],
    warnings: [],
    requiresReview: false,
  };
}

function evaluateRequiredBasics(row: IngestResolvedRow, decision: MutableDecision): void {
  if (!row.title.trim()) addFailure(decision, "missing_title", "Track title is missing.");
  if (!row.artistNames.length) addFailure(decision, "missing_artist_credits", "Artist credits are missing.");
}

function evaluateSourceRules(row: IngestResolvedRow, profile: ChartEligibilityProfile, decision: MutableDecision, market?: string | null): void {
  const sourceRules = profile.sourceRules;
  const allowUnknown = profile.reviewRules?.allowUnknownMetadataWithWarning ?? true;
  if (!sourceRules) return;

  if (sourceRules.allowedProviders?.length) {
    const allowed = lowerSet(sourceRules.allowedProviders);
    if (!allowed.has(row.sourceProvider)) addFailure(decision, "provider_not_allowed", `${row.sourceProvider} is not allowed for this eligibility profile.`);
  }
  if (sourceRules.requireAtLeastOneProviderId && !hasProviderId(row)) addFailure(decision, "missing_provider_id", "A provider track/release ID is required.");
  if (sourceRules.requireProviderAvailabilityInMarket) {
    const available = hasMarketAvailability(row, market);
    if (available === false) addFailure(decision, "not_available_in_market", `Provider metadata says this row is not available in ${market}.`);
    if (available === null) addReview(decision, "unknown_market_availability", "Market availability is unknown and requires review.", allowUnknown);
  }
}

function evaluateArtistOrigin(row: IngestResolvedRow, profile: ChartEligibilityProfile, decision: MutableDecision): void {
  const origin = profile.artistOriginEligibility;
  if (!origin || origin.mode === "any") return;

  const allowUnknown = profile.reviewRules?.allowUnknownMetadataWithWarning ?? true;
  const allowedCountries = isoSet(origin.countries);
  const primaryOrigin = getPrimaryOriginIso2(row);
  const rowOrigins = getOriginIso2s(row);
  const collaborationRules = profile.collaborationRules;
  const allArtistsMustMatch = collaborationRules?.allArtistsMustMatchEligibility ?? false;
  const primaryMustMatch = collaborationRules?.primaryArtistMustMatchEligibility ?? true;
  const minEligible = collaborationRules?.minEligibleArtistsRequired;
  const eligibleCount = rowOrigins.filter((iso2) => allowedCountries.has(iso2)).length;

  if (!primaryOrigin && (profile.reviewRules?.requireManualReviewForUnknownNationality ?? false)) {
    addReview(decision, "unknown_artist_origin", "Artist origin is unknown and requires review.", allowUnknown);
    return;
  }

  if (allowedCountries.size === 0) return;
  if (primaryMustMatch && primaryOrigin && !allowedCountries.has(primaryOrigin)) {
    addFailure(decision, "primary_artist_origin_not_allowed", `Primary artist origin ${primaryOrigin} is outside allowed countries: ${Array.from(allowedCountries).join(", ")}.`);
  }
  if (allArtistsMustMatch && rowOrigins.length > 0 && rowOrigins.some((iso2) => !allowedCountries.has(iso2))) {
    addFailure(decision, "artist_origin_not_allowed", `One or more artist origins are outside allowed countries: ${Array.from(allowedCountries).join(", ")}.`);
  }
  if (typeof minEligible === "number" && eligibleCount < minEligible) {
    addFailure(decision, "minimum_eligible_artists_not_met", `Requires at least ${minEligible} eligible artist(s), found ${eligibleCount}.`);
  }
}

function evaluateArtistGender(row: IngestResolvedRow, profile: ChartEligibilityProfile, decision: MutableDecision): void {
  const gender = profile.artistGenderEligibility;
  if (!gender || gender.mode === "any") return;

  const allowUnknown = profile.reviewRules?.allowUnknownMetadataWithWarning ?? true;
  const rowGender = getArtistGender(row);
  if (!rowGender && (profile.reviewRules?.requireManualReviewForUnknownGender ?? false)) {
    addReview(decision, "unknown_artist_gender", "Artist gender is unknown and requires review.", allowUnknown);
  } else if (gender.mode === "female_only" && rowGender && rowGender !== "female") {
    addFailure(decision, "artist_gender_not_allowed", `Artist gender ${rowGender} is not allowed; female artist required.`);
  } else if (gender.mode === "male_only" && rowGender && rowGender !== "male") {
    addFailure(decision, "artist_gender_not_allowed", `Artist gender ${rowGender} is not allowed; male artist required.`);
  } else if (gender.mode === "mixed_gender_only" && rowGender && !["mixed", "mixed_gender"].includes(rowGender)) {
    addFailure(decision, "artist_gender_not_allowed", "Mixed-gender act required.");
  }
}

function evaluateArtistType(row: IngestResolvedRow, profile: ChartEligibilityProfile, decision: MutableDecision): void {
  const artistType = profile.artistTypeEligibility;
  if (!artistType || artistType.mode === "any") return;

  const allowUnknown = profile.reviewRules?.allowUnknownMetadataWithWarning ?? true;
  const rowArtistType = getArtistType(row);
  const groupTypes = new Set(["group", "collective", "band", "duo"]);
  if (!rowArtistType && (profile.reviewRules?.requireManualReviewForUnknownArtistType ?? false)) {
    addReview(decision, "unknown_artist_type", "Artist type is unknown and requires review.", allowUnknown);
  } else if (artistType.mode === "solo_artists_only" && rowArtistType && rowArtistType !== "solo") {
    addFailure(decision, "artist_type_not_allowed", `Artist type ${rowArtistType} is not allowed; solo artist required.`);
  } else if (artistType.mode === "groups_collectives_only" && rowArtistType && !groupTypes.has(rowArtistType)) {
    addFailure(decision, "artist_type_not_allowed", `Artist type ${rowArtistType} is not allowed; group/collective required.`);
  } else if (artistType.mode === "bands_only" && rowArtistType && rowArtistType !== "band") {
    addFailure(decision, "artist_type_not_allowed", "Band required.");
  } else if (artistType.mode === "duos_only" && rowArtistType && rowArtistType !== "duo") {
    addFailure(decision, "artist_type_not_allowed", "Duo required.");
  }
}

function evaluateRelease(row: IngestResolvedRow, profile: ChartEligibilityProfile, decision: MutableDecision): void {
  const release = profile.releaseEligibility;
  if (!release) return;

  const rowReleaseType = getReleaseType(row) as ReleaseTypeEligibility | null;
  const allowedReleaseTypes = lowerSet(release.releaseTypes);
  if (rowReleaseType && allowedReleaseTypes.size > 0 && !allowedReleaseTypes.has(rowReleaseType)) {
    addFailure(decision, "release_type_not_allowed", `Release type ${rowReleaseType} is not allowed.`);
  }

  const releaseDate = getReleaseDate(row);
  if (release.releaseWindowFrom && releaseDate && releaseDate < release.releaseWindowFrom) {
    addFailure(decision, "release_window_too_early", `Release date ${releaseDate} is earlier than ${release.releaseWindowFrom}.`);
  }
  if (release.releaseWindowTo && releaseDate && releaseDate > release.releaseWindowTo) {
    addFailure(decision, "release_window_too_late", `Release date ${releaseDate} is later than ${release.releaseWindowTo}.`);
  }
  if ((release.releaseWindowFrom || release.releaseWindowTo) && !releaseDate) {
    decision.warnings.push("Release date is unknown; date-window eligibility could not be fully verified.");
  }
}

function evaluateTrack(row: IngestResolvedRow, profile: ChartEligibilityProfile, decision: MutableDecision): void {
  const track = profile.trackEligibility;
  if (!track) return;

  const raw = rawObject(row);
  const explicit = booleanValue(raw.explicit);
  if (track.explicitAllowed === false && explicit === true) addFailure(decision, "explicit_track_not_allowed", "Explicit tracks are not allowed for this eligibility profile.");

  const durationMs = getDurationMs(row);
  if (track.minDurationMs && durationMs !== null && durationMs < track.minDurationMs) addFailure(decision, "track_duration_too_short", `Track duration is below ${track.minDurationMs}ms.`);
  if (track.maxDurationMs && durationMs !== null && durationMs > track.maxDurationMs) addFailure(decision, "track_duration_too_long", `Track duration is above ${track.maxDurationMs}ms.`);
  if (track.requireIsrc && !hasIsrc(row)) addFailure(decision, "missing_isrc", "ISRC is required.");
  if (track.requirePreview && !hasPreview(row)) addFailure(decision, "missing_preview", "Preview URL is required.");

  const genre = stringValue(raw.genre)?.toLowerCase() ?? stringArray(raw.genreNames)[0]?.toLowerCase();
  if (genre && track.allowedGenres?.length && !lowerSet(track.allowedGenres).has(genre)) addFailure(decision, "genre_not_allowed", `Genre ${genre} is not allowed.`);
  if (genre && track.excludedGenres?.length && lowerSet(track.excludedGenres).has(genre)) addFailure(decision, "genre_excluded", `Genre ${genre} is explicitly excluded.`);
}

export function evaluateRowEligibility(row: IngestResolvedRow, profile: ChartEligibilityProfile, market?: string | null): ChartEligibilityDecision {
  const decision = buildDecision(profile.id);
  evaluateRequiredBasics(row, decision);
  evaluateSourceRules(row, profile, decision, market);
  evaluateArtistOrigin(row, profile, decision);
  evaluateArtistGender(row, profile, decision);
  evaluateArtistType(row, profile, decision);
  evaluateRelease(row, profile, decision);
  evaluateTrack(row, profile, decision);
  decision.eligible = decision.reasonCodes.length === 0;
  return decision;
}

function toExcludedRow(runId: string, row: IngestResolvedRow, decision: ChartEligibilityDecision): IngestExcludedRow {
  const primaryCode = decision.reasonCodes[0] ?? "eligibility_failed";
  const primaryMessage = decision.reasonMessages[0] ?? "Row failed eligibility checks.";
  return {
    id: `excluded_${runId}_${row.id}`,
    runId,
    sourceRowId: row.id,
    rank: row.rank,
    title: row.title,
    artists: row.artistNames,
    reasonCode: primaryCode,
    reasonMessage: primaryMessage,
    eligibilityProfileId: decision.profileId,
    metadataSnapshot: {
      sourceProvider: row.sourceProvider,
      matchStatus: row.matchStatus,
      confidence: row.confidence,
      raw: row.raw ?? null,
      allReasonCodes: decision.reasonCodes,
      allReasonMessages: decision.reasonMessages,
      warnings: decision.warnings,
      requiresReview: decision.requiresReview,
    },
    createdAt: new Date().toISOString(),
  };
}

export function executeEligibility(rows: IngestResolvedRow[], context: EligibilityExecutionContext): EligibilityExecutionResult {
  const allRows = rows.map((row) => {
    const decision = evaluateRowEligibility(row, context.profile, context.market);
    return {
      ...row,
      eligibilityDecision: decision,
      warnings: [...(row.warnings ?? []), ...decision.warnings],
    };
  });

  const excludedRows = allRows
    .filter((row) => row.eligibilityDecision && !row.eligibilityDecision.eligible)
    .map((row) => toExcludedRow(context.runId, row, row.eligibilityDecision!));

  const reviewRows = allRows.filter((row) => row.eligibilityDecision?.requiresReview);
  const eligibleRows = allRows.filter((row) => row.eligibilityDecision?.eligible);
  const warningRows = allRows.filter((row) => (row.eligibilityDecision?.warnings.length ?? 0) > 0);

  return {
    eligibleRows,
    reviewRows,
    excludedRows,
    allRows,
    metrics: {
      profileId: context.profile.id,
      totalRows: allRows.length,
      eligibleRows: eligibleRows.length,
      reviewRows: reviewRows.length,
      excludedRows: excludedRows.length,
      warningRows: warningRows.length,
      eligibilityRate: allRows.length ? (eligibleRows.length / allRows.length) * 100 : 0,
    },
  };
}
