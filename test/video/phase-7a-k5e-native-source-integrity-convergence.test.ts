import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readOne(suffix: string): string {
  const dir = path.resolve("supabase/migrations");
  const matches = fs.readdirSync(dir).filter((name) => name.endsWith(suffix));
  expect(matches).toHaveLength(1);
  return fs.readFileSync(path.join(dir, matches[0]), "utf8");
}

function functionBody(sql: string, name: string): string {
  const start = sql.indexOf(`create or replace function ${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = sql.indexOf("create or replace function", start + 1);
  return sql.slice(start, next === -1 ? sql.length : next);
}

const migration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20260830173011_phase_7a_k5e_native_source_integrity_convergence.sql",
  ),
  "utf8",
);
const k4b = readOne(
  "_phase_7a_k4b_video_governed_lifecycle_commands.sql",
);
const verifier = fs.readFileSync(
  path.resolve(
    "scripts/control-plane/verify-phase-7a-k5e-native-source-integrity-convergence.sql",
  ),
  "utf8",
);

describe("Phase 7A K5E native source integrity convergence", () => {
  it("keeps native Video source registration exact and verified", () => {
    const sourceGuard = functionBody(
      migration,
      "video.enforce_source_integrity",
    );

    expect(sourceGuard).toContain("asset.asset_kind");
    expect(sourceGuard).toContain("asset.lifecycle_state");
    expect(sourceGuard).toContain("revision.asset_id");
    expect(sourceGuard).toContain("file_row.verification_state");
    expect(sourceGuard).toContain("Native Video source requires one exact verified revision");
  });

  it("does not require public governance merely to register working native source identity", () => {
    const sourceGuard = functionBody(
      migration,
      "video.enforce_source_integrity",
    );

    for (const forbidden of [
      "rights_status",
      "consent_status",
      "public_safety_state",
      "source_protection_class",
      "retention_state",
      "embargo_state",
    ]) {
      expect(sourceGuard).not.toContain(forbidden);
    }
  });

  it("preserves public Media governance at the governed publication boundary", () => {
    expect(k4b).toContain("video.assert_publishable_media_revision");
    expect(k4b).toContain("video.assert_publishable_publication_version");
    expect(k4b).toContain("rights_status");
    expect(k4b).toContain("consent_status");
    expect(k4b).toContain("public_safety_state");
    expect(k4b).toContain("source_protection_class");
    expect(k4b).toContain("retention_state");
    expect(k4b).toContain("embargo_state");
  });

  it("keeps the permanent verifier read-only", () => {
    expect(verifier).toContain("set local transaction read only;");
    expect(verifier).toContain(
      "PHASE_7A_K5E_NATIVE_SOURCE_INTEGRITY_CONVERGENCE_PASS",
    );
    expect(verifier).not.toMatch(
      /^\s*(insert|update|delete|alter|drop|create|grant|revoke)\b/im,
    );
  });
});
