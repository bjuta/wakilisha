import { supabase } from "@/lib/supabase";
import type { IngestResolvedRow } from "@/services/chartsIngestion/ingestStudioTypes";

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/registry-enrichment-review`;

async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function edgeFetch(path: string, options: { method?: string; body?: string; headers?: Record<string, string> } = {}): Promise<Response> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(`${EDGE_FUNCTION_URL}/${path}`, {
    ...options,
    headers,
  });
}


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

export interface ShellTrack {
  id?: string;
  title: string;
  artistName: string;
  trackNumber: number | null;
  durationMs: number | null;
  isrc: string | null;
  artworkUrl: string | null;
  previewUrl: string | null;
}

export interface ReleaseShellEnrichmentContext {
  shellKey: string;
  registryEntityId: string;
  dataSource: "runtime_api" | "fallback";
  lifecycle: ReleaseShellLifecycleSnapshot;
  observations: ProviderFieldObservationReviewItem[];
  suggestions: RegistryEnrichmentSuggestionReviewItem[];
  providerLinks: ProviderEntityLinkReviewItem[];
  tracks: ShellTrack[];
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

function normalizeConfidence(value: number): number {
  if (value > 1) return Math.max(0, Math.min(1, value / 100));
  return Math.max(0, Math.min(1, value));
}

function toPercentConfidence(value: number): number {
  return Math.round(normalizeConfidence(value) * 100);
}

function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = String(item[key]);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

function toEnrichmentSuggestion(s: Record<string, unknown>): RegistryEnrichmentSuggestionReviewItem {
  return {
    id: s.id as string,
    registryEntityType: s.registry_entity_type as "release",
    registryEntityId: s.registry_entity_id as string,
    fieldName: s.field_name as string,
    currentValue: s.current_value as string | null,
    suggestedValue: s.suggested_value as string,
    providerItemId: s.provider_item_id as string | null,
    confidenceScore: typeof s.confidence_score === "number" ? s.confidence_score : 0.95,
    decisionStatus: s.decision_status as EnrichmentDecisionStatus,
    createdAt: s.created_at as string | null,
  };
}

function toProviderLink(l: Record<string, unknown>): ProviderEntityLinkReviewItem {
  return {
    id: l.id as string,
    registryEntityType: l.registry_entity_type as "release",
    registryEntityId: l.registry_entity_id as string,
    provider: l.provider as string,
    providerEntityId: l.provider_entity_id as string,
    providerUrl: l.provider_url as string | null,
    matchStatus: l.match_status as "candidate" | "confirmed" | "rejected",
    confidenceScore: typeof l.confidence_score === "number" ? l.confidence_score : 1.0,
    createdAt: l.created_at as string | null,
  };
}

function toFieldObservation(o: Record<string, unknown>): ProviderFieldObservationReviewItem {
  return {
    id: o.id as string,
    providerItemId: o.provider_item_id as string | null,
    entityType: o.entity_type as "release" | "track" | "artist",
    fieldName: o.field_name as string,
    fieldValue: o.field_value as string | null,
    provider: o.provider as string,
    confidenceScore: typeof o.confidence_score === "number" ? o.confidence_score : 0.95,
    sourcePath: o.source_path as string,
    createdAt: o.created_at as string | null,
  };
}

function buildContextFromShellRow(shell: Record<string, unknown>, shellSuggestions: RegistryEnrichmentSuggestionReviewItem[], shellLinks: ProviderEntityLinkReviewItem[], lifecycle: ReleaseShellLifecycleSnapshot, shellObservations: ProviderFieldObservationReviewItem[]): ReleaseShellEnrichmentContext {
  const rawTracks = Array.isArray(shell.tracks) ? shell.tracks as Array<Record<string, unknown>> : [];
  const tracks: ShellTrack[] = rawTracks.map((t) => ({
    id: t.id as string | undefined,
    title: (t.title as string) || "Untitled",
    artistName: (t.artistName as string) || "",
    trackNumber: t.trackNumber as number | null,
    durationMs: t.durationMs as number | null,
    isrc: (t.isrc as string) || null,
    artworkUrl: (t.artworkUrl as string) || null,
    previewUrl: (t.previewUrl as string) || null,
  }));

  return {
    shellKey: shell.id as string,
    registryEntityId: shell.id as string,
    dataSource: "runtime_api",
    lifecycle,
    observations: shellObservations,
    suggestions: shellSuggestions,
    providerLinks: shellLinks,
    tracks,
  };
}

// ── Supabase-based data loading ─────────────────────────────────────────────

export async function getLiveReleaseShellReviewRows(options: { includeResolved?: boolean } = {}): Promise<{
  shells: RegistryReleaseShellReviewRow[];
  contexts: Record<string, ReleaseShellEnrichmentContext>;
}> {
  try {
    const { data: shellsData, error: shellsError } = await supabase
      .from("registry_release_shells")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (shellsError || !shellsData || shellsData.length === 0) {
      return { shells: [], contexts: {} };
    }

    const shellIds = shellsData.map((s) => s.id);
    const providerItemIds = shellsData
      .map((s) => ((s.source_provenance as Record<string, unknown> | null)?.provider_entity_id as string) ?? "")
      .filter(Boolean);

    const [
      suggestionsResult,
      linksResult,
      lifecycleResult,
      observationsResult,
      releasesResult,
    ] = await Promise.all([
      supabase
        .from("registry_enrichment_suggestions")
        .select("*")
        .in("registry_entity_id", shellIds)
        .eq("registry_entity_type", "release"),
      supabase
        .from("provider_entity_links")
        .select("*")
        .in("registry_entity_id", shellIds)
        .eq("registry_entity_type", "release"),
      supabase
        .from("registry_release_shell_lifecycle_events")
        .select("*")
        .in("registry_entity_id", shellIds)
        .eq("registry_entity_type", "release")
        .order("created_at", { ascending: false }),
      providerItemIds.length > 0
        ? supabase
            .from("provider_field_observations")
            .select("*")
            .in("provider_item_id", providerItemIds)
        : { data: [], error: null },
      supabase
        .from("registry_releases")
        .select("id, slug, title, artwork_url, release_date")
        .in("id", shellsData.map((s) => s.release_id)),
    ]);

    const suggestionsByShell = groupBy(suggestionsResult.data ?? [], "registry_entity_id");
    const linksByShell = groupBy(linksResult.data ?? [], "registry_entity_id");
    const lifecycleByShell = groupBy(lifecycleResult.data ?? [], "registry_entity_id");
    const observationsByProviderItem = groupBy(observationsResult.data ?? [], "provider_item_id");
    const releasesById = Object.fromEntries((releasesResult.data ?? []).map((r) => [r.id, r]));

    const contexts: Record<string, ReleaseShellEnrichmentContext> = {};
    const rows: RegistryReleaseShellReviewRow[] = [];

    shellsData.forEach((shell, index) => {
      const prov = shell.source_provenance as Record<string, unknown> | null;
      const providerEntityId = (prov?.provider_entity_id as string) ?? "";
      const providerUrl = (prov?.provider_url as string) ?? "";
      const artworkUrl = (prov?.artwork_url as string) ?? null;

      const shellSuggestions = (suggestionsByShell[shell.id] ?? []).map(toEnrichmentSuggestion);
      const shellLinks = (linksByShell[shell.id] ?? []).map(toProviderLink);
      const shellLifecycleEvents = lifecycleByShell[shell.id] ?? [];
      const latestLifecycle = shellLifecycleEvents[0] as Record<string, unknown> | undefined;

      const lifecycle: ReleaseShellLifecycleSnapshot = {
        status: (latestLifecycle?.status as "open" | "resolved" | "reopened") ?? "open",
        reason: (latestLifecycle?.reason as string | null) ?? null,
        actor: (latestLifecycle?.actor as string) ?? "system",
        createdAt: (latestLifecycle?.created_at as string | null) ?? null,
      };

      const shellObservations = (observationsByProviderItem[providerEntityId] ?? []).map(toFieldObservation);

      const context = buildContextFromShellRow(shell as Record<string, unknown>, shellSuggestions, shellLinks, lifecycle, shellObservations);
      contexts[shell.id] = context;

      const release = releasesById[shell.release_id];
      const providerLink = shellLinks[0];
      const confidence = shellSuggestions[0]?.confidenceScore ?? providerLink?.confidenceScore ?? 0.95;

      rows.push({
        id: shell.id,
        shellKey: shell.id,
        rank: index + 1,
        sourceProvider: providerLink?.provider === "spotify" ? "spotify" : "apple_music",
        sourceUrl: providerLink?.providerUrl ?? providerUrl ?? "",
        title: shell.title,
        artistNames: shell.primary_artist_name ? [shell.primary_artist_name] : [],
        artworkUrl: artworkUrl ?? (release?.artwork_url as string) ?? null,
        matchStatus: "shell",
        confidence: toPercentConfidence(confidence),
        releaseShellId: shell.id,
        sourceSurface: "registry",
        sourceRunId: "registry-enrichment-review",
        sourceRunTitle: "Live staging",
        sourceEditionDate: "live",
        raw: context,
      });
    });

    const filteredRows = options.includeResolved
      ? rows
      : rows.filter((r) => {
          const ctx = contexts[r.shellKey];
          return ctx?.lifecycle?.status !== "resolved";
        });

    return {
      shells: filteredRows,
      contexts: Object.fromEntries(filteredRows.map((r) => [r.shellKey, contexts[r.shellKey]])),
    };
  } catch {
    return { shells: [], contexts: {} };
  }
}

export async function getReleaseShellEnrichmentContexts(
  shells: ReleaseShellEnrichmentLookupInput[],
): Promise<Record<string, ReleaseShellEnrichmentContext>> {
  if (shells.length === 0) return {};

  const shellIds = shells.map((s) => s.registryEntityId ?? s.shellKey).filter(Boolean);
  if (shellIds.length === 0) return {};

  try {
    const [suggestionsResult, linksResult, lifecycleResult, observationsResult] = await Promise.all([
      supabase
        .from("registry_enrichment_suggestions")
        .select("*")
        .in("registry_entity_id", shellIds)
        .eq("registry_entity_type", "release"),
      supabase
        .from("provider_entity_links")
        .select("*")
        .in("registry_entity_id", shellIds)
        .eq("registry_entity_type", "release"),
      supabase
        .from("registry_release_shell_lifecycle_events")
        .select("*")
        .in("registry_entity_id", shellIds)
        .eq("registry_entity_type", "release")
        .order("created_at", { ascending: false }),
      supabase
        .from("provider_field_observations")
        .select("*")
        .in("provider_item_id", shellIds),
    ]);

    const suggestionsByShell = groupBy(suggestionsResult.data ?? [], "registry_entity_id");
    const linksByShell = groupBy(linksResult.data ?? [], "registry_entity_id");
    const lifecycleByShell = groupBy(lifecycleResult.data ?? [], "registry_entity_id");
    const observationsByProviderItem = groupBy(observationsResult.data ?? [], "provider_item_id");

    const result: Record<string, ReleaseShellEnrichmentContext> = {};

    shells.forEach((shell) => {
      const shellId = shell.registryEntityId ?? shell.shellKey;
      const shellSuggestions = (suggestionsByShell[shellId] ?? []).map(toEnrichmentSuggestion);
      const shellLinks = (linksByShell[shellId] ?? []).map(toProviderLink);
      const shellLifecycleEvents = lifecycleByShell[shellId] ?? [];
      const latestLifecycle = shellLifecycleEvents[0] as Record<string, unknown> | undefined;

      const lifecycle: ReleaseShellLifecycleSnapshot = {
        status: (latestLifecycle?.status as "open" | "resolved" | "reopened") ?? "open",
        reason: (latestLifecycle?.reason as string | null) ?? null,
        actor: (latestLifecycle?.actor as string) ?? "system",
        createdAt: (latestLifecycle?.created_at as string | null) ?? null,
      };

      const shellObservations = (observationsByProviderItem[shellId] ?? []).map(toFieldObservation);

      result[shell.shellKey] = {
        shellKey: shell.shellKey,
        registryEntityId: shellId,
        dataSource: "runtime_api",
        lifecycle,
        observations: shellObservations,
        suggestions: shellSuggestions,
        providerLinks: shellLinks,
        tracks: [],
      };
    });

    return result;
  } catch {
    return {};
  }
}

// ── Apply preview / apply ───────────────────────────────────────────────────

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

export interface UpdateReleaseShellSuggestionDecisionResult {
  suggestionId: string;
  registryEntityId: string;
  decisionStatus: Extract<EnrichmentDecisionStatus, "approved" | "rejected" | "needs_review">;
}

export async function updateReleaseShellSuggestionDecision(
  suggestionId: string,
  decisionStatus: Extract<EnrichmentDecisionStatus, "approved" | "rejected" | "needs_review">,
): Promise<UpdateReleaseShellSuggestionDecisionResult> {
  const response = await edgeFetch(`suggestions/${encodeURIComponent(suggestionId)}/decision`, {
    method: "POST",
    body: JSON.stringify({ decisionStatus }),
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Edge function returned non-JSON response (${response.status}).`);
  }

  const payload = (await response.json()) as {
    data?: { decision?: UpdateReleaseShellSuggestionDecisionResult };
    decision?: UpdateReleaseShellSuggestionDecisionResult;
    error?: string;
  };

  if (!response.ok) throw new Error(payload.error ?? `Edge function returned HTTP ${response.status}.`);
  const decision = payload.data?.decision ?? payload.decision;
  if (!decision) throw new Error("No decision payload returned.");
  return decision;
}

