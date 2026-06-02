import type { ChartEligibilityDecision } from "../chartsEligibility/eligibilityTypes";
import type { IngestEnrichmentOptions } from "../chartsEnrichment/enrichmentOptions";

export type ProviderKey = "spotify" | "apple_music" | "youtube" | "acrcloud" | "airplay" | "manual" | "registry";

export type ProviderIdentifierSet = {
  provider: ProviderKey;
  trackId?: string | null;
  releaseId?: string | null;
  artistIds?: string[];
  isrc?: string | null;
  upc?: string | null;
  externalUrl?: string | null;
  payloadHash?: string | null;
};

export type ProviderPayloadSnapshot = {
  provider: ProviderKey;
  capturedAt: string;
  payloadHash?: string | null;
  rawPayload?: unknown;
};

export type RichTrackMetadata = {
  title: string;
  normalizedTitle?: string;
  canonicalTrackId?: string | null;
  canonicalReleaseId?: string | null;
  isrc?: string | null;
  upc?: string | null;
  durationMs?: number | null;
  explicit?: boolean | null;
  trackNumber?: number | null;
  discNumber?: number | null;
  releaseDate?: string | null;
  releaseDatePrecision?: "year" | "month" | "day" | "unknown";
  releaseTitle?: string | null;
  releaseType?: "single" | "ep" | "album" | "mixtape" | "compilation" | "video" | "live" | "unknown";
  labelName?: string | null;
  albumArtworkUrl?: string | null;
  trackArtworkUrl?: string | null;
  previewUrl?: string | null;
  providerIds: ProviderIdentifierSet[];
  providerUrls: Array<{ provider: ProviderKey; url: string }>;
  availableMarkets?: string[];
  restrictedMarkets?: string[];
  providerPayloads?: ProviderPayloadSnapshot[];
};

export type ArtistCreditRole =
  | "primary_artist"
  | "featured_artist"
  | "collaborator"
  | "producer"
  | "composer"
  | "remixer"
  | "group_member"
  | "unknown";

export type ArtistCreditReviewStatus = "resolved" | "needs_review" | "split_required" | "blocked" | "ignored";

export type RelationalArtistCredit = {
  id: string;
  displayName: string;
  normalizedName?: string;
  role: ArtistCreditRole;
  creditOrder: number;
  canonicalArtistId?: string | null;
  providerArtistIds?: ProviderIdentifierSet[];
  confidence: number;
  reviewStatus: ArtistCreditReviewStatus;
  sourceProvider?: ProviderKey | null;
  sourceText?: string | null;
  warnings?: string[];
};

export type IngestExcludedRow = {
  id: string;
  runId: string;
  sourceRowId?: string | null;
  rank?: number | null;
  title: string;
  artists: string[];
  reasonCode: string;
  reasonMessage: string;
  eligibilityProfileId: string;
  metadataSnapshot: Record<string, unknown>;
  createdAt: string;
};

export type CommercialReadinessCheckKey =
  | "top_entries_have_artwork"
  | "top_entries_have_preview"
  | "canonical_artists_resolved"
  | "clean_artist_credits"
  | "public_urls_available"
  | "metadata_completeness"
  | "sponsor_safe"
  | "source_coverage_complete"
  | "snapshot_integrity_ready";

export type CommercialReadinessSeverity = "info" | "warning" | "blocking";

export type CommercialReadinessCheck = {
  key: CommercialReadinessCheckKey;
  passed: boolean;
  severity: CommercialReadinessSeverity;
  label: string;
  message: string;
  affectedRowIds?: string[];
};

export type CommercialReadinessReport = {
  score: number;
  publishable: boolean;
  checkedAt: string;
  checks: CommercialReadinessCheck[];
  blockingReasons: string[];
  warnings: string[];
};

export type IngestRowIntelligence = {
  rowId: string;
  richMetadata?: RichTrackMetadata;
  artistCredits?: RelationalArtistCredit[];
  eligibilityDecision?: ChartEligibilityDecision;
  commercialReadiness?: CommercialReadinessCheck[];
  excludedRow?: IngestExcludedRow | null;
};

export type IngestRunIntelligence = {
  marketScopeId?: string | null;
  marketScopeSnapshot?: Record<string, unknown> | null;
  enrichmentOptions?: IngestEnrichmentOptions | null;
  excludedRows: IngestExcludedRow[];
  commercialReadiness?: CommercialReadinessReport | null;
  rowIntelligence: Record<string, IngestRowIntelligence>;
};
