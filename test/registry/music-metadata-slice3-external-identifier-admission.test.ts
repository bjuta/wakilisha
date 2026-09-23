import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const migration = read(
  "supabase/migrations/20260923120155_music_identity_rights_slice3_external_identifier_admission_v1.sql",
);
const verifier = read(
  "scripts/control-plane/verify-music-metadata-external-identifier-admission-v1.sql",
);
const slice2Verifier = read(
  "scripts/control-plane/verify-music-identity-rights-slice2-authority.sql",
);

describe("Music metadata Slice 3 external identifier admission", () => {
  it("enables only candidate admission and leaves reviewed reconcile disabled", () => {
    expect(migration).toContain(
      "registry.external_identifier_assertion.admit",
    );
    expect(migration).toContain(
      "registry.external_identifier_assertion.reviewed_reconcile",
    );
    expect(migration).toContain("enabled=true");
    expect(migration).toContain(
      "External identifier reviewed reconcile enabled prematurely",
    );

    expect(slice2Verifier).toContain(
      "registry.external_identifier_assertion.admit",
    );
    expect(slice2Verifier).toContain(
      "registry.external_identifier_assertion.reviewed_reconcile",
    );
    expect(slice2Verifier).toContain(
      "Slice 3 external identifier admission authority is not enabled",
    );
    expect(slice2Verifier).toContain(
      "Deferred Slice 2 ontology mutation authority enabled prematurely",
    );
  });

  it("keeps the first tranche limited to retained Artist/Track/Release provider evidence", () => {
    expect(migration).toContain("apple_music_track_id");
    expect(migration).toContain("apple_music_album_id");
    expect(migration).toContain("apple_music_id");
    expect(migration).toContain("spotify_artist_id");
    expect(migration).toContain("spotify_id");

    expect(migration).toContain(
      "supports only artist, track, or release subjects",
    );
    expect(migration).toContain(
      "Subject/scheme pair is outside the accepted Slice 3 retained-provider contract",
    );

    expect(migration).not.toContain(
      "insert into public.registry_works",
    );
    expect(migration).not.toContain(
      "insert into public.registry_work_contributions",
    );
    expect(migration).not.toContain(
      "insert into public.registry_rights_claims",
    );
  });

  it("fails closed on stale, duplicated, or ledger-conflicting identifiers", () => {
    expect(migration).toContain(
      "WK_STALE_EXTERNAL_IDENTIFIER_SOURCE",
    );
    expect(migration).toContain(
      "WK_STALE_EXTERNAL_IDENTIFIER_CANDIDATE",
    );
    expect(migration).toContain(
      "WK_EXTERNAL_IDENTIFIER_REVIEW_REQUIRED",
    );
    expect(migration).toContain(
      "review_only_duplicate_assignment",
    );
    expect(migration).toContain(
      "conflicting_current_assertion_count",
    );
    expect(migration).toContain("count(distinct artist.id)");
    expect(migration).toContain("count(distinct track.id)");
    expect(migration).toContain("count(distinct release.id)");
  });

  it("creates only candidate assertions with bound evidence and exact verification", () => {
    expect(migration).toContain(
      "insert into public.registry_external_identifier_assertions",
    );
    expect(migration).toContain("'candidate'");
    expect(migration).not.toMatch(
      /insert\s+into\s+public\.registry_external_identifier_assertions[\s\S]*?'accepted'/i,
    );

    expect(migration).toContain(
      "platform_private.registry_evidence_assertions",
    );
    expect(migration).toContain(
      "registry.external_identifier_assertion.admit",
    );
    expect(migration).toContain(
      "public.registry_canonical_write_events",
    );
    expect(migration).toContain(
      "admit_external_identifier_assertion",
    );
    expect(migration).toContain(
      "verify_registry_external_identifier_admin_v1",
    );
  });

  it("keeps mutation authority behind manage_registry and private execution", () => {
    expect(migration).toContain("manage_registry is required.");
    expect(migration).toContain(
      "required_user_capability_key",
    );
    expect(migration).toContain("'manage_registry'");
    expect(migration).toContain(
      "grant execute on function",
    );
    expect(migration).toContain("to authenticated;");
    expect(migration).toContain(
      "from public,anon,service_role;",
    );
    expect(migration).toContain(
      "External identifier private executor leaked role authority",
    );
    expect(migration).toContain(
      "External identifier assertion table leaked direct insert authority",
    );
  });

  it("has a permanent verifier for runtime and future admitted rows", () => {
    expect(verifier).toContain(
      "MUSIC_METADATA_SLICE3_EXTERNAL_IDENTIFIER_ADMISSION_V1_PASS",
    );
    expect(verifier).toContain(
      "registry_external_identifier_admin",
    );
    expect(verifier).toContain(
      "registry.external_identifier_assertion.admit",
    );
    expect(verifier).toContain(
      "registry.external_identifier_assertion.reviewed_reconcile",
    );
    expect(verifier).toContain(
      "retained_registry_metadata",
    );
    expect(verifier).toContain(
      "assertion.assertion_status<>'candidate'",
    );
    expect(verifier).toContain(
      "operation.verifier_status<>'passed'",
    );
  });
});
