import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// chart-ingest-api retired in the 2026-11-17 Charts reset; runtime-source
// assertions retired with it. Database authority assertions remain.
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

  it("limits Registry admission to explicit review under manage_registry", () => {
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
