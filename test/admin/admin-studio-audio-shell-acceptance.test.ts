import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const workspace = readFileSync(
  "src/pages/admin/content/audio/detail/AudioEditorWorkspace.tsx",
  "utf8",
);
const service = readFileSync(
  "src/services/audio/audioAdminService.ts",
  "utf8",
);
const review = readFileSync(
  "src/pages/admin/content/audio/detail/components/AudioReviewWorkspace.tsx",
  "utf8",
);

describe("Admin Studio Audio record-shell visual acceptance", () => {
  it("uses truthful shared save-state and record actions in the Audio header", () => {
    expect(workspace).toContain("AdminSaveState");
    expect(workspace).toContain("AdminRecordActions");
    expect(workspace).toContain("metadataDirty");
    expect(workspace).toContain("chaptersDirty");
    expect(workspace).toContain("workingDirty");
    expect(workspace).toContain("lockedLabel={`${humanize(");
  });

  it("makes header Save persist local Audio fields before snapshotting", () => {
    expect(workspace).toContain("handleSaveWorkingVersion");
    expect(workspace).toContain("await saveAudioMetadata(");
    expect(workspace).toContain("await replaceAudioChapters(");
    expect(workspace).toContain("await fetchAudioPublicationWorkspace(");
    expect(workspace).toContain("await snapshotAudioWorkingVersion(");
  });

  it("does not submit stale local Audio edits into Review", () => {
    expect(workspace).toContain("busy !== null || workingDirty");
    expect(workspace).toContain("Save changes before submitting for Review.");
  });

  it("gives Audio common governed lifecycle affordances instead of a thinner local header", () => {
    for (const action of [
      "Details",
      "Submit for Review",
      "Start Review",
      "Request Changes",
      "Approve",
      "Publish",
      "View Live",
      "Archive",
      "Restore",
    ]) {
      expect(workspace).toContain(action);
    }

    expect(workspace).toContain("workspace.canArchive");
    expect(workspace).toContain("archiveAudioPublication");
    expect(workspace).toContain("restoreAudioPublicationFromArchive");
    expect(service).toContain("canArchive: bool(root.can_archive)");
    expect(service).toContain('supabase.rpc("archive_audio_publication"');
    expect(service).toContain('"restore_audio_publication_from_archive"');
  });

  it("does not invent Audio Preview authority that the domain does not yet have", () => {
    expect(workspace).not.toContain("createAudioPreviewLink");
    expect(service).not.toContain("createAudioPreviewLink");
  });

  it("upgrades Review to exact-version time-anchored work and keeps lifecycle history", () => {
    expect(workspace).toContain("EditorialWorkflowRail");
    expect(workspace).toContain("AudioReviewWorkspace");
    expect(workspace).toContain("lifecycleEvents");
    expect(workspace).toContain("historyItems");
    expect(review).toContain("Review submitted version");
    expect(review).toContain("MediaTimeline");
    expect(review).toContain("EditorialCommentEditor");
    expect(review).toContain("Lifecycle decision note");

    for (const version of ["Working", "Submitted", "Approved", "Published"]) {
      expect(workspace).toContain(version);
    }
  });
});
