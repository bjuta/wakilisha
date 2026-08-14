import { describe, expect, it } from "vitest";
import fs from "node:fs";

const migration = fs.readFileSync(
  "docs/engineering/replay-baseline/legacy-migrations/20260806124500_phase_4a_media_deferred_pointer_trigger_authority.sql",
  "utf8",
);

const verifier = fs.readFileSync(
  "scripts/control-plane/verify-phase-4a-media-deferred-pointer-trigger-authority.sql",
  "utf8",
);

describe("Phase 4A deferred Media pointer-trigger authority", () => {
  it("moves only the deferred integrity trigger to owner authority", () => {
    expect(migration).toContain(
      "alter function media.enforce_asset_pointer_integrity()",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain(
      "set search_path = pg_catalog, media",
    );
    expect(migration).not.toContain(
      "grant select on media.asset_governance_versions to authenticated",
    );
    expect(migration).not.toContain(
      "disable row level security",
    );
  });

  it("keeps the trigger private from authenticated callers", () => {
    expect(migration).toContain(
      "from public, anon, authenticated",
    );
    expect(verifier).toContain(
      "Authenticated can execute the private trigger function",
    );
    expect(verifier).toContain(
      "Authenticated gained direct governance-table SELECT",
    );
  });

  it("forces the real deferred commit boundary under authenticated", () => {
    expect(verifier).toContain(
      "set local role authenticated",
    );
    expect(verifier).toContain(
      "set constraints all immediate",
    );
    expect(verifier).toContain(
      "create_media_asset_write_v2",
    );
    expect(verifier).toContain(
      "responsive_width",
    );
    expect(verifier).toContain(
      "PHASE_4A_MEDIA_DEFERRED_POINTER_TRIGGER_AUTHORITY_PASS",
    );
  });

  it("preserves the accepted production baseline after rollback", () => {
    expect(verifier).toContain(
      "(select count(*) from media.assets) <> 1079",
    );
    expect(verifier).toContain(
      "from media.asset_governance_versions",
    );
    expect(verifier).toContain(
      "(select count(*) from media.file_objects) <> 0",
    );
    expect(verifier).toContain(
      "(select count(*) from media.usage_links) <> 987",
    );
  });
});
