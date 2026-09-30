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
    expect(runtime).toContain(
      "pam authentication failed",
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
      "const compatibleScopes =",
    );
    expect(controlPlane).toContain(
      "candidate.capability_grant_id ===",
    );
    expect(controlPlane).toContain(
      "reviewedMatches.length !== 1",
    );
    expect(controlPlane).not.toContain(
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

  it("executes reviewed Public Music Identity Batch A only through the existing exact MIZIZI broker", () => {
    const workflow = readFileSync(
      ".github/workflows/mizizi-url-identity-production-control-plane.yml",
      "utf8",
    );
    const batch = readFileSync(
      "scripts/control-plane/public-music-identity-batch-a-production-control-plane.mjs",
      "utf8",
    );
    const actualZero = readFileSync(
      "scripts/control-plane/public-music-identity-track-actual-zero-audit.mjs",
      "utf8",
    );
    const currentControlPlane = readFileSync(
      "scripts/control-plane/mizizi-url-identity-production-control-plane.mjs",
      "utf8",
    );

    expect(currentControlPlane).toContain(
      "EXPECTED_BATCH_A_DUPLICATE_IDENTITY_NOISE_REMAINING = 17",
    );
    expect(currentControlPlane).toContain(
      "EXPECTED_BATCH_A_SAFE_SLUG_IDENTITY_NOISE_REMAINING = 12",
    );
    expect(currentControlPlane).toContain(
      "ACCEPTED_TRACK_AUDIT_SNAPSHOTS",
    );
    expect(currentControlPlane).toContain(
      "recordingIdentityConflict: 71",
    );
    expect(currentControlPlane).toContain(
      "tracks: 2091",
    );
    expect(currentControlPlane).toContain(
      "public_music_identity_batch_a_safe_slug",
    );
    expect(currentControlPlane).toContain(
      "EXPECTED_BATCH_A_SAFE_SLUG_CANDIDATE_FINGERPRINT",
    );
    expect(currentControlPlane).toContain(
      "363bed8410570611a8cdf43194f7b47a0e0f380877fac342201fc48e2b6576e9",
    );

    expect(workflow).toContain(
      "public_music_identity_batch_a_safe_slug",
    );
    expect(workflow).toContain(
      "public-music-identity-batch-a-production-control-plane.mjs",
    );
    expect(workflow).toContain(
      ".github/public-music-identity-batch-a-safe-slug-apply.json",
    );
    expect(workflow).toContain(
      "PUBLIC_MUSIC_IDENTITY_BATCH_A_APPLY",
    );
    expect(workflow).toContain(
      'test "$GITHUB_REF" = "refs/heads/main"',
    );
    expect(workflow).toContain(
      "MIZIZI_TRIGGER_FILE=.github/public-music-identity-batch-a-safe-slug-apply.json",
    );
    expect(workflow).toContain(
      "inputs.operation == 'public_music_identity_batch_a_safe_slug'",
    );

    expect(batch).toContain(
      "PUBLIC_MUSIC_IDENTITY_BATCH_A_SAFE_SLUG_EXECUTOR=PASS",
    );
    expect(batch).toContain(
      "assertReviewedTrigger",
    );
    expect(batch).toContain(
      "PUBLIC_MUSIC_IDENTITY_BATCH_A_SAFE_SLUG_APPLY",
    );
    expect(batch).toContain(
      "issue_stewardship_execution_grant_v1",
    );
    expect(batch).toContain(
      "execute_stewardship_operation_v2",
    );
    expect(batch).toContain(
      "verify_stewardship_operation_v2",
    );
    expect(batch).not.toContain(
      "execute_stewardship_operation_v1",
    );
    expect(batch).not.toContain(
      "verify_stewardship_operation_v1",
    );
    expect(batch).toContain(
      "capability_grant_id",
    );
    expect(batch).toContain(
      "assertHumanAuthority",
    );
    expect(batch).toContain(
      "close_stewardship_authority_window_v1",
    );
    expect(batch).toContain(
      "assertZeroAtRest",
    );
    expect(batch).toContain(
      "exact human Track-slug stewardship authority accepted",
    );
    expect(batch).toContain(
      "public_music_identity_safe_slug_repair",
    );
    expect(batch).toContain(
      "Expected 5 recorded safe-slug decisions and 10 fully resolved duplicate reviews.",
    );
    expect(batch).toContain(
      "740dbe7e-b423-4e69-b479-83dc91a76da2",
    );
    expect(batch).toContain(
      "d723ff1e-31ad-42ff-9fe0-871c9b9e9b52",
    );
    expect(batch).not.toMatch(
      /\b(?:insert\s+into|update|delete\s+from)\s+public\.registry_tracks/i,
    );
    expect(batch).not.toMatch(
      /\b(?:insert\s+into|update|delete\s+from)\s+public\.registry_review_items/i,
    );

    expect(workflow).toContain(
      "public-music-identity-track-actual-zero-audit.mjs",
    );
    expect(actualZero).toContain(
      "OPEN_SCOPED_REVIEWS=",
    );
    expect(actualZero).toContain(
      "ACTIVE_FEATURE_SLUG_COUNT=",
    );
    expect(actualZero).toContain(
      "ACTIVE_FEATURE_SLUG_OUTSIDE_OPEN_SCOPE=",
    );
    expect(actualZero).toContain(
      "ACTIVE_FEATURE_SLUG_WITH_RESOLVED_SCOPE=",
    );
    expect(actualZero).toContain(
      "ACTIVE_SYNTHETIC_SUFFIX_COUNT=",
    );
    expect(actualZero).toContain(
      "ACTIVE_ROUTE_MANIFEST_FINGERPRINT=",
    );
    expect(actualZero).toContain(
      "DIRTY_PUBLIC_TRACK_ROUTE ",
    );
    expect(actualZero).toContain(
      "SYNTHETIC_PUBLIC_TRACK_ROUTE ",
    );
    expect(actualZero).toContain(
      "track.slug ~ '-[0-9a-f]{6}$'",
    );
    expect(actualZero).toContain(
      "PUBLIC_MUSIC_IDENTITY_TRACK_ACTUAL_ZERO=PASS",
    );
    expect(actualZero).not.toMatch(
      /\b(?:insert\s+into|update|delete\s+from)\s+(?:public|platform_private)\./i,
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
      '"2a3b157bb2390e1468f1e2682eeb4f0955a8a0fc"',
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
      "EXPECTED_RELEASE_SINGLE_TRACK_ZERO_REVIEW_FOLLOWUP_CANDIDATES = 5",
    );
    expect(controlPlane).toContain(
      "cdf6933fade7380f8557523ca2f2096465498e9c356293104aaf7f0540b7a684",
    );
    expect(controlPlane).toContain(
      "8ea62e193987bd875ec584caaca23a4db021e2b6644c9bede13abeb6d457f430",
    );
    expect(controlPlane).toContain(
      "releaseSinglePortableHandoffSnapshot",
    );

    const portableStart = controlPlane.indexOf(
      "function releaseSinglePortableHandoffSnapshot",
    );
    const portableEnd = controlPlane.indexOf(
      "function trackZeroCandidateEnvelope",
      portableStart,
    );
    const portableHelper = controlPlane.slice(
      portableStart,
      portableEnd,
    );

    expect(portableStart).toBeGreaterThanOrEqual(0);
    expect(portableEnd).toBeGreaterThan(portableStart);
    expect(portableHelper).toContain(
      "'expected_row_budget'",
    );
    expect(portableHelper).not.toContain(
      "expected_release_state_fingerprint",
    );
    expect(portableHelper).not.toContain(
      "expected_track_state_fingerprint",
    );
    expect(portableHelper).not.toContain(
      "alignment_state_fingerprint",
    );
    expect(controlPlane).toContain(
      "materialized_track_zero_followup",
    );
    expect(controlPlane).toContain(
      "Release Single Track-zero review follow-up",
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
      "PUBLIC_MUSIC_IDENTITY_RELEASE_SINGLE_TRACK_FOLLOWUP_APPLY",
    );
    expect(controlPlane).toContain(
      "programmeIssue: 1091",
    );
    expect(controlPlane).toContain(
      "EXPECTED_RELEASE_SINGLE_TRACK_FOLLOWUP_TOTAL_VERIFIED = 88",
    );
    expect(controlPlane).toContain(
      "EXPECTED_RELEASE_SINGLE_TRACK_FOLLOWUP_TOTAL_REVIEWS = 40",
    );
    expect(controlPlane).toContain(
      "expected_release_ids",
    );
    expect(controlPlane).toContain(
      "accepted_final_all_track_followups",
    );
    expect(controlPlane).toContain(
      "accepted_partial_track_slug_followups",
    );
    expect(controlPlane).toContain(
      "release-single-track-followup:",
    );
    expect(controlPlane).toContain(
      "Release Single identity replay/idempotence did not pass",
    );
    expect(controlPlane).toContain(
      "nonzero_redirect_receipts",
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
      "Historical clean-replay boundary",
    );
    expect(migration).not.toContain(
      "Track-slug zero candidate count drifted from 34.",
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


  it("owns the five newly primary-scoped Track slug follow-up reviews without widening the mutation primitive", () => {
    const migration = readFileSync(
      "supabase/migrations/20260925213519_public_music_identity_track_slug_primary_followup_v1.sql",
      "utf8",
    );
    const verifier = readFileSync(
      "scripts/control-plane/verify-public-music-identity-track-slug-primary-followup-v1.sql",
      "utf8",
    );

    expect(migration).toContain(
      "track_slug_primary_followup_candidate_v1",
    );
    expect(migration).toContain(
      "Historical clean-replay boundary",
    );
    expect(migration).not.toContain(
      "STOP: #1087 exact five-row candidate freeze drifted.",
    );
    expect(migration).not.toContain(
      "STOP: #1087 residual review boundary drifted.",
    );
    expect(migration).not.toContain(
      "STOP: Nana holdout boundary drifted.",
    );
    expect(migration).toContain(
      "finalize_track_slug_primary_followup_v1",
    );
    expect(migration).toContain(
      "registry.track_slug.canonicalize",
    );
    expect(migration).toContain(
      "execute_stewardship_operation_v2",
    );
    expect(migration).toContain(
      "verify_stewardship_operation_v2",
    );
    expect(migration).toContain(
      "close_stewardship_authority_window_v1",
    );
    expect(migration).toContain(
      "missing_explicit_primary_artist_scope",
    );
    expect(migration).toContain(
      "release_primary_review",
    );
    expect(migration).toContain(
      "registry-release-primary-review-v1",
    );
    expect(migration).toContain(
      "source_review_id",
    );
    expect(migration).toContain(
      "71d13b5535983bf937fcb0c0dbbf3b790e0961f8e8b0543c742b8d9d9f6c7cdf",
    );
    expect(migration).toContain(
      "public_music_identity_track_slug_primary_followup",
    );
    expect(migration).toContain(
      "auto_resolved_release_primary_scope_blocker",
    );
    expect(migration).not.toMatch(
      /^\s*(?:insert\s+into|update|delete\s+from)\s+public\.wk_slug_redirects\b/im,
    );
    expect(migration).not.toContain(
      "create or replace function mizizi_private.execute_stewardship_operation_v2",
    );

    expect(verifier).toContain(
      "PUBLIC_MUSIC_IDENTITY_TRACK_SLUG_PRIMARY_FOLLOWUP_V1_PASS",
    );
    expect(verifier).toContain(
      "v_candidate_count=5",
    );
    expect(verifier).toContain(
      "v_candidate_count=0",
    );
    expect(verifier).toContain(
      "v_identity_noise<>27",
    );
    expect(verifier).toContain(
      "v_collision_reviews<>26",
    );
    expect(verifier).toContain(
      "v_missing_primary<>1",
    );
    expect(verifier).toContain(
      "v_credit_gap<>12",
    );
    expect(verifier).toContain(
      "35a58395-668e-4b19-b044-9d8af6d6910a",
    );
  });


  it("integrates #1087 into the shared JIT control plane without duplicating Track mutation authority", () => {
    const workflow = readFileSync(
      ".github/workflows/mizizi-url-identity-production-control-plane.yml",
      "utf8",
    );
    const controlPlane = readFileSync(
      "scripts/control-plane/mizizi-url-identity-production-control-plane.mjs",
      "utf8",
    );

    expect(workflow).toContain(
      ".github/public-music-identity-track-slug-primary-followup-apply.json",
    );
    expect(workflow).toContain(
      "20260925213519_public_music_identity_track_slug_primary_followup_v1.sql",
    );
    expect(workflow).toContain(
      "verify-public-music-identity-track-slug-primary-followup-v1.sql",
    );

    expect(controlPlane).toContain(
      'TRACK_PRIMARY_FOLLOWUP_MIGRATION_VERSION =\n  "20260925213519"',
    );
    expect(controlPlane).toContain(
      "EXPECTED_TRACK_PRIMARY_FOLLOWUP_CANDIDATES = 5",
    );
    expect(controlPlane).toContain(
      "71d13b5535983bf937fcb0c0dbbf3b790e0961f8e8b0543c742b8d9d9f6c7cdf",
    );
    expect(controlPlane).toContain(
      "track_slug_primary_followup: {",
    );
    expect(controlPlane).toContain(
      "track_slug_primary_followup_candidate_v1",
    );
    expect(controlPlane).toContain(
      "executeTrackSlugPrimaryFollowupPlans",
    );
    expect(controlPlane).toContain(
      "public-music-track-primary-followup:",
    );
    expect(controlPlane).toContain(
      "finalize_track_slug_primary_followup_v1",
    );
    expect(controlPlane).toContain(
      "reviewedMatches.length !== 1",
    );
    expect(controlPlane).toContain(
      "active MIZIZI human authority does not resolve to exactly one reviewed trigger by capability-grant id",
    );
    expect(controlPlane).toContain(
      "EXPECTED_RELEASE_SINGLE_TRACK_PRIMARY_FOLLOWUP_CANDIDATES = 8",
    );
    expect(controlPlane).toContain(
      'releaseSingleState =\n          "accepted_final_track_slug_followups"',
    );
    expect(controlPlane).toContain(
      "primaryFollowupDerivedCount: 2",
    );
    expect(controlPlane).toContain(
      "preserved_release_rows",
    );
    expect(controlPlane).toContain(
      "nana_open",
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
      "ACCEPTED_TRACK_AUDIT_SNAPSHOTS",
    );
    expect(controlPlane).toContain(
      "EXPECTED_BATCH_A_DUPLICATE_IDENTITY_NOISE_REMAINING = 17",
    );
    expect(controlPlane).toContain(
      "EXPECTED_BATCH_A_SAFE_SLUG_IDENTITY_NOISE_REMAINING = 12",
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
