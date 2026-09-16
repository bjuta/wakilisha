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
const legacyBrokerPath = "supabase/functions/ingest-artist-discography/index.ts";
const manifestPath = "scripts/control-plane/registry-privileged-writer-manifest.json";

const provider = read(providerPath);
const legacyBroker = read(legacyBrokerPath);
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
if (providerWriter) {
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
}

// Until the full candidate lands, keep proving the superseded broker is still
// classified as debt rather than silently treating its service-role path as accepted.
const legacyWriter = writers.find((row) => row.id === "ingest-artist-discography");
if (!legacyWriter || legacyWriter.legacyDebt !== true || legacyWriter.disposition !== "converge") {
  throw new Error(`${manifestPath}: legacy discography authority must remain explicit convergence debt`);
}
requireText(legacyBroker, 'SUPABASE_SERVICE_ROLE_KEY', legacyBrokerPath);

console.log("REGISTRY_DISCOGRAPHY_RUNTIME_CONVERGENCE_IN_PROGRESS_PASS");
