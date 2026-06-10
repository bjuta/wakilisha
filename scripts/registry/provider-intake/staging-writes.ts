import type { PgPool } from "../enrichment-review-runtime-api";
import type {
  CreateReleaseShellInput,
  CreateReleaseShellResult,
  ProviderEntityType,
  ProviderSearchResult,
} from "./types";

export async function createReleaseShellFromProviderResult(
  pool: PgPool,
  input: CreateReleaseShellInput,
  inspectedResult: { result: ProviderSearchResult; detail: { tracks: ProviderSearchResult[]; artists: ProviderSearchResult[] } },
): Promise<CreateReleaseShellResult> {
  const { provider, providerEntityId, storefrontOrMarket } = input;
  const registryEntityId = providerEntityId;
  const shellKey = `runtime:${provider}:${providerEntityId}`;
  const actor = input.actor ?? process.env.WAKILISHA_CANONICAL_WRITE_ACTOR ?? "system";
  const now = new Date().toISOString();

  const result: CreateReleaseShellResult = {
    shell: { shellKey, registryEntityId, status: "open" },
    writes: { providerFieldObservations: 0, registryEnrichmentSuggestions: 0, providerEntityLinks: 0, lifecycleEvents: 0 },
    skipped: [],
  };

  const client = await pool.connect();

  try {
    await client.query("begin");

    // 1. Idempotency check — does this provider link already exist?
    const existingLink = await client.query(
      `
        select 1 from public.provider_entity_links
        where provider = $1 and provider_entity_id = $2 and registry_entity_type = 'release'
        limit 1
      `,
      [provider, providerEntityId],
    );

    const isFirstTime = (existingLink.rowCount ?? 0) === 0;

    // 2. Write provider_field_observations
    const observations = buildObservations(inspectedResult, provider, storefrontOrMarket, actor);
    let observationCount = 0;

    for (const obs of observations) {
      const dupCheck = await client.query(
        `
          select 1 from public.provider_field_observations
          where provider = $1 and provider_item_id = $2 and field_name = $3 and source_path = $4
          limit 1
        `,
        [obs.provider, obs.providerItemId, obs.fieldName, obs.sourcePath],
      );

      if ((dupCheck.rowCount ?? 0) > 0) {
        result.skipped.push({
          entityType: obs.entityType,
          providerEntityId: obs.providerItemId ?? "",
          reason: "Provider field observation already exists",
        });
        continue;
      }

      await client.query(
        `
          insert into public.provider_field_observations
            (provider_item_id, entity_type, field_name, field_value, provider, confidence_score, source_path, created_at)
          values ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [obs.providerItemId, obs.entityType, obs.fieldName, obs.fieldValue, obs.provider, obs.confidenceScore, obs.sourcePath, now],
      );
      observationCount++;
    }

    result.writes.providerFieldObservations = observationCount;

    // 3. Write registry_enrichment_suggestions
    const suggestions = buildSuggestions(inspectedResult, registryEntityId, provider, actor);
    let suggestionCount = 0;

    for (const sug of suggestions) {
      const dupCheck = await client.query(
        `
          select 1 from public.registry_enrichment_suggestions
          where registry_entity_id = $1 and field_name = $2 and provider_item_id = $3 and suggested_value = $4
          limit 1
        `,
        [sug.registryEntityId, sug.fieldName, sug.providerItemId, sug.suggestedValue],
      );

      if ((dupCheck.rowCount ?? 0) > 0) {
        result.skipped.push({
          entityType: "release",
          providerEntityId: sug.providerItemId ?? "",
          reason: "Enrichment suggestion already exists",
        });
        continue;
      }

      await client.query(
        `
          insert into public.registry_enrichment_suggestions
            (registry_entity_type, registry_entity_id, field_name, current_value, suggested_value, provider_item_id, confidence_score, decision_status, created_at)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [sug.registryEntityType, sug.registryEntityId, sug.fieldName, sug.currentValue, sug.suggestedValue, sug.providerItemId, sug.confidenceScore, "draft", now],
      );
      suggestionCount++;
    }

    result.writes.registryEnrichmentSuggestions = suggestionCount;

    // 4. Write provider_entity_links
    const links = buildLinks(inspectedResult, registryEntityId, provider);
    let linkCount = 0;

    for (const link of links) {
      const dupCheck = await client.query(
        `
          select 1 from public.provider_entity_links
          where provider = $1 and provider_entity_id = $2 and registry_entity_id = $3 and registry_entity_type = $4
          limit 1
        `,
        [link.provider, link.providerEntityId, link.registryEntityId, link.registryEntityType],
      );

      if ((dupCheck.rowCount ?? 0) > 0) {
        result.skipped.push({
          entityType: link.registryEntityType,
          providerEntityId: link.providerEntityId,
          reason: "Provider link already exists",
        });
        continue;
      }

      await client.query(
        `
          insert into public.provider_entity_links
            (registry_entity_type, registry_entity_id, provider, provider_entity_id, provider_url, match_status, confidence_score, created_at)
          values ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [link.registryEntityType, link.registryEntityId, link.provider, link.providerEntityId, link.providerUrl, link.matchStatus, link.confidenceScore, now],
      );
      linkCount++;
    }

    result.writes.providerEntityLinks = linkCount;

    // 5. Write lifecycle event (only on first time)
    if (isFirstTime) {
      await client.query(
        `
          insert into public.registry_release_shell_lifecycle_events
            (registry_entity_type, registry_entity_id, status, reason, actor, created_at)
          values ('release', $1, 'open', 'Created from provider intake.', $2, $3)
        `,
        [registryEntityId, actor, now],
      );
      result.writes.lifecycleEvents = 1;
    }

    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

// ── Observation builders ────────────────────────────────────────────────────

function buildObservations(
  inspected: { result: ProviderSearchResult; detail: { tracks: ProviderSearchResult[]; artists: ProviderSearchResult[] } },
  provider: string,
  storefrontOrMarket: string | null,
  _actor: string,
) {
  const observations: Array<{
    providerItemId: string | null;
    entityType: ProviderEntityType;
    fieldName: string;
    fieldValue: string | null;
    provider: string;
    confidenceScore: number;
    sourcePath: string;
  }> = [];

  const result = inspected.result;

  // Release-level observations
  for (const field of result.summaryFields) {
    if (field.value !== null && field.value !== undefined && field.value !== "") {
      observations.push({
        providerItemId: result.providerEntityId,
        entityType: "release",
        fieldName: field.key,
        fieldValue: String(field.value),
        provider,
        confidenceScore: 0.9,
        sourcePath: `release.${field.key}`,
      });
    }
  }

  observations.push({
    providerItemId: result.providerEntityId,
    entityType: "release",
    fieldName: "artwork_url",
    fieldValue: result.artworkUrl,
    provider,
    confidenceScore: 0.9,
    sourcePath: "release.artworkUrl",
  });

  observations.push({
    providerItemId: result.providerEntityId,
    entityType: "release",
    fieldName: "provider_url",
    fieldValue: result.providerUrl,
    provider,
    confidenceScore: 0.9,
    sourcePath: "release.providerUrl",
  });

  observations.push({
    providerItemId: result.providerEntityId,
    entityType: "release",
    fieldName: "storefront_or_market",
    fieldValue: storefrontOrMarket,
    provider,
    confidenceScore: 0.8,
    sourcePath: "release.storefront",
  });

  // Track observations
  for (const track of inspected.detail.tracks) {
    for (const field of track.summaryFields) {
      if (field.value !== null && field.value !== undefined && field.value !== "") {
        observations.push({
          providerItemId: track.providerEntityId,
          entityType: "track",
          fieldName: field.key,
          fieldValue: String(field.value),
          provider,
          confidenceScore: 0.85,
          sourcePath: `track.${track.providerEntityId}.${field.key}`,
        });
      }
    }
  }

  // Artist observations
  for (const artist of inspected.detail.artists) {
    observations.push({
      providerItemId: artist.providerEntityId,
      entityType: "artist",
      fieldName: "name",
      fieldValue: artist.title,
      provider,
      confidenceScore: 0.85,
      sourcePath: `artist.${artist.providerEntityId}.name`,
    });
  }

  return observations;
}

// ── Suggestion builders ───────────────────────────────────────────────────

function buildSuggestions(
  inspected: { result: ProviderSearchResult; detail: { tracks: ProviderSearchResult[]; artists: ProviderSearchResult[] } },
  registryEntityId: string,
  provider: string,
  _actor: string,
) {
  const suggestions: Array<{
    registryEntityType: "release";
    registryEntityId: string;
    fieldName: string;
    currentValue: string | null;
    suggestedValue: string;
    providerItemId: string | null;
    confidenceScore: number;
  }> = [];

  const result = inspected.result;

  const addSuggestion = (
    fieldName: string,
    suggestedValue: string | null,
    confidenceScore: number,
  ) => {
    if (!suggestedValue || suggestedValue.trim() === "") return;
    suggestions.push({
      registryEntityType: "release",
      registryEntityId,
      fieldName,
      currentValue: null,
      suggestedValue,
      providerItemId: result.providerEntityId,
      confidenceScore,
    });
  };

  addSuggestion("title", result.title, 0.95);
  addSuggestion("artist_display_name", result.artistDisplayName, 0.9);
  addSuggestion("artwork_url", result.artworkUrl, 0.9);

  const releaseDate = result.summaryFields.find((f) => f.key === "release_date")?.value;
  if (releaseDate) addSuggestion("release_date", String(releaseDate), 0.95);

  const releaseType = result.summaryFields.find((f) => f.key === "release_type")?.value;
  if (releaseType) addSuggestion("release_type", String(releaseType), 0.85);

  const trackCount = result.summaryFields.find((f) => f.key === "track_count")?.value;
  if (trackCount) addSuggestion("track_count", String(trackCount), 0.95);

  const upc = result.summaryFields.find((f) => f.key === "upc")?.value;
  if (upc) addSuggestion("upc", String(upc), 0.95);

  const label = result.summaryFields.find((f) => f.key === "label")?.value;
  if (label) addSuggestion("label_name", String(label), 0.8);

  const copyright = result.summaryFields.find((f) => f.key === "copyright")?.value;
  if (copyright) addSuggestion("copyright_text", String(copyright), 0.75);

  const genres = result.summaryFields.find((f) => f.key === "genres")?.value;
  if (genres) addSuggestion("genres", String(genres), 0.7);

  addSuggestion("provider_url", result.providerUrl, 0.9);

  return suggestions;
}

// ── Link builders ─────────────────────────────────────────────────────────

function buildLinks(
  inspected: { result: ProviderSearchResult; detail: { tracks: ProviderSearchResult[]; artists: ProviderSearchResult[] } },
  registryEntityId: string,
  provider: string,
) {
  const links: Array<{
    registryEntityType: ProviderEntityType;
    registryEntityId: string;
    provider: string;
    providerEntityId: string;
    providerUrl: string | null;
    matchStatus: "candidate";
    confidenceScore: number;
  }> = [];

  const result = inspected.result;

  // Release link
  if (result.providerEntityId) {
    links.push({
      registryEntityType: "release",
      registryEntityId,
      provider,
      providerEntityId: result.providerEntityId,
      providerUrl: result.providerUrl,
      matchStatus: "candidate",
      confidenceScore: 0.85,
    });
  }

  // Track links
  for (const track of inspected.detail.tracks) {
    if (track.providerEntityId) {
      links.push({
        registryEntityType: "track",
        registryEntityId,
        provider,
        providerEntityId: track.providerEntityId,
        providerUrl: track.providerUrl,
        matchStatus: "candidate",
        confidenceScore: 0.7,
      });
    }
  }

  // Artist links
  for (const artist of inspected.detail.artists) {
    if (artist.providerEntityId) {
      links.push({
        registryEntityType: "artist",
        registryEntityId,
        provider,
        providerEntityId: artist.providerEntityId,
        providerUrl: artist.providerUrl,
        matchStatus: "candidate",
        confidenceScore: 0.7,
      });
    }
  }

  return links;
}

// ── Provider Intake Run Recording ─────────────────────────────────────────

export interface ProviderIntakeRunRecord {
  idempotencyKey: string;
  provider: string;
  providerEntityType: string;
  providerEntityId: string;
  storefrontOrMarket: string | null;
  mode: "create_shell" | "attach";
  actor: string | null;
  targetRegistryEntityId?: string | null;
}

export async function recordProviderIntakeRunStart(
  pool: PgPool,
  record: ProviderIntakeRunRecord,
): Promise<string> {
  const now = new Date().toISOString();
  const { idempotencyKey, provider, providerEntityType, providerEntityId, storefrontOrMarket, mode, actor, targetRegistryEntityId } = record;

  const result = await pool.query(
    `
      insert into public.provider_intake_runs
        (idempotency_key, provider, provider_entity_type, provider_entity_id,
         storefront_or_market, mode, actor, target_registry_entity_id,
         status, summary_json, created_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8, 'started', ''::jsonb, $9)
      returning id
    `,
    [idempotencyKey, provider, providerEntityType, providerEntityId, storefrontOrMarket, mode, actor, targetRegistryEntityId ?? null, now],
  );

  return (result.rows[0] as { id: string }).id;
}

export async function recordProviderIntakeRunComplete(
  pool: PgPool,
  runId: string,
  summaryJson: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString();
  await pool.query(
    `
      update public.provider_intake_runs
      set status = 'completed', summary_json = $2, completed_at = $3
      where id = $1
    `,
    [runId, JSON.stringify(summaryJson), now],
  );
}

export async function recordProviderIntakeRunFailed(
  pool: PgPool,
  runId: string,
  errorMessage: string,
  summaryJson?: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString();
  await pool.query(
    `
      update public.provider_intake_runs
      set status = 'failed', error_message = $2, summary_json = $3, completed_at = $4
      where id = $1
    `,
    [runId, errorMessage, JSON.stringify(summaryJson ?? {}), now],
  );
}