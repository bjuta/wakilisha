#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
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
const originPath = "supabase/functions/backfill-artist-origin/index.ts";
const adminClientPath = "src/services/registry/admin/artistEnrichment.ts";
const governancePanelsPath = "src/components/admin/registry/ArtistEnrichmentGovernancePanels.tsx";
const detailPath = "src/pages/admin/registry/artists/detail/page.tsx";
const listPath = "src/pages/admin/registry/artists/page.tsx";
const manifestPath = "scripts/control-plane/registry-privileged-writer-manifest.json";
const foundationMigrationPath = "supabase/migrations/20260915152100_registry_artist_enrichment_authority_v1.sql";
const reviewMigrationPath = "supabase/migrations/20260915152300_registry_artist_enrichment_review_authority_v1.sql";
const sqlVerifierPath = "scripts/control-plane/verify-registry-artist-enrichment-authority.sql";

const provider = read(providerPath);
const orchestrator = read(orchestratorPath);
const origin = read(originPath);
const adminClient = read(adminClientPath);
const governancePanels = read(governancePanelsPath);
const detail = read(detailPath);
const list = read(listPath);
const manifest = JSON.parse(read(manifestPath));
const foundationMigration = read(foundationMigrationPath);
const reviewMigration = read(reviewMigrationPath);
const sqlVerifier = read(sqlVerifierPath);
const writers = Array.isArray(manifest.writers) ? manifest.writers : [];
const writer = (id) => writers.find((row) => row.id === id);

const assertWriter = (id, expected) => {
  const actual = writer(id);
  if (!actual) throw new Error(`${manifestPath}: missing writer classification ${id}`);
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) {
      throw new Error(
        `${manifestPath}: ${id}.${key} expected ${JSON.stringify(value)} but found ${JSON.stringify(actual[key])}`,
      );
    }
  }
};

// SQL function identities must match their actual typed definitions exactly.
// A surplus text parameter here makes PostgreSQL ACL statements fail at replay.
for (const [path, source] of [
  [foundationMigrationPath, foundationMigration],
  [reviewMigrationPath, reviewMigration],
  [sqlVerifierPath, sqlVerifier],
]) {
  for (const forbiddenSignature of [
    "public.admin_execute_registry_artist_public_image_admission(uuid,text,text,text,text,text,",
    "public.admin_execute_registry_artist_bio_admission(uuid,text,text,text,text,text,",
    "public.admin_execute_registry_artist_type_admission(uuid,text,text,text,text,text,",
    "public.admin_prepare_registry_artist_bio_evidence(uuid,text,text,text,text,text,",
    "public.admin_prepare_registry_artist_type_evidence(uuid,text,text,text,text,text,",
  ]) {
    forbidText(source, forbiddenSignature, path);
  }
}

for (const [path, source, requiredSignatures] of [
  [foundationMigrationPath, foundationMigration, [
    "public.admin_execute_registry_artist_public_image_admission(uuid,text,text,text,text,timestamptz)",
    "public.admin_execute_registry_artist_bio_admission(uuid,text,text,text,text,timestamptz)",
    "public.admin_execute_registry_artist_type_admission(uuid,text,text,text,text,timestamptz)",
  ]],
  [reviewMigrationPath, reviewMigration, [
    "public.admin_execute_registry_artist_bio_admission(uuid,text,text,text,text,timestamptz)",
    "public.admin_execute_registry_artist_type_admission(uuid,text,text,text,text,timestamptz)",
    "public.admin_prepare_registry_artist_bio_evidence(uuid,text,text,text,text,timestamptz)",
    "public.admin_prepare_registry_artist_type_evidence(uuid,text,text,text,text,timestamptz)",
  ]],
  [sqlVerifierPath, sqlVerifier, [
    "public.admin_execute_registry_artist_bio_admission(uuid,text,text,text,text,timestamptz)",
    "public.admin_execute_registry_artist_type_admission(uuid,text,text,text,text,timestamptz)",
    "public.admin_prepare_registry_artist_bio_evidence(uuid,text,text,text,text,timestamptz)",
    "public.admin_prepare_registry_artist_type_evidence(uuid,text,text,text,text,timestamptz)",
  ]],
]) {
  for (const signature of requiredSignatures) requireText(source, signature, path);
}

