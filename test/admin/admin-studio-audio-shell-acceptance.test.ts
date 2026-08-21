import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const workspace = readFileSync(
  "src/pages/admin/content/audio/detail/AudioEditorWorkspace.tsx",
  "utf8",
);

describe("Admin Studio Audio record-shell visual acceptance", () => {
  it("uses truthful shared save-state in the Audio record header", () => {
    expect(workspace).toContain("AdminSaveState");
    expect(workspace).toContain("metadataDirty");
    expect(workspace).toContain("chaptersDirty");
    expect(workspace).toContain("workingDirty");
    expect(workspace).toContain(
      'lockedLabel={`${humanize(workspace.publication.status)} Version`}',
    );
  });

  it("makes header Save persist local Audio fields before snapshotting", () => {
    expect(workspace).toContain("handleSaveWorkingVersion");
    expect(workspace).toContain(
      "await saveAudioMetadata(current, { title, slug, summary });",
    );
    expect(workspace).toContain(
      "await replaceAudioChapters(current, chapters);",
    );
    expect(workspace).toContain(
      "current = await fetchAudioPublicationWorkspace(",
    );
    expect(workspace).toContain(
      "await snapshotAudioWorkingVersion(current);",
    );
    expect(workspace).not.toContain("handleWorkingSnapshot");
  });

  it("does not submit stale local Audio edits into Review", () => {
    expect(workspace).toContain(
      'disabled={busy !== null || workingDirty}',
    );
    expect(workspace).toContain(
      "Save changes before submitting for Review.",
    );
  });

  it("puts governed Audio lifecycle actions in the shared record action rail", () => {
    for (const action of [
      "Submit for Review",
      "Start Review",
      "Request Changes",
      "Approve",
      "Publish",
    ]) {
      expect(workspace).toContain(action);
    }

    expect(workspace.match(/Start Review/g) ?? []).toHaveLength(1);
    expect(workspace.match(/Request Changes/g) ?? []).toHaveLength(1);
    expect(workspace.match(/>\s*Approve\s*</g) ?? []).toHaveLength(1);
    expect(workspace.match(/>\s*Publish\s*</g) ?? []).toHaveLength(1);
  });

  it("keeps the Audio Review panel for note and version context instead of duplicate actions", () => {
    expect(workspace).toContain(
      "Lifecycle actions stay in the record header",
    );
    expect(workspace).toContain(
      "Review always targets one exact immutable version.",
    );
    for (const version of [
      "Working",
      "Submitted",
      "Approved",
      "Published",
    ]) {
      expect(workspace).toContain(version);
    }
  });
});
