/**
 * Provider intake API routes for the registry admin server.
 * Handles search, inspect, and shell creation from provider results.
 */

import type { PgPool } from "../enrichment-review-runtime-api";
import type { CreateReleaseShellInput } from "./types";
import { AppleMusicAdapter, AppleMusicAdapterError } from "./apple-music-adapter";
import { findRegistryMatchCandidates, findExistingShellMatches } from "./matching";
import { createReleaseShellFromProviderResult, recordProviderIntakeRunStart, recordProviderIntakeRunComplete, recordProviderIntakeRunFailed } from "./staging-writes";

export async function handleProviderSearch(
  pool: PgPool,
  query: URLSearchParams,
): Promise<unknown> {
  const provider = query.get("provider") ?? "apple_music";
  const q = query.get("q") ?? "";
  const type = (query.get("type") ?? "all") as "all" | "artist" | "release" | "track";
  const storefront = query.get("storefront") ?? "ke";
  const limit = Math.min(Number(query.get("limit") ?? 25) || 25, 25);

  if (!q.trim()) {
    return {
      provider,
      query: q,
      storefrontOrMarket: storefront,
      groups: { artists: [], releases: [], tracks: [], labels: [] },
      rawResultCount: 0,
      normalizedResultCount: 0,
    };
  }

  if (provider === "apple_music") {
    const adapter = AppleMusicAdapter.fromEnv(storefront);
    const response = await adapter.search({
      provider: "apple_music",
      query: q,
      entityType: type,
      storefrontOrMarket: storefront,
      limit,
    });
    return response;
  }

  if (provider === "spotify") {
    return {
      provider,
      query: q,
      storefrontOrMarket: storefront,
      groups: { artists: [], releases: [], tracks: [], labels: [] },
      rawResultCount: 0,
      normalizedResultCount: 0,
      error: "Spotify is not configured for this environment.",
    };
  }

  return {
    provider,
    query: q,
    storefrontOrMarket: storefront,
    groups: { artists: [], releases: [], tracks: [], labels: [] },
    rawResultCount: 0,
    normalizedResultCount: 0,
    error: `Provider "${provider}" is not supported.`,
  };
}

export async function handleProviderInspect(
  pool: PgPool,
  body: unknown,
): Promise<unknown> {
  const input = body as {
    provider?: string;
    providerEntityType?: string;
    providerEntityId?: string;
    storefront?: string;
  };

  const provider = input.provider ?? "apple_music";
  const entityType = (input.providerEntityType ?? "release") as "artist" | "release" | "track";
  const entityId = String(input.providerEntityId ?? "").trim();
  const storefront = input.storefront ?? "ke";

  if (!entityId) {
    throw new Error("Missing providerEntityId.");
  }

  if (provider === "apple_music") {
    const adapter = AppleMusicAdapter.fromEnv(storefront);
    const response = await adapter.inspect({
      provider,
      providerEntityType: entityType,
      providerEntityId: entityId,
      storefrontOrMarket: storefront,
    });

    // Enrich with registry match candidates
    const [candidates, existingShells] = await Promise.all([
      findRegistryMatchCandidates(pool, response.result),
      findExistingShellMatches(pool, provider, entityId),
    ]);

    response.possibleRegistryMatches = candidates;
    response.existingShellMatches = existingShells;
    return response;
  }

  throw new Error(`Provider "${provider}" is not configured for inspect.`);
}

