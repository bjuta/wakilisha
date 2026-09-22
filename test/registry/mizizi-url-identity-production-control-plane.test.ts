import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

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
      "--confirm=MIZIZI_APPLY",
    );

    expect(
      existsSync(
        ".github/mizizi-url-identity-production-apply.json",
      ),
    ).toBe(false);
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
      "titlePackaging: 737",
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
