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

const providerPath = "supabase/functions/registry-discography-provider-fetch/index.ts";
const governedBrokerPath = "supabase/functions/ingest-artist-discography/governedBroker.ts";
const governedHandlerPath = "supabase/functions/ingest-artist-discography/governedHandler.ts";
const governedPlanPath = "supabase/functions/ingest-artist-discography/governedPlan.ts";
const legacyBrokerPath = "supabase/functions/ingest-artist-discography/index.ts";
const adminClientPath = "src/services/registry/admin/discography.ts";
const manifestPath = "scripts/control-plane/registry-privileged-writer-manifest.json";

const provider = read(providerPath);
const governedBroker = read(governedBrokerPath);
const governedHandler = read(governedHandlerPath);
const governedPlan = read(governedPlanPath);
const legacyBroker = read(legacyBrokerPath);
const adminClient = read(adminClientPath);
const manifest = JSON.parse(read(manifestPath));
const writers = Array.isArray(manifest.writers) ? manifest.writers : [];

// Provider credentials may exist only in the evidence-acquisition boundary.
requireText(provider, 'SUPABASE_SERVICE_ROLE_KEY', providerPath);
requireText(provider, 'required_capability: "manage_registry"', providerPath);
requireText(provider, '.from("admin_settings_secrets")', providerPath);
requireText(provider, 'artist_id?: string', providerPath);
requireText(provider, 'source_payload_fingerprint', providerPath);
requireText(provider, 'provider: "apple_music"', providerPath);
requireText(provider, 'acquired_at: acquiredAt', providerPath);
requireText(provider, 'album_ids?: string[]', providerPath);

for (const fragment of [
  '.from("registry_artists").insert',
  '.from("registry_artists").update',
  '.from("registry_artists").upsert',
  '.from("registry_artists").delete',
  '.from("registry_releases").insert',
  '.from("registry_releases").update',
  '.from("registry_releases").upsert',
  '.from("registry_releases").delete',
  '.from("registry_tracks").insert',
  '.from("registry_tracks").update',
  '.from("registry_tracks").upsert',
  '.from("registry_tracks").delete',
  '.from("registry_release_artists").insert',
  '.from("registry_release_artists").delete',
  '.from("registry_release_tracks").insert',
  '.from("registry_release_tracks").delete',
  '.from("registry_track_artists").insert',
  '.from("registry_track_artists").delete',
]) {
  forbidText(provider, fragment, providerPath);
}

const providerWriter = writers.find((row) => row.id === "registry-discography-provider-fetch");
if (!providerWriter) {
  throw new Error(`${manifestPath}: missing registry-discography-provider-fetch classification`);
}
for (const [key, expected] of Object.entries({
  authentication: "request_bearer_user",
  authorization: "manage_registry",
  executionAuthority: "service_role_credential_read_only",
  riskClass: "medium",
  disposition: "keep",
  futureBoundary: "provider_evidence_only_no_registry_dml",
  miziziCallable: false,
  humanCallable: true,
  publicCallable: false,
  canonicalMutation: false,
  legacyDebt: false,
})) {
  if (providerWriter[key] !== expected) {
    throw new Error(`${manifestPath}: registry-discography-provider-fetch.${key} drifted`);
  }
}

// The mutation-side candidate is caller-JWT only and consumes immutable evidence.
for (const [path, source] of [
  [governedBrokerPath, governedBroker],
  [governedHandlerPath, governedHandler],
]) {
  forbidText(source, 'SUPABASE_SERVICE_ROLE_KEY', path);
  for (const table of [
    "registry_artists",
    "registry_releases",
    "registry_tracks",
    "registry_release_artists",
    "registry_release_tracks",
    "registry_track_artists",
  ]) {
    forbidText(source, `.from(\"${table}\").insert`, path);
    forbidText(source, `.from(\"${table}\").update`, path);
    forbidText(source, `.from(\"${table}\").upsert`, path);
    forbidText(source, `.from(\"${table}\").delete`, path);
  }
}

requireText(governedBroker, 'required_capability: "manage_registry"', governedBrokerPath);
requireText(governedBroker, '/functions/v1/registry-discography-provider-fetch', governedBrokerPath);
requireText(governedBroker, 'admin_prepare_registry_discography_evidence_v1', governedBrokerPath);
requireText(governedBroker, 'admin_preview_registry_discography_evidence_v1', governedBrokerPath);
requireText(governedBroker, 'admin_execute_registry_discography_evidence_v1', governedBrokerPath);
requireText(governedBroker, 'admin_create_registry_discography_artist_shell_v1', governedBrokerPath);
requireText(governedHandler, 'evidence_assertion_id', governedHandlerPath);
requireText(governedHandler, 'approved !== true', governedHandlerPath);
requireText(governedHandler, 'executeReviewedDiscographyEvidence', governedHandlerPath);

// The reviewed plan must reject browser invention and bind exact Artist authority.
for (const fragment of [
  'Provider observation is bound to a different Artist.',
  'was not present in the immutable provider observation.',
  'Provider observation fingerprint must be SHA-256 hex.',
  'Additional primary Artist identity is inconsistent inside one reviewed plan.',
]) {
  requireText(governedPlan, fragment, governedPlanPath);
}
requireText(governedPlan, 'exact_artist_id', governedPlanPath);
requireText(governedPlan, 'provider_source_payload_fingerprint', governedPlanPath);

// Frontend contract is exact-Artist + evidence-id based. Apply sends only reviewed
// selection authority, never the provider observation or a caller-authored source fingerprint.
requireText(adminClient, 'artist_id: artistId', adminClientPath);
requireText(adminClient, 'evidence_assertion_id: input.evidenceAssertionId', adminClientPath);
requireText(adminClient, 'selected_albums: input.selections', adminClientPath);
requireText(adminClient, 'approved: true', adminClientPath);
for (const fragment of [
  'provider_album: input.',
  'observation: input.',
  'provider_source_payload_fingerprint: input.',
  'source_payload_fingerprint: input.',
]) {
  forbidText(adminClient, fragment, adminClientPath);
}

// Until the full candidate lands, keep proving the superseded broker is still
// classified as debt rather than silently treating its service-role path as accepted.
const legacyWriter = writers.find((row) => row.id === "ingest-artist-discography");
if (!legacyWriter || legacyWriter.legacyDebt !== true || legacyWriter.disposition !== "converge") {
  throw new Error(`${manifestPath}: legacy discography authority must remain explicit convergence debt`);
}
requireText(legacyBroker, 'SUPABASE_SERVICE_ROLE_KEY', legacyBrokerPath);

console.log("REGISTRY_DISCOGRAPHY_RUNTIME_CONVERGENCE_IN_PROGRESS_PASS");
