import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationDir = path.resolve("supabase/migrations");
const matches = fs.readdirSync(migrationDir).filter((name) =>
  name.endsWith("_phase_7a_post_kernel_business_logic_and_historical_event_hardening.sql"),
);
expect(matches).toHaveLength(1);

const migration = fs.readFileSync(path.join(migrationDir, matches[0]), "utf8");
const verifier = fs.readFileSync(
  path.resolve("scripts/control-plane/verify-phase-7a-kernel-closure.sql"),
  "utf8",
);

describe("Phase 7A final kernel closure", () => {
  it("repairs Audio working snapshot reuse with authority-revision equality", () => {
    expect(migration).toContain("v_current.source_authority_revision");
    expect(migration).toContain("v_publication.authority_revision");
    expect(verifier).toContain("Audio working-snapshot reuse is not revision-safe");
  });

  it("preserves correction content fingerprint through normal review submission", () => {
    expect(migration).toContain("v_working_version.version_kind = 'correction'");
    expect(migration).toContain("editorial.copy_article_lifecycle_version");
    expect(migration).toContain("v_prior_status");
    expect(verifier).toContain("correction submit does not preserve correction fingerprint");
  });

  it("freezes rather than deletes historical typed event evidence", () => {
    for (const table of [
      "editorial.article_lifecycle_events",
      "editorial.playlist_lifecycle_events",
      "editorial.playlist_review_events",
      "audio.publication_lifecycle_events",
      "audio.publication_review_events",
    ]) {
      expect(migration).toContain(table);
      expect(migration.toLowerCase()).not.toContain(`drop table ${table}`);
    }
    expect(migration).toContain("reject_frozen_historical_event_mutation");
    expect(verifier).toContain("retained typed event row lacks shared canonical mapping");
  });

  it("contracts all historical event application-role ACLs and policies", () => {
    expect(migration).toContain("drop policy if exists playlist_review_events_participant_read");
    expect(migration).toContain("from public, anon, authenticated, service_role");
    expect(verifier).toContain("historical typed event ACL is open");
    expect(verifier).toContain("retained historical event table has a live policy");
  });

  it("ratchets the final kernel shape instead of an intermediate compatibility checkpoint", () => {
    expect(verifier).toContain("editorial.resource_versions");
    expect(verifier).toContain("editorial.resource_lifecycle_events");
    expect(verifier).toContain("editorial.resource_review_events");
    expect(verifier).toContain("typed lifecycle pointer compatibility exists");
    expect(verifier).toContain("typed Video event authority exists");
    expect(verifier).toContain("PHASE_7A_KERNEL_CLOSURE_PASS");
  });

  it("keeps the final verifier read-only", () => {
    expect(verifier).toMatch(/^begin;/);
    expect(verifier).toContain("set local transaction read only;");
    expect(verifier).not.toMatch(
      /^\s*(insert|update|delete|alter|drop|create|grant|revoke)\b/im,
    );
  });
});
