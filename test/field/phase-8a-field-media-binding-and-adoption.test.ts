import {
  readFileSync,
  readdirSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const migrationFile = readdirSync("supabase/migrations")
  .filter((name) =>
    name.endsWith(
      "_phase_8a_field_media_binding_and_adoption.sql",
    ),
  )
  .sort()
  .at(-1);

if (!migrationFile) {
  throw new Error(
    "Phase 8A.2B Field Media binding and adoption migration is missing.",
  );
}

const migration = readFileSync(
  `supabase/migrations/${migrationFile}`,
  "utf8",
);

const verifier = readFileSync(
  "scripts/control-plane/verify-phase-8a-field-media-binding-and-adoption.sql",
  "utf8",
);

const foundationVerifier = readFileSync(
  "scripts/control-plane/verify-phase-8a-field-submission-identity-foundation.sql",
  "utf8",
);

const design = readFileSync(
  "docs/engineering/phase-8a-field-submission-threat-model-and-schema-design.md",
  "utf8",
);

describe("Phase 8A.2B Field Media binding and adoption", () => {
  it("implements one consolidated database milestone without Edge or frontend authority", () => {
    expect(design).toContain(
      "### 8A.2B Field Media binding extension",
    );
    expect(migration).toContain(
      "create table editorial.field_submission_media_intakes",
    );
    expect(migration).toContain("'field_original'");
    expect(migration).toContain(
      "public.create_field_media_upload_session_v1",
    );
    expect(migration).toContain(
      "public.adopt_verified_field_media_upload_session_v1",
    );
    expect(migration).toContain(
      "public.finalize_field_submission_v1",
    );

    for (const forbidden of [
      "supabase/functions/field-intake-api",
      "submit_media_processing_command_v1(",
      "create table editorial.field_submission_versions",
      "insert into editorial.resource_version_types",
      "insert into editorial.resource_aliases",
    ]) {
      expect(migration).not.toContain(forbidden);
    }
  });

  it("uses valid PostgreSQL multi-function grant and revoke syntax", () => {
    expect(migration).not.toMatch(
      /,\s+function\s+(?:public|media|editorial)\./,
    );
  });

  it("preserves existing Media admin and receiver functions by exact definition hashes", () => {
    for (const hash of [
      "2a8f50b8775563fa99f9348ccdb4e250",
      "eb7ad07f8bed953a4da4e50f6776bb33",
      "75ac38d001edec77802d5e7525dd6daf",
      "8433654899bfa8cd6c2eddbff378a846",
      "e93620ff030b1102372291b880d9c010",
      "f9921bbc7097d126d51f5090d60c26d1",
      "b0520b2469e7894e1f3386f4b5a20d36",
    ]) {
      expect(migration).toContain(hash);
      expect(verifier).toContain(hash);
    }

    expect(migration).not.toContain(
      "create or replace function public.create_media_upload_session_v2(",
    );
    expect(migration).not.toContain(
      "create or replace function public.attach_media_usage(",
    );
    expect(migration).not.toContain(
      "create or replace function public.adopt_verified_media_upload_session_v1(",
    );
  });

  it("extends literal Media target authority without erasing Video predecessor branches", () => {
    for (const hash of [
      "a7fb7441def5de086a839e5bf6bae6b5",
      "d30e0ad50c2d99aec9f05726137f52ec",
      "1f64345ea16d94d9154c900a54c1dbcf",
    ]) {
      expect(migration).toContain(hash);
    }

    expect(migration).toContain(
      "editorial.user_has_field_capability_v1",
    );
    expect(migration).toContain(
      "p_target_kind in (''article'', ''playlist'', ''field_submission'')",
    );
    expect(migration).toContain(
      "editorial.current_user_can_edit_video",
    );
    expect(verifier).toContain(
      "p_target_authority = ''video''",
    );
    expect(verifier).toContain(
      "p_target_kind = ''video_publication''",
    );
  });

  it("makes field_original exclusive to exact Field Submission slots", () => {
    expect(migration).toContain(
      "when 'field_original' then",
    );
    expect(migration).toContain(
      "p_target_kind = 'field_submission'",
    );
    expect(migration).toContain(
      "Field Submission Media targets accept field_original usage only.",
    );
    expect(migration).toContain(
      "new.resolution_mode <> 'exact_revision'",
    );
    expect(migration).toContain(
      "new.target_version_id is not null",
    );
    expect(migration).toContain(
      "placement_data ->> 'slot_number'",
    );
    expect(migration).toContain(
      "media_field_original_active_slot_key",
    );
  });

  it("allows only first canonical pointer activation for a protected Field original", () => {
    const triggerStart = migration.indexOf(
      "create or replace function media.protect_field_original_asset_v1()",
    );
    const triggerEnd = migration.indexOf(
      "create trigger media_assets_field_original_protection",
      triggerStart,
    );
    const trigger = migration.slice(triggerStart, triggerEnd);

    expect(trigger).toContain("old.current_revision_id is null");
    expect(trigger).toContain("old.current_governance_version_id is null");
    expect(trigger).toContain("old.authority_revision = 1");
    expect(trigger).toContain("new.current_revision_id is not null");
    expect(trigger).toContain("new.current_governance_version_id is not null");
    expect(trigger).toContain("new.authority_revision = 2");
    expect(trigger).toContain(
      "new.current_revision_id is distinct from old.current_revision_id",
    );
    expect(trigger).toContain(
      "new.current_governance_version_id",
    );
    expect(verifier).toContain(
      "protected Field original initial activation or later immutability can drift",
    );
  });

  it("keeps protected originals non-public and outside compatibility projection", () => {
    expect(migration).toContain(
      "media_assets_field_original_protection",
    );
    expect(migration).toContain(
      "media_governance_field_original_protection",
    );
    expect(migration).toContain(
      "media_usage_field_original_protection",
    );
    expect(migration).toContain(
      "new.current_revision_id is distinct from old.current_revision_id",
    );
    expect(migration).toContain("'needs_clearance'");
    expect(migration).toContain("'preservation_candidate'");
    expect(migration).toContain(
      "Contributor declarations remain intake provenance and do not constitute institutional clearance.",
    );
    expect(migration).not.toContain(
      "insert into public.registry_media_assets",
    );
    expect(migration).not.toContain(
      "insert into media.legacy_asset_links",
    );
    expect(migration).not.toContain(
      "submit_media_processing_command_v1(",
    );
  });

  it("creates future-ready intake attempts without copying Media file facts", () => {
    for (const field of [
      "submission_resource_id",
      "slot_number",
      "attempt_number",
      "media_upload_session_id",
      "usage_link_id",
      "intake_state",
      "verified_at",
      "adopted_at",
      "cancelled_at",
      "expired_at",
      "superseded_at",
    ]) {
      expect(migration).toContain(field);
    }

    const tableStart = migration.indexOf(
      "create table editorial.field_submission_media_intakes",
    );
    const tableEnd = migration.indexOf(
      "create unique index field_submission_media_intakes_one_inflight_slot_idx",
      tableStart,
    );
    const tableDefinition = migration.slice(tableStart, tableEnd);

    for (const forbiddenColumn of [
      "storage_path",
      "expected_sha256",
      "expected_byte_size",
      "mime_type",
      "original_filename",
      "file_object_id",
    ]) {
      expect(tableDefinition).not.toContain(forbiddenColumn);
    }

    expect(migration).toContain(
      "field_submission_media_intakes_one_inflight_slot_idx",
    );
    expect(migration).toContain(
      "field_submission_media_intakes_one_adopted_slot_idx",
    );
    expect(migration).toContain(
      "Adopted Field Media intake requires its exact canonical field_original usage.",
    );
  });

  it("reuses accepted video upload limits without granting Media administration", () => {
    const helperStart = migration.indexOf(
      "create or replace function media.create_field_video_upload_session_v1(",
    );
    const helperEnd = migration.indexOf(
      "create or replace function media.cancel_field_upload_session_v1(",
      helperStart,
    );
    const helper = migration.slice(helperStart, helperEnd);

    expect(helper).toContain("video/%");
    for (const extension of ["mp4", "mov", "m4v", "webm", "mkv"]) {
      expect(helper).toContain(`'${extension}'`);
    }
    expect(helper).toContain("2147483648");
    expect(helper).toContain("8388608");
    expect(helper).toContain(
      "p_ttl_seconds not between 300 and 86400",
    );
    expect(helper).toContain("'masters/video/'");
    expect(helper).not.toContain("manage_media_assets");

    expect(migration).not.toContain(
      "('field_contributor', 'manage_media_assets')",
    );
    expect(migration).not.toContain(
      "('field_contributor', 'manage_media_usage')",
    );
    expect(verifier).toContain(
      "field_contributor received forbidden Media authority",
    );
  });

  it("keeps receiver metadata behind service-only actor-bound hooks", () => {
    for (const rpc of [
      "public.get_field_media_receiver_session_v1",
      "public.record_field_media_upload_resume_v1",
      "public.sync_field_media_intake_v1",
    ]) {
      expect(migration).toContain(rpc);
    }

    expect(migration).toContain(
      "coalesce(auth.role(), '') <> 'service_role'",
    );
    expect(migration).toContain(
      "editorial.assert_field_media_actor_v1",
    );
    expect(migration).toContain(
      "session_row.actor_id = p_actor_id",
    );
    expect(migration).toContain(
      "grant execute\n  on function public.get_field_media_receiver_session_v1",
    );
  });

  it("adopts exact verified canonical Media and advances receiving to received", () => {
    const adoptionStart = migration.indexOf(
      "create or replace function public.adopt_verified_field_media_upload_session_v1(",
    );
    const finalizeStart = migration.indexOf(
      "create or replace function public.finalize_field_submission_v1(",
      adoptionStart,
    );
    const adoption = migration.slice(adoptionStart, finalizeStart);

    expect(adoption).toContain(
      "platform_private.begin_authenticated_resource_command",
    );
    expect(adoption).toContain(
      "'field.submission.media.adopt'",
    );
    expect(adoption).toContain(
      "v_session.state <> 'verified'",
    );
    expect(adoption).toContain(
      "file_object.verification_state = 'verified'",
    );
    expect(adoption).toContain(
      "media.create_protected_field_original_v1",
    );
    expect(adoption).toContain(
      "v_field.submission_state not in ('receiving', 'received')",
    );
    expect(adoption).toContain(
      "if v_field.submission_state = 'receiving' then",
    );
    expect(adoption).toContain(
      "submission_state = 'received'",
    );
    expect(adoption).toContain(
      "current_revision = field.current_revision + 1",
    );
    expect(adoption).toContain("'media_attached'");
    expect(adoption).toContain("'submission_received'");
    expect(adoption).not.toContain(
      "submit_media_processing_command_v1",
    );
  });

  it("finalizes only received Field Submission with exact adopted slot one and safe receipt", () => {
    const finalizeStart = migration.indexOf(
      "create or replace function public.finalize_field_submission_v1(",
    );
    const cancelStart = migration.indexOf(
      "create or replace function public.cancel_field_submission_v1(",
      finalizeStart,
    );
    const finalize = migration.slice(finalizeStart, cancelStart);

    expect(finalize).toContain(
      "v_field.submission_state <> 'received'",
    );
    expect(finalize).toContain(
      "field_media_intake_in_progress",
    );
    expect(finalize).toContain(
      "count(*) filter (where intake.slot_number = 1)",
    );
    expect(finalize).toContain(
      "'adopted_media_count', v_adopted_count",
    );
    expect(finalize).toContain(
      "usage.usage_role = 'field_original'",
    );
    expect(finalize).toContain(
      "file_object.verification_state = 'verified'",
    );
    expect(finalize).toContain(
      "submission_state = 'submitted'",
    );
    expect(finalize).toContain("'submission_finalized'");
    expect(finalize).toContain("'receipt_issued'");
    expect(finalize).toContain(
      "We received your submission for review.",
    );
    expect(finalize).not.toContain("storage_path");
    expect(finalize).not.toContain("expected_sha256");
  });

  it("preserves the Phase 8A.2A cancellation RPC parameter identity", () => {
    expect(migration).toContain(
      "create or replace function public.cancel_field_submission_v1(\n" +
        "  p_submission_resource_id uuid,\n" +
        "  p_expected_current_revision bigint,\n" +
        "  p_idempotency_key text,\n" +
        "  p_reason text default null,\n" +
        "  p_correlation_id uuid default null\n" +
        ")",
    );
    expect(migration).not.toContain(
      "p_expected_current_revision bigint,\n" +
        "  p_reason text,\n" +
        "  p_idempotency_key text",
    );
    expect(verifier).toContain(
      "cancellation RPC parameter identity drifted from Phase 8A.2A",
    );
    expect(verifier).toContain(
      "pg_get_function_identity_arguments",
    );
  });

  it("rejects destructive cancellation after verification or adoption", () => {
    const cancelStart = migration.indexOf(
      "create or replace function public.cancel_field_submission_v1(",
    );
    const ownReadStart = migration.indexOf(
      "drop function public.get_my_field_submission_v1(uuid);",
      cancelStart,
    );
    const cancel = migration.slice(cancelStart, ownReadStart);

    expect(cancel).toContain(
      "media.cancel_field_upload_session_v1",
    );
    expect(cancel).toContain(
      "field_cancellation_after_verified_media_not_allowed",
    );
    expect(cancel).toContain(
      "for v_attempt in",
    );
    expect(cancel).toContain(
      "intake.intake_state = 'active'",
    );
    expect(cancel).toContain(
      "intake.intake_state in ('verified', 'adopted')",
    );
    expect(cancel).toContain(
      "current_revision = field.current_revision + 1",
    );
    expect(cancel).toContain("'submission_cancelled'");
  });

  it("verifies Field Media composition at the correct authority layers", () => {
    expect(verifier).toContain(
      "media.create_field_video_upload_session_v1(uuid,uuid,integer,integer,text,text,text,bigint,text,integer,uuid)",
    );
    expect(verifier).toContain(
      "Field Media start lost helper composition or receipt authority",
    );
    expect(verifier).toContain(
      "Field video upload helper lost accepted Media session limits",
    );
    expect(verifier).toContain(
      "position('capability_token' in lower(v_definition)) > 0",
    );
    expect(verifier).not.toContain(
      "position('capability' in lower(v_definition)) > 0",
    );
    expect(verifier).toContain(
      "join editorial.resources resource_row",
    );
    expect(verifier).toContain(
      "where resource_row.resource_kind = 'field_submission'",
    );
  });

  it("widens safe reads with Media progress and no receiver secrets", () => {
    const ownReadStart = migration.indexOf(
      "create function public.get_my_field_submission_v1(",
    );
    const internalReadStart = migration.indexOf(
      "create function public.get_field_submission_intake_v1(",
      ownReadStart,
    );
    const ownRead = migration.slice(ownReadStart, internalReadStart);
    const internalRead = migration.slice(internalReadStart);

    for (const safeField of [
      "media_intake_count",
      "adopted_media_count",
      "current_media_intake_id",
      "current_media_intake_state",
      "current_media_upload_state",
      "current_media_file_label",
    ]) {
      expect(ownRead).toContain(safeField);
    }

    for (const forbidden of [
      "storage_path",
      "expected_sha256",
      "capability_token",
      "delivery_url",
    ]) {
      expect(ownRead).not.toContain(forbidden);
      expect(internalRead).not.toContain(forbidden);
    }

    expect(internalRead).toContain(
      "view_restricted_field_sources",
    );
    expect(internalRead).toContain(
      "then null::uuid",
    );
  });

  it("keeps the 8A.2A permanent verifier forward-compatible without weakening foundation checks", () => {
    expect(foundationVerifier).toContain(
      "Phase 8A.2A Field command vocabulary is incomplete",
    );
    expect(foundationVerifier).toContain(
      "Field create command lost idempotency, receipt, ownership, or event authority",
    );
    expect(foundationVerifier).toContain(
      "Field declaration update lost optimistic concurrency or durable command authority",
    );
    expect(foundationVerifier).toContain(
      "Field Submission received deferred Resource Version authority",
    );
    expect(foundationVerifier).not.toContain(
      "Phase 8A.2B or finalization command vocabulary appeared inside 8A.2A",
    );
    expect(foundationVerifier).not.toContain(
      "to_regclass('editorial.field_submission_media_intakes') is not null",
    );
  });
});
