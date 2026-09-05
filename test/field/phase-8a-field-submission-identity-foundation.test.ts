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
      "_phase_8a_field_submission_identity_foundation.sql",
    ),
  )
  .sort()
  .at(-1);

if (!migrationFile) {
  throw new Error(
    "Phase 8A.2A Field Submission identity foundation migration is missing.",
  );
}

const migration = readFileSync(
  `supabase/migrations/${migrationFile}`,
  "utf8",
);

const verifier = readFileSync(
  "scripts/control-plane/verify-phase-8a-field-submission-identity-foundation.sql",
  "utf8",
);

const design = readFileSync(
  "docs/engineering/phase-8a-field-submission-threat-model-and-schema-design.md",
  "utf8",
);

describe("Phase 8A.2A Field Submission identity foundation", () => {
  it("implements only the locked 8A.2A foundation boundary", () => {
    expect(design).toContain(
      "### 8A.2A Field Submission identity foundation",
    );
    expect(migration).toContain(
      "create table editorial.field_submissions (",
    );
    expect(migration).toContain(
      "create table editorial.field_submission_event_types (",
    );
    expect(migration).toContain(
      "create table editorial.field_submission_events (",
    );

    for (const deferredAuthority of [
      "create table editorial.field_submission_media_intakes",
      "'field_original'",
      "create_field_media_upload_session_v1",
      "adopt_verified_field_media_upload_session_v1",
      "field-intake-api",
      "submit_media_processing_command_v1",
    ]) {
      expect(migration).not.toContain(deferredAuthority);
    }
  });

  it("adds the exact Field role and capability assignments without Media escalation", () => {
    for (const capability of [
      "submit_field_capture",
      "read_own_field_capture",
      "view_field_intake",
      "view_restricted_field_sources",
    ]) {
      expect(migration).toContain(`'${capability}'`);
      expect(verifier).toContain(`'${capability}'`);
    }

    expect(migration).toContain(
      "('field_contributor', 'submit_field_capture')",
    );
    expect(migration).toContain(
      "('field_contributor', 'read_own_field_capture')",
    );
    expect(migration).toContain(
      "('editor', 'view_restricted_field_sources')",
    );
    expect(migration).toContain(
      "('reviewer', 'view_field_intake')",
    );
    expect(verifier).toContain(
      "field_contributor received forbidden Media authority",
    );
    expect(migration).not.toContain(
      "('field_contributor', 'manage_media_assets')",
    );
    expect(migration).not.toContain(
      "('field_contributor', 'manage_media_usage')",
    );
  });

  it("creates private Resource owned Field identity without a public route or Resource Version", () => {
    expect(migration).toContain("'field_submission'");
    expect(migration).toContain("'private'");
    expect(migration).toContain("owner_user_id uuid not null");
    expect(migration).toContain(
      "foreign key (resource_id, resource_kind)",
    );
    expect(migration).toContain(
      "references editorial.resources(id, resource_kind)",
    );
    expect(migration).not.toContain(
      "create table editorial.field_submission_versions",
    );
    expect(migration).not.toContain(
      "insert into editorial.resource_version_types",
    );
    expect(migration).not.toContain(
      "insert into editorial.resource_aliases",
    );
    expect(verifier).toContain(
      "Field Submission received a public route alias",
    );
  });

  it("locks the exact server lifecycle and optimistic revision boundary", () => {
    for (const state of [
      "receiving",
      "received",
      "submitted",
      "cancelled",
      "expired",
    ]) {
      expect(migration).toContain(`'${state}'`);
    }

    expect(migration).not.toContain("'draft_local'");
    expect(migration).toContain(
      "new.current_revision <> old.current_revision + 1",
    );
    expect(migration).toContain(
      "Terminal Field Submission state is immutable in Phase 8A.",
    );
    expect(migration).toContain(
      "old.submission_state = 'receiving'",
    );
    expect(migration).toContain(
      "old.submission_state = 'received'",
    );
    expect(verifier).toContain(
      "Field aggregate lifecycle or terminal-state protection drifted",
    );
  });

  it("preserves Field declaration provenance without exact device geolocation", () => {
    for (const field of [
      "newsroom_identity_mode",
      "public_attribution_preference",
      "contact_preference",
      "rights_declaration",
      "consent_declaration",
      "declared_sensitivity",
      "source_protection_request",
      "embargo_request_mode",
      "location_mode",
      "location_description",
      "content_captured_at",
      "intake_notes",
    ]) {
      expect(migration).toContain(field);
    }

    for (const exactLocation of [
      "latitude",
      "longitude",
      "gps_accuracy",
      "device_location_token",
    ]) {
      expect(migration).not.toContain(`${exactLocation} `);
    }

    expect(migration).toContain(
      "location_mode in ('not_collected', 'coarse_text')",
    );
  });

  it("creates the locked append-only Field event vocabulary", () => {
    for (const eventType of [
      "submission_created",
      "declaration_updated",
      "upload_session_attached",
      "upload_resumed",
      "media_verified",
      "media_attached",
      "submission_received",
      "submission_finalized",
      "receipt_issued",
      "submission_cancelled",
      "media_intake_expired",
      "submission_expired",
    ]) {
      expect(migration).toContain(`'${eventType}'`);
    }

    expect(migration).toContain(
      "create trigger field_submission_events_append_only",
    );
    expect(migration).toContain(
      "Field Submission events are append-only.",
    );
    expect(verifier).toContain(
      "Field Submission event append-only trigger is missing",
    );
  });

  it("extends Resource binding integrity by one Field branch while retaining predecessor branches", () => {
    for (const kind of [
      "article",
      "playlist",
      "registry_artist",
      "correction_case",
      "media_asset",
      "person",
      "organization",
      "audio_show",
      "audio_season",
      "audio_episode",
      "standalone_audio",
      "show",
      "show_episode",
      "video_episode",
      "standalone_video",
      "field_submission",
    ]) {
      expect(migration).toContain(`when '${kind}' then`);
      expect(verifier).toContain(`when ''${kind}''`);
    }

    expect(migration).toContain(
      "from editorial.field_submissions",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain(
      "set search_path to 'pg_catalog', 'editorial', 'audio'",
    );
    expect(migration).toContain(
      "create constraint trigger field_submissions_resource_binding_integrity",
    );
  });

  it("uses shared command receipts for create, declaration update, and cancellation", () => {
    for (const commandType of [
      "field.submission.create",
      "field.submission.declarations.update",
      "field.submission.cancel",
    ]) {
      expect(migration).toContain(`'${commandType}'`);
    }

    expect(migration).not.toContain("'field.submission.media.start'");
    expect(migration).not.toContain("'field.submission.media.adopt'");
    expect(migration).not.toContain("'field.submission.finalize'");
    expect(migration).toContain(
      "platform_private.begin_authenticated_resource_command",
    );
    expect(migration).toContain(
      "platform_private.complete_resource_command",
    );
    expect(migration).toContain(
      "platform_private.reject_resource_command",
    );
    expect(migration).toContain(
      "platform_private.command_request_fingerprint",
    );
    expect(migration).not.toContain(
      "create table platform_private.field_command",
    );
  });

  it("serializes creation before generating identity and returns the original identity on replay", () => {
    const createStart = migration.indexOf(
      "create or replace function public.create_field_submission_v1(",
    );
    const updateStart = migration.indexOf(
      "create or replace function public.update_field_submission_declarations_v1(",
      createStart,
    );
    const createCommand = migration.slice(createStart, updateStart);

    expect(createStart).toBeGreaterThan(-1);
    expect(updateStart).toBeGreaterThan(createStart);
    expect(createCommand).toContain("pg_advisory_xact_lock");
    expect(createCommand).toContain(
      "from platform_private.command_receipts receipt",
    );
    expect(createCommand).toContain("for update;");
    expect(createCommand.indexOf("from platform_private.command_receipts receipt"))
      .toBeLessThan(createCommand.indexOf("v_resource_id := extensions.gen_random_uuid();"));
    expect(createCommand).toContain(
      "The idempotency key was already used for a different Field Submission create request.",
    );
    expect(createCommand).toContain("submission_reference :=");
    expect(createCommand).toContain("idempotent_replay := true;");
  });

  it("keeps all canonical Field tables private and gates own and restricted reads through RPCs", () => {
    expect(migration).toContain(
      "revoke all\n  on editorial.field_submission_event_types,",
    );
    expect(migration).toContain(
      "from public, anon, authenticated, service_role;",
    );
    expect(migration).toContain(
      "public.get_my_field_submission_v1",
    );
    expect(migration).toContain("read_own_field_capture");
    expect(migration).toContain("field.owner_user_id = v_actor");
    expect(migration).toContain("resource_row.owner_id = v_actor");
    expect(migration).toContain(
      "public.get_field_submission_intake_v1",
    );
    expect(migration).toContain("view_field_intake");
    expect(migration).toContain("view_restricted_field_sources");
    expect(migration).toContain(
      "field.newsroom_identity_mode = 'restricted'",
    );
    expect(migration).toContain("then null::uuid");
    expect(verifier).toContain(
      "A browser or service role has direct Field table authority",
    );
  });
  it("keeps the lost playlist_item predecessor authority repaired", () => {
    const convergence = readFileSync(
      "supabase/migrations/20260905134500_resource_identity_control_plane_convergence.sql",
      "utf8",
    );

    expect(convergence).toContain(
      "when 'playlist_item' then",
    );
    expect(convergence).toContain(
      "from editorial.playlist_item_resources",
    );
    expect(convergence).toContain(
      "playlist_item_resources_binding_integrity",
    );
  });

});
