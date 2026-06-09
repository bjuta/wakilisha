import type { IngestResolvedRow } from "@/services/chartsIngestion/ingestStudioTypes";

export type EnrichmentDecisionStatus = "draft" | "approved" | "rejected" | "needs_review" | "applied" | "superseded";

export interface ProviderFieldObservationReviewItem {
  id: string;
  providerItemId: string | null;
  entityType: "release" | "track" | "artist";
  fieldName: string;
  fieldValue: string | null;
  provider: string;
  confidenceScore: number;
  sourcePath: string;
  createdAt?: string | null;
}

export interface RegistryEnrichmentSuggestionReviewItem {
  id: string;
  registryEntityType: "release" | "track" | "artist";
  registryEntityId: string;
  fieldName: string;
  currentValue: string | null;
  suggestedValue: string;
  providerItemId: string | null;
  confidenceScore: number;
  decisionStatus: EnrichmentDecisionStatus;
  createdAt?: string | null;
}

export interface ProviderEntityLinkReviewItem {
  id: string;
  registryEntityType: "release" | "track" | "artist";
  registryEntityId: string;
  provider: string;
  providerEntityId: string;
  providerUrl: string | null;
  matchStatus: "candidate" | "confirmed" | "rejected";
  confidenceScore: number;
  createdAt?: string | null;
}

export interface ReleaseShellLifecycleSnapshot {
  status: "open" | "resolved" | "reopened";
  reason: string | null;
  actor: string;
  createdAt: string | null;
}

export interface ReleaseShellEnrichmentContext {
  shellKey: string;
  registryEntityId: string;
  dataSource: "runtime_api" | "fallback";
  lifecycle: ReleaseShellLifecycleSnapshot;
  observations: ProviderFieldObservationReviewItem[];
  suggestions: RegistryEnrichmentSuggestionReviewItem[];
  providerLinks: ProviderEntityLinkReviewItem[];
}

export interface CanonicalWriteAuditEvent {
  id: string;
  registryEntityType: string;
  registryEntityId: string;
  sourceSuggestionId: string | null;
  sourceTable: string;
  fieldName: string;
  targetPath: string;
  beforeValue: unknown;
  afterValue: unknown;
  action: string;
  status: "applied" | "skipped" | "failed" | string;
  errorMessage: string | null;
  actor: string;
  createdAt: string;
}

export interface ReleaseShellEnrichmentLookupInput {
  shellKey: string;
  registryEntityId: string | null;
  title: string;
  artistDisplayName: string;
  sourceSurface: string;
  confidenceScore: number;
}

export interface RegistryReleaseShellReviewRow extends IngestResolvedRow {
  shellKey: string;
  sourceSurface: "registry";
  sourceRunId: string;
  sourceRunTitle: string;
  sourceEditionDate: string;
}

interface RuntimeApiResponse {
  contexts?: ReleaseShellEnrichmentContext[];
  data?: {
    contexts?: ReleaseShellEnrichmentContext[];
  };
}

const RUNTIME_API_PATH = "/__wakilisha-v2-api/api/v1/registry/enrichment-review/release-shells";

function getSuggestionValue(context: ReleaseShellEnrichmentContext, fieldName: string): string | null {
  return context.suggestions.find((suggestion) => suggestion.fieldName === fieldName)?.suggestedValue ?? null;
}

function normalizeConfidence(value: number): number {
  if (value > 1) return Math.max(0, Math.min(1, value / 100));
  return Math.max(0, Math.min(1, value));
}

function toPercentConfidence(value: number): number {
  return Math.round(normalizeConfidence(value) * 100);
}

function extractContexts(payload: RuntimeApiResponse): ReleaseShellEnrichmentContext[] {
  return payload.contexts ?? payload.data?.contexts ?? [];
}

export async function getLiveReleaseShellReviewRows(options: { includeResolved?: boolean } = {}): Promise<{
  shells: RegistryReleaseShellReviewRow[];
  contexts: Record<string, ReleaseShellEnrichmentContext>;
}> {
  const query = options.includeResolved ? "?includeResolved=1" : "";
  const response = await fetch(`${RUNTIME_API_PATH}${query}`, { method: "GET" });
  if (!response.ok) {
    return { shells: [], contexts: {} };
  }

  const payload = (await response.json()) as RuntimeApiResponse;
  const contexts = extractContexts(payload);

  const shells = contexts.map((context, index): RegistryReleaseShellReviewRow => {
    const providerLink = context.providerLinks[0];
    const title = getSuggestionValue(context, "title") ?? getSuggestionValue(context, "release_title") ?? `Release ${context.registryEntityId}`;
    const artistDisplayName = getSuggestionValue(context, "artist_display_name") ?? getSuggestionValue(context, "artist_name") ?? "";
    const artworkUrl = getSuggestionValue(context, "artwork_url");
    const confidence = context.suggestions[0]?.confidenceScore ?? providerLink?.confidenceScore ?? 0.8;

    return {
      id: context.registryEntityId,
      shellKey: context.shellKey,
      rank: index + 1,
      sourceProvider: providerLink?.provider === "spotify" ? "spotify" : "apple_music",
      sourceUrl: providerLink?.providerUrl ?? "",
      title,
      artistNames: artistDisplayName ? [artistDisplayName] : [],
      artworkUrl,
      matchStatus: "shell",
      confidence: toPercentConfidence(confidence),
      releaseShellId: context.registryEntityId,
      sourceSurface: "registry",
      sourceRunId: "registry-enrichment-review",
      sourceRunTitle: "Live Phase 8C staging",
      sourceEditionDate: "live",
      raw: context,
    };
  });

  return {
    shells,
    contexts: Object.fromEntries(contexts.map((context) => [context.shellKey, context])),
  };
}

