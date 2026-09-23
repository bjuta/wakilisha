import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runtime = readFileSync(
  "supabase/functions/chart-ingest-api/index.ts",
  "utf8",
);
const migration = readFileSync(
  "supabase/migrations/20260923063254_chart_uuid_identity_authority_v1.sql",
  "utf8",
);
const verifier = readFileSync(
  "scripts/control-plane/verify-registry-chart-materialization-runtime.sql",
  "utf8",
);

function between(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  expect(startIndex, `missing start marker: ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `missing end marker: ${end}`).toBeGreaterThan(startIndex);

  return source.slice(startIndex, endIndex);
}

describe("Chart UUID identity authority", () => {
  it("retires normalized text uniqueness and enforces accepted Track UUID uniqueness per run", () => {
    expect(migration).toContain(
      "drop constraint chart_ingest_candidates_run_id_normalized_key_key",
    );
    expect(migration).toContain(
      "chart_ingest_matches_run_accepted_track_uuid_uidx",
    );
    expect(migration).toContain(
      "where entity_type='track'",
    );
    expect(migration).toContain(
      "and status='accepted'",
    );
    expect(migration).toContain(
      "'canonical_history'::text",
    );
  });

  it("executes the existing identity stages before carry-forward, eligibility and scoring", () => {
    const pipeline = between(
      runtime,
      "async function handleRunFullPipeline",
      "// COMMIT",
    );

    const canonical = pipeline.indexOf("handleRunCanonicalMatch");
    const entity = pipeline.indexOf("handleRunEntityResolution");
    const carry = pipeline.indexOf("handleRunCarryForward");
    const eligibility = pipeline.indexOf(
      "handleRunEligibilityWithReleaseWindow",
    );
    const scoring = pipeline.indexOf("handleRunScoring");
    const shortlist = pipeline.indexOf("handleRunShortlist");

    expect(canonical).toBeGreaterThanOrEqual(0);
    expect(entity).toBeGreaterThan(canonical);
    expect(carry).toBeGreaterThan(entity);
    expect(eligibility).toBeGreaterThan(carry);
    expect(scoring).toBeGreaterThan(eligibility);
    expect(shortlist).toBeGreaterThan(scoring);
  });

  it("keeps commit and re-ingest projection-only", () => {
    const commit = between(
      runtime,
      "async function handleCommitRun",
      "async function handleRunAirplayDetection",
    );
    const reingest = between(
      runtime,
      "async function handleReingestEdition",
      "async function handleCreateDryRun",
    );

    for (const source of [commit, reingest]) {
      expect(source).not.toContain("materializeChartCandidate(");
      expect(source).toContain("canonical_track_id");
      expect(source).toContain("registry_tracks");
      expect(source).toContain("registry_track_artists");
    }

    expect(commit).toContain("exact_primary_artist_credit");
    expect(commit).not.toContain(
      'normalizeSlug(String(candidate.artist_display || ""))',
    );
    expect(reingest).toContain("registry_presentation_incomplete");
  });

  it("limits Registry admission to explicit review under manage_registry", () => {
    const decisions = between(
      runtime,
      "async function handleApplyRowDecision",
      "async function handleGetOriginReviewQueue",
    );

    expect(decisions).toContain('action === "create_shell"');
    expect(decisions).toContain('requireCap(db, "manage_registry")');
    expect(decisions).toContain("materializeChartCandidate(db, runId, candidateId)");
    expect(decisions).toContain("forbidden_registry_admission");

    expect(migration).toContain(
      "Current user cannot issue this chart Registry grant.",
    );
    expect(migration).toContain("manage_registry");
    expect(
      between(
        migration,
        "CREATE OR REPLACE FUNCTION public.chart_materialize_candidate_registry_v1",
        "CREATE OR REPLACE FUNCTION public.admin_apply_chart_artist_resolution_decision",
      ),
    ).not.toContain("publish_charts");

    expect(verifier).toContain(
      "Chart materialization regained publish-time Registry mutation authority",
    );
    expect(verifier).toContain(
      "p_required_user_capability_key <> ''manage_registry''",
    );
  });

  it("resolves origin, playback and commit validation through accepted Track UUIDs", () => {
    for (const fn of [
      "chart_get_run_candidate_origin_report",
      "chart_get_run_origin_review_queue",
      "chart_get_run_playback_readiness",
      "chart_get_run_integrity_report",
    ]) {
      const start = migration.indexOf(
        `create or replace function public.${fn}`,
      );
      expect(start, `missing migrated function ${fn}`).toBeGreaterThanOrEqual(0);
    }

    expect(migration).toContain("chart_ingest_matches");
    expect(migration).toContain("canonical_entity_id");
    expect(migration).toContain("registry_track_artists");
    expect(migration).not.toContain("chart_entry_artist_token_slugs");
  });
});
