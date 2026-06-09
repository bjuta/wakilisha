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

export interface ReleaseShellEnrichmentContext {
  shellKey: string;
  registryEntityId: string;
  dataSource: "runtime_api" | "fallback";
  observations: ProviderFieldObservationReviewItem[];
  suggestions: RegistryEnrichmentSuggestionReviewItem[];
  providerLinks: ProviderEntityLinkReviewItem[];
}

export interface ReleaseShellEnrichmentLookupInput {
  shellKey: string;
  registryEntityId: string | null;
  title: string;
  artistDisplayName: string;
  sourceSurface: string;
  confidenceScore: number;
}

interface RuntimeApiResponse {
  contexts?: ReleaseShellEnrichmentContext[];
}

const RUNTIME_API_PATH = "/api/registry/enrichment-review/release-shells";

export async function getReleaseShellEnrichmentContexts(
  shells: ReleaseShellEnrichmentLookupInput[],
): Promise<Record<string, ReleaseShellEnrichmentContext>> {
  if (shells.length === 0) return {};

  const runtimeContexts = await tryFetchRuntimeContexts(shells);
  if (runtimeContexts) return runtimeContexts;

  return Object.fromEntries(shells.map((shell) => [shell.shellKey, buildFallbackContext(shell)]));
}

async function tryFetchRuntimeContexts(
  shells: ReleaseShellEnrichmentLookupInput[],
): Promise<Record<string, ReleaseShellEnrichmentContext> | null> {
  try {
    const response = await fetch(RUNTIME_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shells }),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as RuntimeApiResponse;
    if (!Array.isArray(payload.contexts)) return null;

    return Object.fromEntries(payload.contexts.map((context) => [context.shellKey, context]));
  } catch {
    return null;
  }
}

function buildFallbackContext(shell: ReleaseShellEnrichmentLookupInput): ReleaseShellEnrichmentContext {
  const registryEntityId = shell.registryEntityId ?? shell.shellKey;

  return {
    shellKey: shell.shellKey,
    registryEntityId,
    dataSource: "fallback",
    observations: [
      {
        id: `${shell.shellKey}-obs-title`,
        providerItemId: registryEntityId,
        entityType: "release",
        fieldName: "title",
        fieldValue: shell.title,
        provider: shell.sourceSurface,
        confidenceScore: normalizeConfidence(shell.confidenceScore),
        sourcePath: "release_shell.title",
      },
      {
        id: `${shell.shellKey}-obs-artist`,
        providerItemId: registryEntityId,
        entityType: "release",
        fieldName: "artist_display_name",
        fieldValue: shell.artistDisplayName,
        provider: shell.sourceSurface,
        confidenceScore: normalizeConfidence(Math.max(55, shell.confidenceScore - 5)),
        sourcePath: "release_shell.artistNames",
      },
    ],
    suggestions: [
      {
        id: `${shell.shellKey}-suggestion-title`,
        registryEntityType: "release",
        registryEntityId,
        fieldName: "title",
        currentValue: null,
        suggestedValue: shell.title,
        providerItemId: registryEntityId,
        confidenceScore: normalizeConfidence(shell.confidenceScore),
        decisionStatus: "draft",
      },
      {
        id: `${shell.shellKey}-suggestion-artist`,
        registryEntityType: "release",
        registryEntityId,
        fieldName: "artist_display_name",
        currentValue: null,
        suggestedValue: shell.artistDisplayName,
        providerItemId: registryEntityId,
        confidenceScore: normalizeConfidence(Math.max(55, shell.confidenceScore - 5)),
        decisionStatus: "draft",
      },
      {
        id: `${shell.shellKey}-suggestion-source`,
        registryEntityType: "release",
        registryEntityId,
        fieldName: "source_surface",
        currentValue: null,
        suggestedValue: shell.sourceSurface,
        providerItemId: registryEntityId,
        confidenceScore: 0.8,
        decisionStatus: "draft",
      },
    ],
    providerLinks: [
      {
        id: `${shell.shellKey}-provider-link`,
        registryEntityType: "release",
        registryEntityId,
        provider: shell.sourceSurface,
        providerEntityId: registryEntityId,
        providerUrl: null,
        matchStatus: "candidate",
        confidenceScore: normalizeConfidence(shell.confidenceScore),
      },
    ],
  };
}

function normalizeConfidence(value: number): number {
  if (value > 1) return Math.max(0, Math.min(1, value / 100));
  return Math.max(0, Math.min(1, value));
}

export function formatConfidence(value: number): string {
  return `${Math.round(normalizeConfidence(value) * 100)}%`;
}
