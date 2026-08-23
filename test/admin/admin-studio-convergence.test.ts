import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(relative: string): string {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

describe("Admin Studio convergence", () => {
  const recordHeader = source(
    "src/components/design-system/admin/AdminRecordHeader.tsx",
  );
  const saveState = source(
    "src/components/design-system/admin/AdminSaveState.tsx",
  );
  const statusBadge = source(
    "src/components/design-system/admin/AdminStatusBadge.tsx",
  );
  const workspaceSection = source(
    "src/components/design-system/admin/AdminWorkspaceSection.tsx",
  );
  const collectionHeader = source(
    "src/components/design-system/admin/AdminCollectionHeader.tsx",
  );

  const articleHeader = source(
    "src/pages/admin/content/articles/detail/components/ArticleEditorHeader.tsx",
  );
  const playlistHeader = source(
    "src/pages/admin/content/playlists/detail/components/PlaylistEditorHeader.tsx",
  );
  const audioWorkspace = source(
    "src/pages/admin/content/audio/detail/AudioEditorWorkspace.tsx",
  );

  const articleIndex = source(
    "src/pages/admin/content/articles/page.tsx",
  );
  const playlistIndex = source(
    "src/pages/admin/content/playlists/page.tsx",
  );
  const audioIndex = source(
    "src/pages/admin/content/audio/page.tsx",
  );

  it("defines organization-level record, lifecycle, save-state, section, and collection primitives", () => {
    expect(recordHeader).toContain("AdminStatusBadge");
    expect(recordHeader).toContain("sticky top-0");
    expect(recordHeader).toContain("collectionLabel");
    expect(recordHeader).toContain("actions");
    expect(recordHeader).toContain("footer");

    for (const label of ["Saving", "Unsaved", "All Saved", "Submitted Version"]) {
      expect(saveState).toContain(label);
    }

    for (const status of [
      "publish",
      "published",
      "approved",
      "ready_for_review",
      "pending",
      "in_review",
      "draft",
      "changes_requested",
      "future",
      "scheduled",
      "trash",
      "archived",
      "private",
    ]) {
      expect(statusBadge).toContain(status);
    }

    expect(workspaceSection).toContain("WkSurface");
    expect(workspaceSection).toContain("actions");
    expect(collectionHeader).toContain("eyebrow");
    expect(collectionHeader).toContain("description");
  });

  it("makes Article and Playlist detail headers consumers rather than competing shell implementations", () => {
    for (const header of [articleHeader, playlistHeader]) {
      expect(header).toContain("AdminRecordHeader");
      expect(header).toContain("AdminSaveState");
    }

    expect(articleHeader).not.toContain("const STATUS_COLORS");
    expect(playlistHeader).not.toContain("const saveTone");
    expect(playlistHeader).not.toContain("const saveLabel");
  });

  it("keeps Article domain actions intact while moving only shell semantics", () => {
    for (const action of [
      "Preview",
      "Save",
      "Details",
      "Approve Version",
      "Request Changes",
      "Submit for Review",
      "Publish",
      "Update",
      "Unschedule",
      "View Live",
      "Return to Draft",
      "Move to Trash",
    ]) {
      expect(articleHeader).toContain(action);
    }
  });

  it("keeps Playlist domain lifecycle actions owned by Playlist workspace while sharing chrome", () => {
    const playlistWorkspace = source(
      "src/pages/admin/content/playlists/detail/PlaylistEditorWorkspace.tsx",
    );

    for (const action of [
      "Submit for Review",
      "Start Review",
      "Request changes",
      "Approve",
      "Schedule",
      "Publish",
      "Unschedule",
      "Unpublish",
      "Archive",
      "Restore",
    ]) {
      expect(playlistWorkspace).toContain(action);
    }

    expect(playlistHeader).toContain("Details");
    expect(playlistHeader).toContain("Save an immutable working version.");
  });

  it("recomposes Audio from the shared record and workspace primitives without flattening Audio workflow", () => {
    expect(audioWorkspace).toContain("AdminRecordHeader");
    expect(audioWorkspace).toContain("AdminWorkspaceSection");
    expect(audioWorkspace).not.toContain("function WorkflowPill");
    expect(audioWorkspace).not.toContain("function SectionHeader");

    for (const domainConcept of [
      "Sound and Transcript",
      "Master Audio",
      "Transcript",
      "Chapters",
      "Credits and Citations",
      "Review",
      "Podcast Delivery",
      "History",
      "setAudioMaster",
      "setAudioTranscript",
      "replaceAudioChapters",
      "replaceAudioCredits",
      "replaceAudioCitations",
      "reviewAudio",
      "publishAudio",
    ]) {
      expect(audioWorkspace).toContain(domainConcept);
    }
  });

  it("converges all three collection surfaces on the same heading and lifecycle language", () => {
    for (const index of [articleIndex, playlistIndex, audioIndex]) {
      expect(index).toContain("AdminCollectionHeader");
      expect(index).toContain("AdminStatusBadge");
      expect(index).not.toContain("function statusClass");
    }

    expect(articleIndex).not.toContain("function StatusBadge");
    expect(playlistIndex).not.toContain("function humanize");
    expect(audioIndex).not.toContain("function humanize");
  });

  it("documents the convergence boundary as shared semantics plus domain-specific workspaces", () => {
    const audit = source(
      "docs/engineering/admin-studio-convergence-audit.md",
    );

    expect(audit).toContain("Extract -> converge -> migrate");
    expect(audit).toContain("The goal is not that every screen looks identical.");
    expect(audit).toContain("The goal is that every screen knows what the same thing means.");
    expect(audit).toContain("This convergence milestone was frontend-only.");
    expect(audit).toContain("schema changes");
    expect(audit).toContain("changes to Article, Playlist, or Audio domain authority");
  });
});
