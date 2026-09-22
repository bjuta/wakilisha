import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("MIZIZI current URL-identity production control plane", () => {
  it("keeps the current programme on the shared Stage C JIT boundary", () => {
    const workflow = readFileSync(
      ".github/workflows/mizizi-url-identity-production-control-plane.yml",
      "utf8",
    );
    const trackWorkflow = readFileSync(
      ".github/workflows/mizizi-track-production-control-plane.yml",
      "utf8",
    );
    const releaseWorkflow = readFileSync(
      ".github/workflows/mizizi-release-production-control-plane.yml",
      "utf8",
    );
    const runtime = readFileSync(
      "scripts/control-plane/mizizi-production-jit-runtime.mjs",
      "utf8",
    );
    const controlPlane = readFileSync(
      "scripts/control-plane/mizizi-url-identity-production-control-plane.mjs",
      "utf8",
    );

    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("push:");
    expect(workflow).toContain(
      ".github/mizizi-url-identity-production-apply.json",
    );
    expect(workflow).toContain(
      "group: mizizi-production-jit-control-plane",
    );
    expect(trackWorkflow).toContain(
      "group: mizizi-production-jit-control-plane",
    );
    expect(releaseWorkflow).toContain(
      "group: mizizi-production-jit-control-plane",
    );
    expect(workflow).toContain("queue: max");
    expect(workflow).not.toContain("cancel-in-progress:");

    expect(runtime).toContain(
      "current programme transport = mizizi_executor",
    );
    expect(runtime).toContain("-c jit=true");
    expect(runtime).toContain(
      "production temporary access must be disabled at rest",
    );
    expect(runtime).toContain(
      "managementProjectRef = projectRef",
    );
    expect(runtime).toContain(
      '"/v1/projects/" + managementProjectRef + "/jit-access"',
    );
    expect(runtime).toContain(
      "production temporary access disabled at rest",
    );
    expect(runtime).not.toContain("return 'postgres'");
    expect(runtime).not.toContain('role: "postgres"');

    expect(controlPlane).toContain(
      "MIZIZI_URL_IDENTITY_PRODUCTION_APPLY",
    );
    expect(controlPlane).toContain(
      "b96da159df4ffa8b19a5bb39574995a6b25cac2552823ef24af8f737fb1278be",
    );
    expect(controlPlane).toContain(
      "28a3b8362f8721ad4f35045a2cd938d265adf35373b522b492054af80eb8a910",
    );
    expect(controlPlane).toContain(
      "registry.release_slug.canonicalize",
    );
    expect(controlPlane).toContain(
      "registry.chart_track_slug.synchronize",
    );
    expect(controlPlane).not.toMatch(
      /^\s*track_slug:\s*\{/m,
    );
    expect(controlPlane).toContain(
      "close_stewardship_authority_window_v1",
    );
    expect(controlPlane).toContain(
      "active_standing_total: 1",
    );
    expect(controlPlane).toContain(
      "active_exact_total: 0",
    );
    expect(controlPlane).toContain(
      "assertZeroAtRest",
    );
    expect(controlPlane).toContain(
      "assertPreflightAuthority",
    );
    expect(controlPlane).toContain(
      '"reviewed_human_authority"',
    );
    expect(controlPlane).toContain(
      "preflight reviewed authority census",
    );
    expect(controlPlane).toContain(
      "active_standing: 1",
    );
    expect(controlPlane).toContain(
      "enabled_operations: 1",
    );
    expect(controlPlane).toContain(
      "readReviewedTrigger(REVIEWED_TRIGGER_FILE)",
    );
    expect(controlPlane).toContain(
      "PASS: preflight entry authority = ",
    );
    expect(controlPlane).toContain(
      "--confirm=MIZIZI_APPLY",
    );

  });

  it("adds only executor-bound authority reduction", () => {
    const migration = readFileSync(
      "supabase/migrations/20260922143000_mizizi_url_identity_authority_window_close_v1.sql",
      "utf8",
    );
    const verifier = readFileSync(
      "scripts/control-plane/verify-mizizi-url-identity-authority-window-close.sql",
      "utf8",
    );

    expect(migration).toContain(
      "close_stewardship_authority_window_v1",
    );
    expect(migration).toContain(
      "perform mizizi_private.assert_executor_v1()",
    );
    expect(migration).toContain(
      "grant execute on function",
    );
    expect(migration).toContain("to mizizi_executor");
    expect(migration).toContain("status='expired'");
    expect(migration).toContain("enabled=false");
    expect(migration).not.toMatch(
      /set\s+enabled\s*=\s*true/i,
    );
    expect(migration).not.toMatch(
      /set\s+status\s*=\s*'active'/i,
    );
    expect(migration).not.toContain(
      "admin_issue_mizizi_stewardship_capability_grant_v1(",
    );
    expect(migration).not.toContain(
      "admin_set_mizizi_stewardship_operation_enabled_v1(",
    );

    expect(verifier).toContain(
      "MIZIZI_URL_IDENTITY_AUTHORITY_WINDOW_CLOSE_PASS",
    );
    expect(verifier).toContain(
      "Active MIZIZI standing authority exists at rest",
    );
    expect(verifier).toContain(
      "MIZIZI stewardship operations are not disabled at rest",
    );
  });

  it("seals exact Release slug partial-stop resume integrity", () => {
    const workflow = readFileSync(
      ".github/workflows/mizizi-url-identity-production-control-plane.yml",
      "utf8",
    );
    const migration = readFileSync(
      "supabase/migrations/20260922171632_mizizi_release_slug_resume_integrity_v1.sql",
      "utf8",
    );
    const verifier = readFileSync(
      "scripts/control-plane/verify-mizizi-release-slug-resume-integrity.sql",
      "utf8",
    );
    const controlPlane = readFileSync(
      "scripts/control-plane/mizizi-url-identity-production-control-plane.mjs",
      "utf8",
    );

    expect(workflow).toContain(
      "20260922171632_mizizi_release_slug_resume_integrity_v1.sql",
    );
    expect(workflow).toContain(
      "verify-mizizi-release-slug-resume-integrity.sql",
    );

    expect(migration).toContain(
      "v_prior_mizizi_date_fallback",
    );
    expect(migration).toContain(
      "registry_canonical_write_events",
    );
    expect(migration).toContain(
      "event.action='canonicalize_release_slug'",
    );
    expect(migration).toContain(
      "event.status='succeeded'",
    );
    expect(migration).toContain(
      "event.actor='system:mizizi'",
    );
    expect(migration).toContain(
      "event.source_table='mizizi_private.release_slug_plan_v1'",
    );
    expect(migration).toContain(
      "event.before_value->>'value'",
    );
    expect(migration).toContain(
      "event.after_value->>'value'=other.slug",
    );
    expect(migration).not.toMatch(
      /set\s+enabled\s*=\s*true/i,
    );
    expect(migration).not.toMatch(
      /set\s+status\s*=\s*'active'/i,
    );

    expect(verifier).toContain(
      "MIZIZI_RELEASE_SLUG_RESUME_INTEGRITY_PASS",
    );
    expect(verifier).toContain(
      "Active MIZIZI standing authority exists at rest",
    );
    expect(verifier).toContain(
      "MIZIZI Release slug operation is enabled at rest",
    );

    expect(controlPlane).toContain(
      '"scripts/registry/agents/mizizi/run.ts":',
    );
    expect(controlPlane).toContain(
      '"3f6870d1605786786d78643efd0d97dc54d2d47e"',
    );
    expect(controlPlane).toContain(
      "executeReleaseResumePlans",
    );
    expect(controlPlane).toContain(
      "issue_stewardship_execution_grant_v1",
    );
    expect(controlPlane).toContain(
      "execute_stewardship_operation_v1",
    );
    expect(controlPlane).toContain(
      "verify_stewardship_operation_v1",
    );
    expect(controlPlane).toContain(
      '"accepted_partial_release_resume"',
    );

    expect(controlPlane).toContain(
      "ACCEPTED_RELEASE_PARTIAL_VERIFIED = 731",
    );
    expect(controlPlane).toContain(
      "ACCEPTED_RELEASE_PARTIAL_REMAINING = 6",
    );
    expect(controlPlane).toContain(
      "2be28e013ce904e2a05f5d3c368304684c08a6ad7eadfe23a99c57162d0091b2",
    );
    expect(controlPlane).toContain(
      "releaseProgrammeSnapshotFromHistory",
    );
    expect(controlPlane).not.toContain(
      "releaseProgrammeCandidateSql",
    );
    expect(controlPlane).toContain(
      '"accepted_partial"',
    );
    expect(controlPlane).toContain(
      "expectedApplyCount",
    );
    expect(controlPlane).toContain(
      "Resume migration: pending Production promotion",
    );
  });

  it("keeps blocked Track, Release title and Chart Artist findings non-mutating", () => {
    const controlPlane = readFileSync(
      "scripts/control-plane/mizizi-url-identity-production-control-plane.mjs",
      "utf8",
    );
    const core = readFileSync(
      "scripts/registry/agents/mizizi/core.ts",
      "utf8",
    );

    expect(controlPlane).toContain(
      "slugNoise: 66",
    );
    expect(controlPlane).toContain(
      "titlePackaging: slugPackaging",
    );
    expect(controlPlane).toContain(
      "artistSlug: 91",
    );
    expect(core).toContain(
      'ruleId: "release_title_provider_packaging"',
    );
    expect(core).toContain(
      'ruleId: "chart_artist_slug_drift"',
    );
    expect(core).toContain(
      'disposition: "observe"',
    );
  });
});
