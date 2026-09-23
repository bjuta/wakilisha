import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const migration = read(
  "supabase/migrations/20260923130246_music_identity_rights_slice3_release_label_admission_v1.sql",
);
const verifier = read(
  "scripts/control-plane/verify-music-metadata-release-label-admission-v1.sql",
);

describe("Music metadata Slice 3 Release Label admission", () => {
  it("creates a narrow typed Release-to-Label operation", () => {
    expect(migration).toContain("admit_registry_release_label_link");
    expect(migration).toContain("registry.release.label_link.admit");
    expect(migration).toContain("array['release']::text[]");
    expect(migration).toContain("requires_existing_target");
    expect(migration).toContain("max_rows_ceiling");
    expect(migration).toContain("manage_registry is required.");
  });

  it("keeps matching exact and non-fuzzy", () => {
    expect(migration).toContain("metadata->>'record_label'");
    expect(migration).toContain("[[:space:]]+");
    expect(migration).toContain("exact_label_match_count");
    expect(migration).toContain("exact_organization_match_count");
    expect(migration).toContain("exact_label_candidate");
    expect(migration).toContain("review_only");

    expect(migration).not.toContain("[^[:alnum:]]+");
    expect(migration).not.toMatch(/similarity\s*\(/i);
    expect(migration).not.toMatch(/levenshtein/i);
    expect(migration).not.toMatch(/trigram/i);
  });

  it("does not infer or mutate Organisation-to-Label identity", () => {
    expect(migration).toContain("editorial.organizations");
    expect(migration).not.toContain(
      "insert into editorial.organization_registry_label_links",
    );
    expect(migration).not.toContain(
      "update editorial.organization_registry_label_links",
    );
    expect(migration).not.toContain(
      "delete from editorial.organization_registry_label_links",
    );
  });

  it("mutates only label_id on an unbound Release", () => {
    expect(migration).toContain("release.label_id is null");
    expect(migration).toContain("label_id=v_label_id");
    expect(migration).toContain(
      "array['label_id','updated_at']::text[]",
    );
    expect(migration).toContain(
      "WK_RELEASE_LABEL_ALREADY_BOUND",
    );
    expect(migration).toContain(
      "WK_STALE_RELEASE_LABEL_TARGET",
    );
    expect(migration).toContain(
      "WK_STALE_RELEASE_LABEL_CANDIDATE",
    );
    expect(migration).toContain(
      "WK_RELEASE_LABEL_REVIEW_REQUIRED",
    );

    expect(migration).not.toMatch(
      /update\s+public\.registry_releases[\s\S]*?title\s*=/i,
    );
    expect(migration).not.toMatch(
      /update\s+public\.registry_releases[\s\S]*?artwork_url\s*=/i,
    );
  });

  it("binds evidence, exact grants, one write event, and independent verification", () => {
    expect(migration).toContain(
      "platform_private.registry_evidence_assertions",
    );
    expect(migration).toContain(
      "platform_private.registry_execution_grants",
    );
    expect(migration).toContain(
      "'trust_class',v_evidence.trust_class",
    );
    expect(migration).toContain(
      "platform_private.registry_execution_grant_targets",
    );
    expect(migration).toContain(
      "platform_private.registry_operation_write_events",
    );
    expect(migration).toContain(
      "public.registry_canonical_write_events",
    );
    expect(migration).toContain("admit_release_label_link");
    expect(migration).toContain(
      "verify_registry_release_label_admin_v1",
    );
  });

  it("keeps the public wrapper human-gated and private execution closed", () => {
    expect(migration).toContain(
      "public.admin_admit_registry_release_label_candidate_v1",
    );
    expect(migration).toContain("to authenticated;");
    expect(migration).toContain("from public,anon,service_role;");
    expect(migration).toContain(
      "Release Label private executor leaked execution authority",
    );
    expect(migration).toContain(
      "Release Label admin gained standing autonomous authority",
    );
  });

  it("has a permanent verifier for future admitted rows", () => {
    expect(verifier).toContain(
      "MUSIC_METADATA_SLICE3_RELEASE_LABEL_ADMISSION_V1_PASS",
    );
    expect(verifier).toContain("registry_release_label_admin");
    expect(verifier).toContain("registry.release.label_link.admit");
    expect(verifier).toContain("retained_registry_metadata");
    expect(verifier).toContain("event.field_name<>'label_id'");
    expect(verifier).toContain("operation.verifier_status<>'passed'");
  });
});
