import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260823121000_admin_audio_archive_restore_authority.sql",
  "utf8",
);
const verifier = readFileSync(
  "scripts/control-plane/verify-admin-audio-archive-restore-authority.sql",
  "utf8",
);
const service = readFileSync(
  "src/services/audio/audioAdminService.ts",
  "utf8",
);
const workspace = readFileSync(
  "src/pages/admin/content/audio/detail/AudioEditorWorkspace.tsx",
  "utf8",
);

describe("Admin Audio archive and restore authority", () => {
  it("uses the platform command receipt contract for reversible retirement", () => {
    expect(migration).toContain("audio.publication.archive");
    expect(migration).toContain("audio.publication.restore");
    expect(migration).toContain("begin_authenticated_resource_command");
    expect(migration).toContain("read_authenticated_resource_command_result");
    expect(migration).toContain("complete_resource_command");
    expect(migration).toContain("reject_resource_command");
    expect(migration).toContain("p_expected_authority_revision");
    expect(migration).toContain("p_idempotency_key");
  });

  it("archives by hiding active public authority without deleting immutable history", () => {
    expect(migration).toContain("current_published_version_id = null");
    expect(migration).toContain("lifecycle_state = 'archived'");
    expect(migration).toContain("visibility = 'private'");
    expect(migration).toContain("status = 'archived'");
    expect(migration).toContain("Audio publication lifecycle events are append-only");
    expect(migration).not.toContain("delete from audio.publication_versions");
    expect(migration).not.toContain("delete from audio.publication_snapshots");
    expect(migration).not.toContain("delete from audio.publication_feed_identities");
  });

  it("requires delete_audio for archive and edit authority for restore", () => {
    expect(migration).toContain("current_user_has_capability('delete_audio')");
    expect(migration).toContain("current_user_can_edit_audio(v_binding.resource_id)");
    expect(migration).toContain("Audio archive permission is required");
    expect(migration).toContain("Audio edit permission is required");
  });

  it("restores only archived Audio to internal draft rather than republishing it", () => {
    expect(migration).toContain("v_publication.status <> 'archived'");
    expect(migration).toContain("lifecycle_state = 'draft'");
    expect(migration).toContain("visibility = 'internal'");
    expect(migration).toContain("status = 'draft'");
    expect(migration).not.toContain("current_published_version_id = v_target.id");
  });

  it("projects lifecycle truth through the bounded Admin read model", () => {
    expect(migration).toContain("'lifecycle_events'");
    expect(migration).toContain("'can_archive'");
    expect(service).toContain("lifecycleEvents");
    expect(service).toContain("canArchive");
    expect(workspace).toContain("historyItems");
    expect(workspace).toContain("workspace.canArchive");
  });

  it("has a permanent fail-closed verifier", () => {
    expect(verifier).toContain("audio.publication_lifecycle_events");
    expect(verifier).toContain("audio_publication_lifecycle_events_append_only");
    expect(verifier).toContain("archive_audio_publication");
    expect(verifier).toContain("restore_audio_publication_from_archive");
    expect(verifier).toContain("delete_audio");
    expect(verifier).toContain("current_published_version_id is not null");
    expect(verifier).toContain("ADMIN_AUDIO_ARCHIVE_RESTORE_AUTHORITY_PASS");
  });
});
