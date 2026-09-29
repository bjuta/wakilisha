import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260929080512_public_music_identity_reviewed_artist_and_track_credit_correction_v1.sql",
  "utf8",
);

const verifier = readFileSync(
  "scripts/control-plane/verify-public-music-identity-reviewed-artist-track-credit-correction-v1.sql",
  "utf8",
);

describe("Public Music Identity reviewed Artist and Track credit correction", () => {
  it("versions one-credit reviewed reconciliation instead of replacing exact sets", () => {
    expect(migration).toContain(
      "'registry.track_artist_credit.reviewed_reconcile',\n  2,",
    );
    expect(migration).toContain(
      "'reconcile_registry_track_reviewed_artist_credit'",
    );
    expect(migration).toContain(
      "'public_music_identity_review'",
    );
    expect(migration).not.toContain(
      "registry.track_artist_credit_set.replace",
    );
    expect(migration).not.toContain(
      "'track_intake_review'",
    );
  });

  it("binds correction to exact #1094 review and recorded human decision", () => {
    expect(migration).toContain(
      "public_music_identity_track_actual_zero_v1",
    );
    expect(migration).toContain(
      "decision.metadata->>'decisionStage'='human_review_recorded'",
    );
    expect(migration).toContain(
      "decision.status='recorded'",
    );
    expect(migration).toContain(
      "review.status='open'",
    );
    expect(migration).toContain(
      "'public_music_identity_safe_slug_repair'",
    );
    expect(migration).toContain(
      "'public_music_identity_credit_correction_required'",
    );
  });

  it("preserves one-credit update/insert/no-op semantics and unrelated credits", () => {
    expect(migration).toContain(
      "update public.registry_track_artists credit",
    );
    expect(migration).toContain(
      "insert into public.registry_track_artists",
    );
    expect(migration).not.toMatch(
      /delete\s+from\s+public\.registry_track_artists/i,
    );
    expect(migration).toContain(
      "v_mode:='already_current'",
    );
    expect(migration).toContain(
      "v_mode:='updated'",
    );
    expect(migration).toContain(
      "v_mode:='inserted'",
    );
    expect(migration).toContain(
      "multiple active primary Track credits",
    );
    expect(migration).toContain(
      "occupied active credit order",
    );
  });

  it("keeps Admin execution resumable through the prior verified receipt", () => {
    expect(migration).toContain(
      "operation.verifier_status='passed'",
    );
    expect(migration).toContain(
      "'mode','already_current'",
    );
    expect(migration).toContain(
      "'idempotent_replay',true",
    );
    expect(migration).toContain(
      "public-music-identity-credit-v2:",
    );
  });

  it("reuses reviewed Artist creation with truthful public-music-identity provenance", () => {
    expect(migration).toContain(
      "p_source_kind='public_music_identity_review'",
    );
    expect(migration).toContain(
      "p_source_ref like 'public-music-identity-review:%'",
    );
    expect(migration).toContain(
      "execute_registry_reviewed_artist_identity_materialization_v1",
    );
    expect(migration).toContain(
      "activate_public_music_identity_reviewed_artist",
    );
    expect(migration).toContain(
      "public.admin_materialize_public_music_identity_reviewed_artist_v1",
    );
  });

  it("keeps browser authority behind capability-gated Admin RPCs", () => {
    expect(migration).toContain(
      "current_user_has_capability('manage_registry')",
    );
    expect(migration).toContain(
      "public.admin_reconcile_public_music_identity_track_credit_v1",
    );
    expect(migration).toContain(
      "grant execute on function",
    );
    expect(migration).toContain(
      "to authenticated",
    );
    expect(migration).toContain(
      "authenticated direct Track-credit mutation authority is not allowed",
    );
  });

  it("ships a permanent verifier for operation, provenance, ACL and zero-at-rest", () => {
    expect(verifier).toContain(
      "PUBLIC_MUSIC_IDENTITY_REVIEWED_ARTIST_TRACK_CREDIT_V1_PASS",
    );
    expect(verifier).toContain(
      "operation.operation_version<>2",
    );
    expect(verifier).toContain(
      "canonical_reviewed_credit_semantics_mismatch",
    );
    expect(verifier).toContain(
      "track_primary_credit_cardinality_mismatch",
    );
    expect(verifier).toContain(
      "review_or_decision_authority_no_longer_current",
    );
    expect(verifier).toContain(
      "correction authority is not zero at rest",
    );
  });
});