// Provider credentials are isolated in one boundary that has no Registry DML.
requireText(provider, 'SUPABASE_SERVICE_ROLE_KEY', providerPath);
requireText(provider, 'required_capability: "manage_registry"', providerPath);
requireText(provider, '.from("admin_settings_secrets")', providerPath);
requireText(provider, 'const { data: artistData, error: artistError } = await callerDb', providerPath);
requireText(provider, 'createAppleMusicJwt(', providerPath);
for (const key of [
  "spotify_client_id",
  "spotify_client_secret",
  "apple_music_private_key",
  "apple_music_team_id",
  "apple_music_key_id",
  "apple_music_storefront",
]) {
  requireText(provider, `\"${key}\"`, providerPath);
}
for (const fragment of [
  '.from("registry_artists").update',
  '.from("registry_artists").insert',
  '.from("registry_artists").delete',
  'admin_execute_registry_artist_',
  'admin_execute_registry_artist_enrichment_evidence_admission',
]) {
  forbidText(provider, fragment, providerPath);
}

// Canonical mutation/orchestration road remains caller-JWT only.
forbidText(orchestrator, 'SUPABASE_SERVICE_ROLE_KEY', orchestratorPath);
forbidText(orchestrator, '.from("registry_artists").update', orchestratorPath);
forbidText(orchestrator, '.from("registry_artists").insert', orchestratorPath);
forbidText(orchestrator, '.from("registry_artists").delete', orchestratorPath);

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
requireText(orchestrator, 'Object.values(value as Record<string, unknown>)', orchestratorPath);
forbidText(
  orchestrator,
  '?.admin_prepare_registry_artist_provider_profile_evidence',
  orchestratorPath,
);
requireText(orchestrator, '\"name_heuristic\"', orchestratorPath);
forbidText(orchestrator, '\"manual_review\"', orchestratorPath);
for (const rawWrapper of [
  'admin_execute_registry_artist_provider_profile_admission',
  'admin_execute_registry_artist_public_image_admission',
  'admin_execute_registry_artist_bio_admission',
  'admin_execute_registry_artist_type_admission',
]) {
  forbidText(orchestrator, rawWrapper, orchestratorPath);
}

// Privileged-writer classification must describe the converged authority, not
// the superseded service-role implementation.
if (manifest.status !== "slice_2_artist_enrichment_authority_converged") {
  throw new Error(`${manifestPath}: Artist-enrichment authority status is stale`);
}

assertWriter("registry-enrich-artist", {
  authentication: "request_bearer_user",
  authorization: "manage_registry",
  executionAuthority: "caller_jwt_reviewed_evidence_typed_exact_grant",
  riskClass: "high",
  disposition: "keep",
  futureBoundary: "reviewed_evidence_exact_artist_enrichment_admission",
  miziziCallable: false,
  humanCallable: true,
  publicCallable: false,
  canonicalMutation: true,
  legacyDebt: false,
});

// Slice 3 Candidate B retirement contract: the compatibility wrappers are no
// longer runtime authorities or privileged-writer classifications.
for (const [id, retiredPath] of [
  ["backfill-artist-spotify-images", "supabase/functions/backfill-artist-spotify-images/index.ts"],
  ["backfill-artist-type", "supabase/functions/backfill-artist-type/index.ts"],
]) {
  if (existsSync(retiredPath)) {
    throw new Error(`${retiredPath}: retired Artist-enrichment compatibility wrapper returned`);
  }
  if (writer(id)) {
    throw new Error(`${manifestPath}: retired Artist-enrichment wrapper is still classified: ${id}`);
  }
}

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

// Extracted list governance panels own the review/apply interaction and must use
// the shared reviewed-evidence client rather than direct Edge-function calls.
requireText(governancePanels, 'previewArtistEnrichment', governancePanelsPath);
requireText(governancePanels, 'applyReviewedArtistEnrichment', governancePanelsPath);
requireText(governancePanels, 'reviewed_evidence_ids', governancePanelsPath);
for (const fragment of [
  '/functions/v1/registry-enrich-artist',
  '/functions/v1/backfill-artist-type',
  '/functions/v1/backfill-artist-spotify-images',
]) {
  forbidText(governancePanels, fragment, governancePanelsPath);
}

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

// Bulk/list surface must render the governed panels, while card-level enrichment
// is preview-only and hands review off to the exact Artist detail surface.
requireText(list, 'ArtistEnrichPanel', listPath);
requireText(list, 'ArtistTypePanel', listPath);
requireText(list, 'previewArtistEnrichment', listPath);
for (const fragment of [
  '/functions/v1/registry-enrich-artist',
  '/functions/v1/backfill-artist-type',
  '/functions/v1/backfill-artist-spotify-images',
]) {
  forbidText(list, fragment, listPath);
}

console.log("REGISTRY_ARTIST_ENRICHMENT_RUNTIME_V1_PASS");
