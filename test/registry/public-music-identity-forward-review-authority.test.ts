import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261008180201_public_music_identity_track_actual_zero_forward_review_authority_v1.sql",
  "utf8",
);

describe("#1094 forward feature review materialization", () => {
  it("creates only a guarded admin review command", () => {
    expect(migration).toContain(
      "create function public.admin_materialize_public_music_identity_feature_review_v1(",
    );
    expect(migration).toContain("v_user uuid:=auth.uid()");
    expect(migration).toContain("current_user_has_capability('manage_registry')");
    expect(migration).toContain("p_expected_track_state_fingerprint");
    expect(migration).toContain("WK_STALE_TRACK_IDENTITY");
    expect(migration).toContain("for update");
  });

  it("preserves historical review causality and requires a human decision", () => {
    expect(migration).toContain("track_slug_identity_noise");
    expect(migration).toContain("track_slug_credit_evidence_gap");
    expect(migration).toContain("Existing or historical scoped review");
    expect(migration).toContain("humanDecisionRequired");
    expect(migration).toContain("'canonicalEntitiesChanged',false");
    expect(migration).toContain("'disposition','review'");
  });

  it("refuses collisions and projected Tracks instead of inventing authority", () => {
    expect(migration).toContain("registry_track_semantic_title_v1");
    expect(migration).toContain("peer.slug=v_target_slug");
    expect(migration).toContain("theirs.artist_id=mine.artist_id");
    expect(migration).toContain("public.wk_chart_entries_v2");
    expect(migration).toContain("public.community_threads");
    expect(migration).toContain("Recording-identity conflict review already owns this Track.");
    expect(migration).toContain("to_regclass('public.wk_chart_entries_v2')");
  });

  it("does not write any canonical Track or pointer surface", () => {
    expect(migration).not.toMatch(/update\s+public\.registry_tracks\b/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.registry_tracks\b/i);
    expect(migration).not.toMatch(/insert\s+into\s+public\.registry_tracks\b/i);
    expect(migration).not.toMatch(/update\s+public\.wk_chart_entries_v2\b/i);
    expect(migration).not.toMatch(/update\s+public\.community_threads\b/i);
    expect(migration).toMatch(/insert\s+into\s+public\.registry_review_items\s*\(/i);
  });

  it("exposes B1 context without reopening settled reviews or mutating canonical identity", () => {
    expect(migration).toContain("admin_get_public_music_identity_b1_forward_context_v1");
    expect(migration).toContain("evidenceRecordingIdentityReviewId");
    expect(migration).toContain("public_music_identity_distinct_recording");
    expect(migration).toContain("WK_STALE_B1_IDENTITY");
    expect(migration).toContain("'newDecisionRecorded',false");
    expect(migration).toContain("'canonicalEntitiesChanged',false");
  });

  it("denies anonymous and service-role execution", () => {
    expect(migration).toContain("from public,anon,service_role;");
    expect(migration).toContain("to authenticated;");
    expect(migration).toContain("has_function_privilege(");
  });
});
