import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260823123222_admin_audio_archive_restore_authority.sql",
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

describe(
  "Admin Audio Archive Restore authority",
  () => {
    it("uses reversible lifecycle commands rather than hard deletion", () => {
      expect(migration).toContain("audio.publication.archive");
      expect(migration).toContain("audio.publication.restore");
      expect(migration).toContain("current_published_version_id = null");
      expect(migration).toContain("lifecycle_state = 'archived'");
      expect(migration).toContain("visibility = 'private'");
      expect(migration).toContain("publication_lifecycle_events");
      expect(migration).toContain("append-only");
      expect(migration).not.toContain("delete from audio.publications");
    });

    it("binds UI actions to governed RPC authority", () => {
      expect(service).toContain("archive_audio_publication");
      expect(service).toContain("restore_audio_publication_from_archive");
      expect(service).toContain("lifecycleEvents");
      expect(service).toContain("canArchive");
      expect(workspace).toContain("AdminRecordActions");
      expect(workspace).toContain("Archive");
      expect(workspace).toContain("Restore");
    });

    it("keeps a permanent verifier", () => {
      expect(verifier).toContain(
        "ADMIN_AUDIO_ARCHIVE_RESTORE_AUTHORITY_PASS",
      );
    });
  },
);