export async function previewApprovedReleaseShellSuggestions(
  registryEntityId: string,
): Promise<ApplyApprovedReleaseShellSuggestionsPreview> {
  const response = await edgeFetch("preview-apply", {
    method: "POST",
    body: JSON.stringify({ registryEntityId }),
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) throw new Error(`Edge function returned non-JSON response (${response.status}).`);
  const payload = (await response.json()) as { data?: ApplyApprovedReleaseShellSuggestionsPreview; error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Edge function returned HTTP ${response.status}.`);
  return payload.data as ApplyApprovedReleaseShellSuggestionsPreview;
}

export async function applyApprovedReleaseShellSuggestions(
  registryEntityId: string,
): Promise<ApplyApprovedReleaseShellSuggestionsResult> {
  const response = await edgeFetch("apply-approved", {
    method: "POST",
    body: JSON.stringify({ registryEntityId }),
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) throw new Error(`Edge function returned non-JSON response (${response.status}).`);
  const payload = (await response.json()) as { data?: ApplyApprovedReleaseShellSuggestionsResult; error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Edge function returned HTTP ${response.status}.`);
  return payload.data as ApplyApprovedReleaseShellSuggestionsResult;
}

export async function updateReleaseShellLifecycleStatus(
  registryEntityId: string,
  status: "resolved" | "reopened",
  reason = "",
): Promise<ReleaseShellLifecycleSnapshot> {
  const response = await edgeFetch(`${encodeURIComponent(registryEntityId)}/lifecycle`, {
    method: "POST",
    body: JSON.stringify({ status, reason }),
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) throw new Error(`Edge function returned non-JSON response (${response.status}).`);
  const payload = (await response.json()) as {
    data?: { lifecycle?: ReleaseShellLifecycleSnapshot };
    lifecycle?: ReleaseShellLifecycleSnapshot;
    error?: string;
  };
  if (!response.ok) throw new Error(payload.error ?? `Edge function returned HTTP ${response.status}.`);
  const lifecycle = payload.data?.lifecycle ?? payload.lifecycle;
  if (!lifecycle) throw new Error("No lifecycle payload returned.");
  return lifecycle;
}

export async function getReleaseShellCanonicalWriteAuditEvents(
  registryEntityId: string,
): Promise<CanonicalWriteAuditEvent[]> {
  const response = await edgeFetch(`${encodeURIComponent(registryEntityId)}/audit`, { method: "GET" });
  if (!response.ok) return [];
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return [];
  const payload = (await response.json()) as { data?: { events?: CanonicalWriteAuditEvent[] }; events?: CanonicalWriteAuditEvent[] };
  return payload.data?.events ?? payload.events ?? [];
}

export function formatConfidence(value: number): string {
  return `${Math.round(normalizeConfidence(value) * 100)}%`;
}

export interface ShellDuplicateCheckResult {
  registryEntityId: string;
  duplicates: Array<{
    registryEntityId: string;
    slug: string;
    title: string;
    releaseDate: string | null;
    artworkUrl: string | null;
    status: string;
    matchReason: string;
    matchScore: number;
  }>;
  hasDuplicates: boolean;
}

export interface ShellCanonicalizeResult {
  registryEntityId: string;
  releaseId: string;
  tracks: {
    created: number;
    joins: number;
    trackArtists: number;
    releaseArtists: number;
  };
  collisionResolved?: boolean;
  success: boolean;
}

export interface CanonicalReleaseComparison {
  id: string;
  slug: string;
  title: string;
  artistName: string | null;
  releaseDate: string | null;
  artworkUrl: string | null;
  status: string;
  trackCount: number;
  tracks: Array<{
    title: string;
    trackNumber: number | null;
    durationMs: number | null;
    isrc: string | null;
  }>;
}

export async function canonicalizeShell(registryEntityId: string): Promise<ShellCanonicalizeResult> {
  const response = await edgeFetch("canonicalize", {
    method: "POST",
    body: JSON.stringify({ registryEntityId }),
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) throw new Error(`Edge function returned non-JSON response (${response.status}).`);
  const payload = (await response.json()) as { data?: ShellCanonicalizeResult; error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Edge function returned HTTP ${response.status}.`);
  return payload.data as ShellCanonicalizeResult;
}

export async function saveShell(registryEntityId: string, updates: Record<string, unknown>): Promise<{ registryEntityId: string; saved: boolean }> {
  const response = await edgeFetch("save-shell", {
    method: "POST",
    body: JSON.stringify({ registryEntityId, updates }),
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) throw new Error(`Edge function returned non-JSON response (${response.status}).`);
  const payload = (await response.json()) as { data?: { registryEntityId: string; saved: boolean }; error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Edge function returned HTTP ${response.status}.`);
  return payload.data as { registryEntityId: string; saved: boolean };
}

export async function rejectShell(registryEntityId: string, reason?: string): Promise<{ registryEntityId: string; status: string; reason: string }> {
  const response = await edgeFetch("reject-shell", {
    method: "POST",
    body: JSON.stringify({ registryEntityId, reason }),
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) throw new Error(`Edge function returned non-JSON response (${response.status}).`);
  const payload = (await response.json()) as { data?: { registryEntityId: string; status: string; reason: string }; error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Edge function returned HTTP ${response.status}.`);
  return payload.data as { registryEntityId: string; status: string; reason: string };
}

export async function checkDuplicate(registryEntityId: string): Promise<ShellDuplicateCheckResult> {
  const response = await edgeFetch("check-duplicate", {
    method: "POST",
    body: JSON.stringify({ registryEntityId }),
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) throw new Error(`Edge function returned non-JSON response (${response.status}).`);
  const payload = (await response.json()) as { data?: ShellDuplicateCheckResult; error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Edge function returned HTTP ${response.status}.`);
  return payload.data as ShellDuplicateCheckResult;
}

export async function fetchCanonicalReleaseForComparison(releaseId: string): Promise<CanonicalReleaseComparison> {
  const response = await edgeFetch(`release-comparison/${encodeURIComponent(releaseId)}`, {
    method: "GET",
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) throw new Error(`Edge function returned non-JSON response (${response.status}).`);
  const payload = (await response.json()) as { data?: CanonicalReleaseComparison; error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Edge function returned HTTP ${response.status}.`);
  return payload.data as CanonicalReleaseComparison;
}