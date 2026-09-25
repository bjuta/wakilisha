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
      "readReviewedTrigger(activeScope.triggerFile)",
    );
    expect(controlPlane).toContain(
      "LEGACY_REVIEWED_TRIGGER_FILE",
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
      '"9d17f2838aeed154d3b93abbcfe687ba6c38be94"',
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

  it("recognizes exact accepted-final Chart Track-slug state", () => {
    const controlPlane = readFileSync(
      "scripts/control-plane/mizizi-url-identity-production-control-plane.mjs",
      "utf8",
    );

    expect(controlPlane).toContain(
      "chartProgrammeSnapshotFromHistory",
    );
    expect(controlPlane).toContain(
      "grant_row.plan_payload->>'expected_state_fingerprint'",
    );
    expect(controlPlane).toContain(
      '"Chart Track-slug journal/write-event parity is not exact"',
    );
    expect(controlPlane).toContain(
      '"Chart Track-slug programme state is not a recognized exact boundary: "',
    );
    expect(controlPlane).toContain(
      'chartState = "accepted_final"',
    );
    expect(controlPlane).toContain(
      "chartCurrent.candidateCount === 0",
    );
    expect(controlPlane).toContain(
      "candidateCount: EXPECTED_CHART_CANDIDATES",
    );
    expect(controlPlane).toContain(
      "candidateFingerprint:",
    );
    expect(controlPlane).toContain(
      "EXPECTED_CHART_CANDIDATE_FINGERPRINT",
    );
    expect(controlPlane).toContain(
      "currentChartCandidates",
    );
    expect(controlPlane).toContain(
      '"Chart programme state: "',
    );
  });

  it("governs one-track Release public identity without Track mutation or redirects", () => {
    const workflow = readFileSync(
      ".github/workflows/mizizi-url-identity-production-control-plane.yml",
      "utf8",
    );
    const controlPlane = readFileSync(
      "scripts/control-plane/mizizi-url-identity-production-control-plane.mjs",
      "utf8",
    );
    const migration = readFileSync(
      "supabase/migrations/20260925082706_public_music_identity_slice3_release_single_alignment_v1.sql",
      "utf8",
    );
    const verifier = readFileSync(
      "scripts/control-plane/verify-public-music-identity-slice3-release-single-alignment.sql",
      "utf8",
    );

    expect(workflow).toContain(
      ".github/public-music-identity-release-single-alignment-apply.json",
    );
    expect(workflow).toContain(
      "Resolve reviewed Production intent",
    );
    expect(workflow).toContain(
      "20260925082706_public_music_identity_slice3_release_single_alignment_v1.sql",
    );
    expect(workflow).toContain(
      "verify-public-music-identity-slice3-release-single-alignment.sql",
    );
    expect(workflow).toContain(
      "MIZIZI_CONTROL_PLANE_MODE: preflight",
    );

    expect(controlPlane).toContain(
      "registry.release_single_identity.align",
    );
    expect(controlPlane).toContain(
      "align_registry_release_single_identity",
    );
    expect(controlPlane).toContain(
      "EXPECTED_RELEASE_SINGLE_CANDIDATES = 80",
    );
    expect(controlPlane).toContain(
      "EXPECTED_RELEASE_SINGLE_TRACK_ZERO_FOLLOWUP_CANDIDATES = 6",
    );
    expect(controlPlane).toContain(
      "f8fbbc8ddef665202ff3edf62398244395bd584e9b1cd5ed1152ec2eb2ac5b0e",
    );
    expect(controlPlane).toContain(
      "accepted_final_track_zero_followup",
    );
    expect(controlPlane).toContain(
      "exact_track_zero_derived_count",
    );
    expect(controlPlane).toContain(
      "track_zero_decision_count",
    );
    expect(controlPlane).toContain(
      "EXPECTED_TRACK_ZERO_CANDIDATE_FINGERPRINT",
    );
    expect(controlPlane).toContain(
      "8cb08c3447b0e8acaf3279ef7b0317e915783b87a7e37678976b01fd02401eab",
    );
    expect(controlPlane).toContain(
      "EXPECTED_RELEASE_SINGLE_REVIEWS = 35",
    );
    expect(controlPlane).toContain(
      "expected_review_count",
    );
    expect(controlPlane).toContain(
      "expected_review_fingerprint",
    );
    expect(controlPlane).toContain(
      "3e6ce99990ebd2e3bb5bbfd2600748da20104696bff3ced7875e4d5fe358638d",
    );
    expect(controlPlane).toContain(
      "bb2a936a8082a506d9b6e1ba94236c2b0aad446b",
    );
    expect(controlPlane).toContain(
      "queueReleaseSingleIdentityReviews",
    );
    expect(controlPlane).toContain(
      "executeReleaseSingleIdentityPlans",
    );
    expect(controlPlane).toContain(
      "releaseSingleProgrammeSnapshotFromHistory",
    );
    expect(controlPlane).toContain(
      "releaseSingleReviewProgrammeSnapshotFromHistory",
    );
    expect(controlPlane).toContain(
      "const guard =\n        queryViaLinkedCli(`",
    );
    expect(controlPlane).not.toContain(
      "const guard =\n        await jit.pool.query(`",
    );
    expect(controlPlane).toContain(
      "close_release_single_identity_authority_window_v1",
    );
    expect(controlPlane).toContain(
      "PUBLIC_MUSIC_IDENTITY_RELEASE_SINGLE_ALIGNMENT_APPLY",
    );
    expect(controlPlane).toContain(
      "programmeIssue: 1068",
    );

    expect(migration).toContain(
      "release_single_identity_analysis_v1",
    );
    expect(migration).toContain(
      "release_single_identity_candidate_v1",
    );
    expect(migration).toContain(
      "release_single_identity_plan_v1",
    );
    expect(migration).toContain(
      "release_single_identity_review_candidate_v1",
    );
    expect(migration).toContain(
      "queue_release_single_identity_review_v1",
    );
    expect(migration).toContain(
      "issue_release_single_identity_execution_grant_v1",
    );
    expect(migration).toContain(
      "execute_release_single_identity_alignment_v1",
    );
    expect(migration).toContain(
      "verify_release_single_identity_alignment_v1",
    );
    expect(migration).toContain(
      "admin_open_mizizi_release_single_identity_authority_v1",
    );
    expect(migration).toContain(
      "close_release_single_identity_authority_window_v1",
    );
    expect(migration).toContain(
      "count(distinct credit.artist_slug)",
    );
    expect(migration).toContain(
      "community_thread_collision",
    );
    expect(migration).toContain(
      "release_single_identity_conflict",
    );
    expect(migration).toContain(
      "'1.4.0'",
    );
    expect(migration).toContain(
      "'/tracks/'",
    );
    expect(migration).toContain(
      "align_release_single_identity",
    );
    expect(migration).toContain(
      "'redirects_created',0",
    );
    expect(migration).not.toMatch(
      /^\s*update\s+public\.registry_tracks\b/im,
    );
    expect(migration).not.toMatch(
      /^\s*update\s+public\.registry_release_tracks\b/im,
    );
    expect(migration).not.toMatch(
      /^\s*(?:insert\s+into|update|delete\s+from)\s+public\.wk_slug_redirects\b/im,
    );
    expect(migration).not.toContain(
      "to_char(",
    );

    expect(verifier).toContain(
      "PUBLIC_MUSIC_IDENTITY_SLICE3_RELEASE_SINGLE_ALIGNMENT_PASS",
    );
    expect(verifier).toContain(
      "direct mizizi_executor mutation authority exists",
    );
    expect(verifier).toContain(
      "canonical-event / verified-operation parity",
    );
    expect(verifier).toContain(
      "forbidden redirect/date-suffix logic",
    );
  });

  it("converges stale Community Track slug blockers through V2 without redirects", () => {
    const workflow = readFileSync(
      ".github/workflows/mizizi-url-identity-production-control-plane.yml",
      "utf8",
    );
    const controlPlane = readFileSync(
      "scripts/control-plane/mizizi-url-identity-production-control-plane.mjs",
      "utf8",
    );
    const migration = readFileSync(
      "supabase/migrations/20260925141117_public_music_identity_track_slug_zero_v2.sql",
      "utf8",
    );

    expect(workflow).toContain(
      ".github/public-music-identity-track-slug-zero-apply.json",
    );
    expect(workflow).toContain(
      "20260925141117_public_music_identity_track_slug_zero_v2.sql",
    );

    expect(controlPlane).toContain(
      "EXPECTED_TRACK_ZERO_CANDIDATES = 34",
    );
    expect(controlPlane).toContain(
      "1f178ed3aff1ac2ba998eefec42ac1f8abdb62ed4e70a93471715552399f5669",
    );
    expect(controlPlane).toContain(
      "executeTrackSlugZeroPlans",
    );
    expect(controlPlane).toContain(
      "execute_stewardship_operation_v2",
    );
    expect(controlPlane).toContain(
      "verify_stewardship_operation_v2",
    );
    expect(controlPlane).toContain(
      "finalize_track_slug_zero_convergence_v1",
    );
    expect(controlPlane).toContain(
      'trackZeroState = "accepted_final"',
    );
    expect(controlPlane).toContain(
      '"Track-slug zero Production acceptance"',
    );

    expect(migration).toContain(
      "execute_stewardship_operation_v2",
    );
    expect(migration).toContain(
      "verify_stewardship_operation_v2",
    );
    expect(migration).toContain(
      "community_thread_track_pointer_mismatch",
    );
    expect(migration).toContain(
      "artist_scoped_track_v2",
    );
    expect(migration).toContain(
      "entity_id=v_track_id::text",
    );
    expect(migration).toContain(
      "finalize_track_slug_zero_convergence_v1",
    );
    expect(migration).toContain(
      "public_music_identity_track_slug_zero",
    );
    expect(migration).toContain(
      "1f178ed3aff1ac2ba998eefec42ac1f8abdb62ed4e70a93471715552399f5669",
    );
    expect(migration).not.toMatch(
      /^\s*(?:insert\s+into|update|delete\s+from)\s+public\.wk_slug_redirects\b/im,
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
      "EXPECTED_TRACK_ZERO_IDENTITY_NOISE_REMAINING = 32",
    );
    expect(controlPlane).toContain(
      "[\n        66,\n        EXPECTED_TRACK_ZERO_IDENTITY_NOISE_REMAINING,",
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
