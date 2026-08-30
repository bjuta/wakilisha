import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readOne(suffix: string): string {
  const dir = path.resolve("supabase/migrations");
  const matches = fs.readdirSync(dir).filter((name) => name.endsWith(suffix));
  expect(matches).toHaveLength(1);
  return fs.readFileSync(path.join(dir, matches[0]), "utf8");
}

function functionBody(sql: string, functionName: string): string {
  const start = sql.indexOf(`create or replace function ${functionName}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = sql.indexOf("create or replace function", start + 1);
  return sql.slice(start, next === -1 ? sql.length : next);
}

const migration = readOne(
  "_phase_7a_k5e_real_video_media_governance_boundary.sql",
);
const k4b = readOne(
  "_phase_7a_k4b_video_governed_lifecycle_commands.sql",
);
const verifier = fs.readFileSync(
  path.resolve(
    "scripts/control-plane/verify-phase-7a-k5e-real-video-media-governance-boundary.sql",
  ),
  "utf8",
);
const mediaService = fs.readFileSync(
  path.resolve("src/services/mediaService.ts"),
  "utf8",
);
const mediaEdit = fs.readFileSync(
  path.resolve("src/components/admin/media/MediaEditModal.tsx"),
  "utf8",
);

describe("Phase 7A K5E real Video Media governance boundary", () => {
  it("separates working exact-revision eligibility from public governance", () => {
    const workingGuard = functionBody(
      migration,
      "video.assert_exact_media_revision",
    );
    expect(workingGuard).toContain("verification_state");
    expect(workingGuard).toContain("asset_kind");
    expect(workingGuard).toContain("lifecycle_state");
    expect(workingGuard).not.toContain("rights_status");
    expect(workingGuard).not.toContain("consent_status");
    expect(workingGuard).not.toContain("public_safety_state");
    expect(workingGuard).not.toContain("source_protection_class");
  });

  it("preserves public Media governance at the governed publish boundary", () => {
    expect(k4b).toContain("video.assert_publishable_publication_version");
    expect(k4b).toContain("video.assert_publishable_media_revision");
    expect(k4b).toContain("approved_public");
    expect(k4b).toContain("rights_status");
    expect(k4b).toContain("consent_status");
    expect(k4b).toContain("source_protection_class");
    expect(k4b).toContain("retention_state");
  });

  it("reuses canonical Media governance authority instead of creating a Video-owned governance system", () => {
    expect(migration).toContain("public.get_media_asset_governance_admin");
    expect(migration).toContain("media.asset_governance_versions");
    expect(migration).toContain("review_media_governance");
    expect(migration).not.toMatch(/create\s+table\s+video\..*govern/i);
    expect(mediaService).toContain('"create_media_governance_version"');
    expect(mediaService).toContain('"get_media_asset_governance_admin"');
  });

  it("surfaces an explicit canonical governance review in the existing Media editor", () => {
    expect(mediaEdit).toContain("Usage governance");
    expect(mediaEdit).toContain("Public safety");
    expect(mediaEdit).toContain("Source protection");
    expect(mediaEdit).toContain("Consent");
    expect(mediaEdit).toContain("Save Governance Version");
  });

  it("keeps permanent verification read-only", () => {
    expect(verifier).toMatch(/^begin;/);
    expect(verifier).toContain("set local transaction read only;");
    expect(verifier).toContain(
      "PHASE_7A_K5E_REAL_VIDEO_MEDIA_GOVERNANCE_BOUNDARY_PASS",
    );
    expect(verifier).not.toMatch(
      /^\s*(insert|update|delete|alter|drop|create|grant|revoke)\b/im,
    );
  });

  it("keeps new UI copy free of em dashes", () => {
    const start = mediaEdit.indexOf("Usage governance");
    const end = mediaEdit.indexOf("{/* Identification */}", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(mediaEdit.slice(start, end)).not.toContain("—");
  });
});