export async function handleCreateReleaseShell(
  pool: PgPool,
  body: unknown,
  actor?: string,
): Promise<unknown> {
  const input = body as Partial<CreateReleaseShellInput>;

  const provider = String(input.provider ?? "").trim();
  const entityType = (input.providerEntityType ?? "release") as "artist" | "release" | "track";
  const entityId = String(input.providerEntityId ?? "").trim();
  const storefront = input.storefrontOrMarket ?? "ke";
  const mode = input.mode ?? "create_shell";
  const targetRegistryEntityId = input.targetRegistryEntityId;
  const idempotencyKey = String(input.idempotencyKey ?? "").trim();
  const rawSelectedTrackIds = (input as Record<string, unknown>).selectedTrackIds;
  const selectedTrackIds: string[] = Array.isArray(rawSelectedTrackIds)
    ? rawSelectedTrackIds.filter((v): v is string => typeof v === "string")
    : input.selectedEntities?.tracks ?? [];

  if (!provider || !entityId) {
    throw new Error("Missing provider or providerEntityId.");
  }

  // Record intake run start
  const effectiveActor = actor ?? process.env.WAKILISHA_CANONICAL_WRITE_ACTOR ?? "system";
  const runId = await recordProviderIntakeRunStart(pool, {
    idempotencyKey: idempotencyKey || `${provider}:${entityType}:${entityId}:${storefront}:${mode}`,
    provider,
    providerEntityType: entityType,
    providerEntityId: entityId,
    storefrontOrMarket: storefront,
    mode: mode as "create_shell" | "attach",
    actor: effectiveActor,
    targetRegistryEntityId: targetRegistryEntityId ?? null,
  });

  try {
    // Inspect the provider result first to get full details
    const adapter = AppleMusicAdapter.fromEnv(storefront);
    const inspected = await adapter.inspect({
      provider,
      providerEntityType: entityType,
      providerEntityId: entityId,
      storefrontOrMarket: storefront,
    });

    // Filter tracks if specific track IDs were selected
    const allTracks = inspected.detail.tracks;
    const filteredTracks = selectedTrackIds.length > 0
      ? allTracks.filter((t) => selectedTrackIds.includes(t.providerEntityId))
      : allTracks;

    const createInput: CreateReleaseShellInput = {
      provider,
      providerEntityType: entityType,
      providerEntityId: entityId,
      storefrontOrMarket: storefront,
      selectedEntities: {
        release: true,
        artists: inspected.detail.artists.map((a) => a.providerEntityId),
        tracks: filteredTracks.map((t) => t.providerEntityId),
      },
      mode: mode as "create_shell" | "attach",
      idempotencyKey: idempotencyKey || `${provider}:${entityType}:${entityId}:${storefront}:${mode}`,
      targetRegistryEntityId,
      actor: effectiveActor,
    };

    const result = await createReleaseShellFromProviderResult(pool, createInput, {
      result: inspected.result,
      detail: { tracks: filteredTracks, artists: inspected.detail.artists },
    });

    // Record completion
    await recordProviderIntakeRunComplete(pool, runId, {
      shellKey: result.shell.shellKey,
      registryEntityId: result.shell.registryEntityId,
      shellStatus: result.shell.status,
      observationCount: result.writes.providerFieldObservations,
      suggestionCount: result.writes.registryEnrichmentSuggestions,
      linkCount: result.writes.providerEntityLinks,
      lifecycleEventCount: result.writes.lifecycleEvents,
      skippedCount: result.skipped.length,
      trackCount: filteredTracks.length,
      artistCount: inspected.detail.artists.length,
    });

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error during shell creation.";
    await recordProviderIntakeRunFailed(pool, runId, errorMessage).catch(() => {});
    throw err;
  }
}

