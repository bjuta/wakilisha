import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function canonicalMigration(): string {
  const directory = path.resolve(process.cwd(), "supabase/migrations");
  const matches = fs
    .readdirSync(directory)
    .filter((name) =>
      name.endsWith(
        "_provider_identity_release_strong_evidence_resolver_v1.sql",
      ),
    );

  expect(matches).toHaveLength(1);
  return read(`supabase/migrations/${matches[0]}`);
}

describe("Provider Identity Release strong-evidence convergence", () => {
  it("keeps the shared Release resolver pure and strong-evidence only", () => {
    const kernel = read("supabase/functions/_shared/provider-identity.ts");

    expect(kernel).toContain("resolveReleaseIdentityV1");
    expect(kernel).toContain("ReleaseLineageResolutionV1");
    expect(kernel).toContain("currentReleaseIds");
    expect(kernel).toContain("normalizeUpc");
    expect(kernel).not.toContain("registry_release_provider_links");
  });

  it("removes legacy Discography slug/title canonical fallback", () => {
    const helper = read(
      "supabase/functions/ingest-artist-discography/releaseIdentity.ts",
    );

    expect(helper).toContain("resolveReleaseIdentityV1");
    expect(helper).toContain("providerBindingLookupKey");
    expect(helper).not.toContain("const candidates = [");
  });

  it("replaces the live SQL resolver with exact provider/UPC + lineage authority", () => {
    const migration = canonicalMigration();
    const start = migration.indexOf(
      "create or replace function\nplatform_private.registry_discography_resolve_release_v1",
    );
    const verify = migration.indexOf("\ndo $verify$", start);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(verify).toBeGreaterThan(start);

    const resolver = migration.slice(start, verify);

    expect(resolver).toContain("apple_music_album_id");
    expect(resolver).toContain("registry_identity_canonical_upc_v1");
    expect(resolver).toContain("registry_external_identifier_assertions");
    expect(resolver).toContain("assertion.assertion_status='accepted'");
    expect(resolver).toContain("resolve_registry_identity_lineage_v1");
    expect(resolver).toContain("release.status<>'archived'");
    expect(resolver).toContain("v_source_has_current");
    expect(resolver).not.toContain("v_before_count");
    expect(resolver).not.toContain("release.slug");
    expect(resolver).not.toContain("release.normalized_title");
    expect(resolver).not.toContain("registry_release_creation_slug_v1");
    expect(migration).not.toContain("registry_release_provider_links");
  });

  it("ships a permanent read-only verifier", () => {
    const verifier = read(
      "scripts/control-plane/verify-provider-identity-release-strong-evidence.sql",
    );

    expect(verifier).toContain(
      "PROVIDER_IDENTITY_RELEASE_STRONG_EVIDENCE_RESOLVER=PASS",
    );
    expect(verifier).toContain("resolve_registry_identity_lineage_v1");
    expect(verifier).toContain("registry_release_creation_collision_state_v1");
  });
});