export async function getReleaseShellEnrichmentContexts(
  shells: ReleaseShellEnrichmentLookupInput[],
): Promise<Record<string, ReleaseShellEnrichmentContext>> {
  if (shells.length === 0) return {};

  try {
    const response = await fetch(RUNTIME_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shells }),
    });

    if (!response.ok) return {};

    const payload = (await response.json()) as RuntimeApiResponse;
    const contexts = extractContexts(payload);
    if (!Array.isArray(contexts)) return {};

    return Object.fromEntries(contexts.map((context) => [context.shellKey, context]));
  } catch {
    return {};
  }
}



export interface ApplyApprovedReleaseShellSuggestionPreviewItem {
  suggestionId: string;
  fieldName: string;
  targetPath: string;
  currentValue: string | null;
  proposedValue: string;
  writable: boolean;
  reason: string | null;
}

export interface ApplyApprovedReleaseShellSuggestionsPreview {
  registryEntityId: string;
  canonicalReleaseExists: boolean;
  willCreateCanonicalRelease: boolean;
  writable: ApplyApprovedReleaseShellSuggestionPreviewItem[];
  skipped: ApplyApprovedReleaseShellSuggestionPreviewItem[];
}


export interface ApplyApprovedReleaseShellSuggestionsResult {
  registryEntityId: string;
  applied: Array<{ suggestionId: string; fieldName: string; target: string }>;
  skipped: Array<{ suggestionId: string; fieldName: string; reason: string }>;
  failed: Array<{ registryEntityId: string; reason: string }>;
}


export async function previewApprovedReleaseShellSuggestions(
  registryEntityId: string,
): Promise<ApplyApprovedReleaseShellSuggestionsPreview> {
  const response = await fetch(`${RUNTIME_API_PATH}/preview-apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ registryEntityId }),
  });

  const payload = (await response.json()) as {
    data?: ApplyApprovedReleaseShellSuggestionsPreview;
    message?: string;
  } & Partial<ApplyApprovedReleaseShellSuggestionsPreview>;

  const preview = payload.data ?? payload;

  if (!response.ok) {
    throw new Error(payload.message ?? "Failed to preview approved suggestions.");
  }

  return preview as ApplyApprovedReleaseShellSuggestionsPreview;
}


export async function applyApprovedReleaseShellSuggestions(
  registryEntityId: string,
): Promise<ApplyApprovedReleaseShellSuggestionsResult> {
  const response = await fetch(`${RUNTIME_API_PATH}/apply-approved`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ registryEntityId }),
  });

  const payload = (await response.json()) as {
    data?: ApplyApprovedReleaseShellSuggestionsResult;
  } & Partial<ApplyApprovedReleaseShellSuggestionsResult>;

  const result = payload.data ?? payload;

  if (!response.ok) {
    const reason = result.failed?.[0]?.reason ?? "Failed to apply approved suggestions.";
    throw new Error(reason);
  }

  return result as ApplyApprovedReleaseShellSuggestionsResult;
}




export async function updateReleaseShellLifecycleStatus(
  registryEntityId: string,
  status: "resolved" | "reopened",
  reason = "",
): Promise<ReleaseShellLifecycleSnapshot> {
  const response = await fetch(`${RUNTIME_API_PATH}/${encodeURIComponent(registryEntityId)}/lifecycle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, reason }),
  });

  const payload = (await response.json()) as {
    data?: {
      lifecycle?: ReleaseShellLifecycleSnapshot;
    };
    lifecycle?: ReleaseShellLifecycleSnapshot;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message ?? "Failed to update release shell lifecycle.");
  }

  const lifecycle = payload.data?.lifecycle ?? payload.lifecycle;
  if (!lifecycle) throw new Error("Lifecycle update returned no lifecycle payload.");

  return lifecycle;
}


export async function getReleaseShellCanonicalWriteAuditEvents(
  registryEntityId: string,
): Promise<CanonicalWriteAuditEvent[]> {
  const response = await fetch(`${RUNTIME_API_PATH}/${encodeURIComponent(registryEntityId)}/audit`, {
    method: "GET",
  });

  if (!response.ok) return [];

  const payload = (await response.json()) as {
    data?: {
      events?: CanonicalWriteAuditEvent[];
    };
    events?: CanonicalWriteAuditEvent[];
  };

  return payload.data?.events ?? payload.events ?? [];
}


export function formatConfidence(value: number): string {
  return `${Math.round(normalizeConfidence(value) * 100)}%`;
}