export async function handleAttachToShell(
  pool: PgPool,
  body: unknown,
  actor?: string,
): Promise<unknown> {
  const input = body as Partial<CreateReleaseShellInput> & {
    targetRegistryEntityId?: string;
  };

  const provider = String(input.provider ?? "").trim();
  const entityType = (input.providerEntityType ?? "release") as "artist" | "release" | "track";
  const entityId = String(input.providerEntityId ?? "").trim();
  const storefront = input.storefrontOrMarket ?? "ke";
  const targetId = String(input.targetRegistryEntityId ?? "").trim();

  if (!provider || !entityId || !targetId) {
    throw new Error("Missing provider, providerEntityId, or targetRegistryEntityId.");
  }

  // Record intake run start
  const effectiveActor = actor ?? process.env.WAKILISHA_CANONICAL_WRITE_ACTOR ?? "system";
  const runId = await recordProviderIntakeRunStart(pool, {
    idempotencyKey: `${provider}:${entityType}:${entityId}:attach:${targetId}`,
    provider,
    providerEntityType: entityType,
    providerEntityId: entityId,
    storefrontOrMarket: storefront,
    mode: "attach",
    actor: effectiveActor,
    targetRegistryEntityId: targetId,
  });

  try {
    const adapter = AppleMusicAdapter.fromEnv(storefront);
    const inspected = await adapter.inspect({
      provider,
      providerEntityType: entityType,
      providerEntityId: entityId,
      storefrontOrMarket: storefront,
    });

    const createInput: CreateReleaseShellInput = {
      provider,
      providerEntityType: entityType,
      providerEntityId: entityId,
      storefrontOrMarket: storefront,
      selectedEntities: {
        release: true,
        artists: inspected.detail.artists.map((a) => a.providerEntityId),
        tracks: inspected.detail.tracks.map((t) => t.providerEntityId),
      },
      mode: "attach",
      idempotencyKey: `${provider}:${entityType}:${entityId}:attach:${targetId}`,
      targetRegistryEntityId: targetId,
      actor: effectiveActor,
    };

    const result = await createReleaseShellFromProviderResult(pool, createInput, {
      result: inspected.result,
      detail: { tracks: inspected.detail.tracks, artists: inspected.detail.artists },
    });

    await recordProviderIntakeRunComplete(pool, runId, {
      shellKey: result.shell.shellKey,
      registryEntityId: result.shell.registryEntityId,
      shellStatus: result.shell.status,
      observationCount: result.writes.providerFieldObservations,
      suggestionCount: result.writes.registryEnrichmentSuggestions,
      linkCount: result.writes.providerEntityLinks,
      lifecycleEventCount: result.writes.lifecycleEvents,
      skippedCount: result.skipped.length,
      trackCount: inspected.detail.tracks.length,
      artistCount: inspected.detail.artists.length,
    });

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error during shell attach.";
    await recordProviderIntakeRunFailed(pool, runId, errorMessage).catch(() => {});
    throw err;
  }
}

// ── Backfill Existing Release ─────────────────────────────────────────────

