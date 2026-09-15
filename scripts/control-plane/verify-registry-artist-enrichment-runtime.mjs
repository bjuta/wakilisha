#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const requireText = (source, fragment, label) => {
  if (!source.includes(fragment)) {
    throw new Error(`${label}: missing required fragment: ${fragment}`);
  }
};
const forbidText = (source, fragment, label) => {
  if (source.includes(fragment)) {
    throw new Error(`${label}: forbidden fragment present: ${fragment}`);
  }
};

const providerPath = "supabase/functions/registry-artist-provider-fetch/index.ts";
const orchestratorPath = "supabase/functions/registry-enrich-artist/index.ts";
const spotifyAdapterPath = "supabase/functions/backfill-artist-spotify-images/index.ts";
const typeAdapterPath = "supabase/functions/backfill-artist-type/index.ts";
const originPath = "supabase/functions/backfill-artist-origin/index.ts";
const adminClientPath = "src/services/registry/admin/artistEnrichment.ts";
const detailPath = "src/pages/admin/registry/artists/detail/page.tsx";
const listPath = "src/pages/admin/registry/artists/page.tsx";

const provider = read(providerPath);
const orchestrator = read(orchestratorPath);
const spotifyAdapter = read(spotifyAdapterPath);
const typeAdapter = read(typeAdapterPath);
const origin = read(originPath);
const adminClient = read(adminClientPath);
const detail = read(detailPath);
const list = read(listPath);

// Provider credentials are isolated in one boundary that has no Registry DML.
requireText(provider, 'SUPABASE_SERVICE_ROLE_KEY', providerPath);
requireText(provider, 'required_capability: "manage_registry"', providerPath);
requireText(provider, '.from("admin_settings_secrets")', providerPath);
for (const fragment of [
  '.from("registry_artists").update',
  '.from("registry_artists").insert',
  '.from("registry_artists").delete',
  'admin_execute_registry_artist_',
  'admin_execute_registry_artist_enrichment_evidence_admission',
]) {
  forbidText(provider, fragment, providerPath);
}

// Canonical mutation/orchestration roads are caller-JWT only.
for (const [path, source] of [
  [orchestratorPath, orchestrator],
  [spotifyAdapterPath, spotifyAdapter],
  [typeAdapterPath, typeAdapter],
]) {
  forbidText(source, 'SUPABASE_SERVICE_ROLE_KEY', path);
  forbidText(source, '.from("registry_artists").update', path);
  forbidText(source, '.from("registry_artists").insert', path);
  forbidText(source, '.from("registry_artists").delete', path);
}

requireText(orchestrator, 'required_capability: "manage_registry"', orchestratorPath);
requireText(orchestrator, 'admin_prepare_registry_artist_provider_profile_evidence', orchestratorPath);
requireText(orchestrator, 'admin_prepare_registry_artist_public_image_evidence', orchestratorPath);
requireText(orchestrator, 'admin_prepare_registry_artist_bio_evidence', orchestratorPath);
requireText(orchestrator, 'admin_prepare_registry_artist_type_evidence', orchestratorPath);
requireText(orchestrator, 'admin_execute_registry_artist_enrichment_evidence_admission', orchestratorPath);
requireText(orchestrator, 'admin_verify_registry_artist_enrichment_admission', orchestratorPath);
requireText(orchestrator, 'reviewed_evidence_ids', orchestratorPath);
requireText(orchestrator, 'evidence_ids', orchestratorPath);
requireText(orchestrator, 'approved !== true', orchestratorPath);
for (const rawWrapper of [
  'admin_execute_registry_artist_provider_profile_admission',
  'admin_execute_registry_artist_public_image_admission',
  'admin_execute_registry_artist_bio_admission',
  'admin_execute_registry_artist_type_admission',
]) {
  forbidText(orchestrator, rawWrapper, orchestratorPath);
}

// Compatibility names may remain but they must be adapters, never authorities.
requireText(spotifyAdapter, '/functions/v1/registry-enrich-artist', spotifyAdapterPath);
requireText(typeAdapter, '/functions/v1/registry-enrich-artist', typeAdapterPath);

// Preserve the already accepted Artist-origin exact admission road.
requireText(origin, 'required_capability: "manage_registry"', originPath);
requireText(origin, 'admin_execute_registry_artist_origin_admission', originPath);
requireText(origin, 'admin_verify_registry_artist_origin_admission', originPath);
forbidText(origin, 'SUPABASE_SERVICE_ROLE_KEY', originPath);

// Shared frontend contract: preview prepares evidence; apply sends only evidence IDs.
requireText(adminClient, 'previewArtistEnrichment', adminClientPath);
requireText(adminClient, 'applyReviewedArtistEnrichment', adminClientPath);
requireText(adminClient, 'reviewed_evidence_ids', adminClientPath);
requireText(adminClient, 'evidence_ids: evidenceIds', adminClientPath);
requireText(adminClient, 'approved: true', adminClientPath);

// Detail surface must use shared reviewed-evidence client and governed manual edits.
requireText(detail, 'previewArtistEnrichment', detailPath);
requireText(detail, 'applyReviewedArtistEnrichment', detailPath);
requireText(detail, 'saveRegistryEntityPatch', detailPath);
for (const fragment of [
  '.from("registry_artists").update',
  '.from("registry_artists")\n      .update',
  '/functions/v1/backfill-artist-type',
  'collaboration',
  'ensemble',
]) {
  forbidText(detail, fragment, detailPath);
}
for (const canonicalType of ['value="solo"','value="group"','value="band"','value="duo"','value="collective"','value="unknown"']) {
  requireText(detail, canonicalType, detailPath);
}

// Bulk/list surface must use the same reviewed-evidence contract. Direct calls
// to the enrichment runtime are intentionally forbidden once convergence lands.
requireText(list, 'previewArtistEnrichment', listPath);
requireText(list, 'applyReviewedArtistEnrichment', listPath);
for (const fragment of [
  '/functions/v1/registry-enrich-artist',
  '/functions/v1/backfill-artist-type',
  '/functions/v1/backfill-artist-spotify-images',
]) {
  forbidText(list, fragment, listPath);
}

console.log("REGISTRY_ARTIST_ENRICHMENT_RUNTIME_V1_PASS");
