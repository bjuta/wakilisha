import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function findMigration(): string {
  const dir = path.join(root, "supabase/migrations");
  const matches = fs
    .readdirSync(dir)
    .filter((name) =>
      name.endsWith("_creator_cohort_track_isrc_projection.sql"),
    );

  expect(matches).toHaveLength(1);
  return read(path.join("supabase/migrations", matches[0]));
}

const verifier = read(
  "scripts/control-plane/verify-creator-cohort-track-isrc-projection-v1.sql",
);

describe("Creator cohort Track ISRC projection authority", () => {
  it("declares a narrow exact-grant Track operation", () => {
    const migration = findMigration();

    expect(migration).toContain(
      "registry.track.isrc_projection.admit",
    );
    expect(migration).toContain(
      "admit_registry_track_isrc_projection",
    );
    expect(migration).toContain(
      "registry_provider_link_admin",
    );
    expect(migration).toContain(
      "array['track']::text[]",
    );
    expect(migration).toContain(
      "max_rows_ceiling",
    );
    expect(migration).toContain(
      "requires_human_approval",
    );
    expect(migration).toContain(
      "requires_verifier",
    );
  });

  it("requires exact retained Apple link and raw-payload agreement", () => {
    const migration = findMigration();

    expect(migration).toContain(
      "provider_key='apple_music'",
    );
    expect(migration).toContain(
      "match_status='matched'",
    );
    expect(migration).toContain(
      "match_method='exact_title_artist'",
    );
    expect(migration).toContain(
      "match_confidence",
    );
    expect(migration).toContain("0.93");
    expect(migration).toContain(
      "{song,attributes,isrc}",
    );
    expect(migration).toContain(
      "{song,id}",
    );
    expect(migration).toContain(
      "deterministic_projection_candidate",
    );
  });

  it("keeps the mutation to candidate assertion plus null-only Track ISRC", () => {
    const migration = findMigration().toLowerCase();

    expect(migration).toContain(
      "insert into public.registry_external_identifier_assertions",
    );
    expect(migration).toContain(
      "assertion_status",
    );
    expect(migration).toContain(
      "'candidate'",
    );
    expect(migration).toContain(
      "update public.registry_tracks",
    );
    expect(migration).toMatch(
      /set\s+isrc=v_isrc,/,
    );
    expect(migration).toContain(
      "and track.isrc is null",
    );
    expect(migration).not.toMatch(
      /^\s*update\s+public\.registry_track_provider_links\b/im,
    );
    expect(migration).not.toMatch(
      /^\s*delete\s+from\s+public\.registry_\w+\b/im,
    );
  });

  it("rejects collisions and stale evidence", () => {
    const migration = findMigration();

    expect(migration).toContain(
      "candidate_track_count",
    );
    expect(migration).toContain(
      "existing_registry_track_count",
    );
    expect(migration).toContain(
      "conflicting_current_assertion_count",
    );
    expect(migration).toContain(
      "expected_provider_link_fingerprint",
    );
    expect(migration).toContain(
      "expected_track_state_fingerprint",
    );
    expect(migration).toContain(
      "candidate_state_fingerprint",
    );
    expect(migration).toContain(
      "WK_STALE_TRACK_ISRC",
    );
  });

  it("requires two canonical write events and independent verification", () => {
    const migration = findMigration();

    expect(migration).toContain(
      "external_identifier.isrc",
    );
    expect(migration).toContain(
      "public.registry_external_identifier_assertions",
    );
    expect(migration).toContain(
      "public.registry_tracks.isrc",
    );
    expect(migration).toContain(
      "admit_isrc_projection",
    );
    expect(migration).toContain(
      "affected_rows=2",
    );
    expect(migration).toContain(
      "verify_registry_track_isrc_projection_v1",
    );

    expect(verifier).toContain(
      "canonical_write_event_causality_mismatch",
    );
    expect(verifier).toContain(
      "Active Track ISRC projection execution grant remains at rest",
    );
  });

  it("does not add Work or Person mutation authority", () => {
    const migration = findMigration();

    expect(migration).not.toMatch(
      /insert\s+into\s+public\.registry_works/i,
    );
    expect(migration).not.toMatch(
      /insert\s+into\s+public\.registry_track_work_links/i,
    );
    expect(migration).not.toMatch(
      /insert\s+into\s+editorial\.people/i,
    );
  });
});