export async function handleBackfillExistingRelease(
  pool: PgPool,
  body: unknown,
  actor?: string,
): Promise<unknown> {
  const input = body as Partial<CreateReleaseShellInput> & {
    targetRegistryEntityId?: string;
    selectedTrackIds?: string[];
  };

  const provider = String(input.provider ?? "").trim();
  const entityType = (input.providerEntityType ?? "release") as "artist" | "release" | "track";
  const entityId = String(input.providerEntityId ?? "").trim();
  const storefront = input.storefrontOrMarket ?? "ke";
  const targetId = String(input.targetRegistryEntityId ?? "").trim();
  const selectedTrackIds = input.selectedTrackIds ?? [];

  if (!provider || !entityId || !targetId) {
    throw new Error("Missing provider, providerEntityId, or targetRegistryEntityId.");
  }

  // Verify that the target release exists in registry_releases
  const targetCheck = await pool.query(
    `select id, title, slug from public.registry_releases where id = $1 limit 1`,
    [targetId],
  );

  if ((targetCheck.rowCount ?? 0) === 0) {
    throw new Error(`Target release not found in registry_releases: ${targetId}`);
  }

  // Record intake run start
  const effectiveActor = actor ?? process.env.WAKILISHA_CANONICAL_WRITE_ACTOR ?? "system";
  const runId = await recordProviderIntakeRunStart(pool, {
    idempotencyKey: `${provider}:${entityType}:${entityId}:backfill:${targetId}`,
    provider,
    providerEntityType: entityType,
    providerEntityId: entityId,
    storefrontOrMarket: storefront,
    mode: "backfill_existing_release",
    actor: effectiveActor,
    targetRegistryEntityId: targetId,
  });

  try {
    const adapter = AppleMusicAdapter.fromEnv(storefront);
    const inspected = await adapter.inspect({
      provider,
      providerEntityType: entityType,
      providerEntityId: entityId,
      storefrontOrMarket: storefront,
    });

    // Filter tracks if specific track IDs were selected
    const allTracks = inspected.detail.tracks;
    const filteredTracks = selectedTrackIds.length > 0
      ? allTracks.filter((t) => selectedTrackIds.includes(t.providerEntityId))
      : allTracks;

    const createInput: CreateReleaseShellInput = {
      provider,
      providerEntityType: entityType,
      providerEntityId: entityId,
      storefrontOrMarket: storefront,
      selectedEntities: {
        release: true,
        artists: inspected.detail.artists.map((a) => a.providerEntityId),
        tracks: filteredTracks.map((t) => t.providerEntityId),
      },
      mode: "backfill_existing_release",
      idempotencyKey: `${provider}:${entityType}:${entityId}:backfill:${targetId}`,
      targetRegistryEntityId: targetId,
      actor: effectiveActor,
    };

    // Use the existing shell creation pipeline, but targeting the real registry release
    const result = await createReleaseShellFromProviderResult(pool, createInput, {
      result: inspected.result,
      detail: { tracks: filteredTracks, artists: inspected.detail.artists },
    });

    await recordProviderIntakeRunComplete(pool, runId, {
      shellKey: result.shell.shellKey,
      registryEntityId: result.shell.registryEntityId,
      shellStatus: result.shell.status,
      observationCount: result.writes.providerFieldObservations,
      suggestionCount: result.writes.registryEnrichmentSuggestions,
      linkCount: result.writes.providerEntityLinks,
      lifecycleEventCount: result.writes.lifecycleEvents,
      skippedCount: result.skipped.length,
      trackCount: filteredTracks.length,
      artistCount: inspected.detail.artists.length,
      targetReleaseId: targetId,
    });

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error during release backfill.";
    await recordProviderIntakeRunFailed(pool, runId, errorMessage).catch(() => {});
    throw err;
  }
}

// ── Provider Connection Test ─────────────────────────────────────────────

export async function handleTestProviderConnection(
  _pool: PgPool,
  query: URLSearchParams,
): Promise<unknown> {
  const provider = query.get("provider") ?? "apple_music";
  const storefront = query.get("storefront") ?? "ke";

  if (provider === "apple_music") {
    const startTime = Date.now();
    try {
      const adapter = AppleMusicAdapter.fromEnv(storefront);
      // Lightweight test: search for a known artist
      const response = await adapter.search({
        provider: "apple_music",
        query: "test",
        entityType: "artist",
        storefrontOrMarket: storefront,
        limit: 1,
      });

      const latencyMs = Date.now() - startTime;
      return {
        provider: "apple_music",
        storefront,
        status: "connected",
        latencyMs,
        resultCount: response.normalizedResultCount,
        testedAt: new Date().toISOString(),
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = err instanceof AppleMusicAdapterError
        ? `Apple Music API error: ${err.message} (status ${err.status ?? "N/A"})`
        : err instanceof Error ? err.message : "Unknown connection error";
      return {
        provider: "apple_music",
        storefront,
        status: "failed",
        latencyMs,
        error: errorMessage,
        testedAt: new Date().toISOString(),
      };
    }
  }

  if (provider === "spotify") {
    return {
      provider: "spotify",
      storefront,
      status: "unavailable",
      error: "Spotify connection test is not yet implemented.",
      testedAt: new Date().toISOString(),
    };
  }

  return {
    provider,
    storefront,
    status: "unknown",
    error: `Provider "${provider}" is not supported for connection testing.`,
    testedAt: new Date().toISOString(),
  };
}