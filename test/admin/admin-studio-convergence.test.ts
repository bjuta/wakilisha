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
  const recordActions = source(
    "src/components/design-system/admin/AdminRecordActions.tsx",
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
  const primitiveRegistry = source(
    "scripts/control-plane/primitive-registry.json",
  );

  const articleHeader = source(
    "src/pages/admin/content/articles/detail/components/ArticleEditorHeader.tsx",
  );
  const playlistHeader = source(
    "src/pages/admin/content/playlists/detail/components/PlaylistEditorHeader.tsx",
  );
  const playlistWorkspace = source(
    "src/pages/admin/content/playlists/detail/PlaylistEditorWorkspace.tsx",
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

  it("defines organization-level record, action, lifecycle, save-state, section, and collection primitives", () => {
    expect(recordHeader).toContain("AdminStatusBadge");
    expect(recordHeader).toContain("sticky top-0");
    expect(recordHeader).toContain("collectionLabel");
    expect(recordHeader).toContain("actions");
    expect(recordHeader).toContain("footer");

    expect(recordActions).toContain("export interface AdminRecordAction");
    expect(recordActions).toContain('placement?: "rail" | "menu"');
    expect(recordActions).toContain('tone?: AdminRecordActionTone');
    expect(recordActions).toContain('aria-haspopup="menu"');
    expect(recordActions).toContain("overflowLabel");
    expect(recordActions).toContain('tone === "danger"');

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

    expect(primitiveRegistry).toContain('"id": "admin.record-actions"');
    expect(primitiveRegistry).toContain('"path": "src/components/design-system/admin/AdminRecordActions.tsx"');
    expect(primitiveRegistry).toContain('"maturity": "canonical"');
  });

  it("makes Article, Playlist, and Audio action surfaces consumers rather than competing renderers", () => {
    for (const consumer of [articleHeader, playlistHeader, audioWorkspace]) {
      expect(consumer).toContain("AdminRecordHeader");
      expect(consumer).toContain("AdminSaveState");
      expect(consumer).toContain("AdminRecordActions");
    }

    expect(articleHeader).not.toContain("overflowRef");
    expect(articleHeader).not.toContain("setOverflowOpen");
    expect(playlistHeader).not.toContain("function renderAction");
    expect(playlistHeader).not.toContain("function actionClass");
  });

  it("keeps Article domain actions intact while sharing one interaction grammar", () => {
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

  it("keeps Playlist lifecycle authority in Playlist while sharing Save, Details, and action rendering", () => {
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

    expect(playlistHeader).toContain('id: "save"');
    expect(playlistHeader).toContain('id: "details"');
    expect(playlistHeader).toContain("Save an immutable working version.");
  });

  it("gives Audio the same semantic action vocabulary only where governed authority exists", () => {
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
      expect(audioWorkspace).toContain(action);
    }

    expect(audioWorkspace).toContain("archiveAudioPublication");
    expect(audioWorkspace).toContain("restoreAudioPublicationFromArchive");
    expect(audioWorkspace).toContain("workspace.canArchive");
    expect(audioWorkspace).not.toContain("createAudioPreviewLink");

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

  it("preserves the original convergence doctrine while correcting its action-rail gap in a follow-on", () => {
    const audit = source(
      "docs/engineering/admin-studio-convergence-audit.md",
    );
    const correction = source(
      "docs/engineering/admin-record-actions-convergence-audit.md",
    );

    expect(audit).toContain("Extract -> converge -> migrate");
    expect(audit).toContain("The goal is not that every screen looks identical.");
    expect(audit).toContain("The goal is that every screen knows what the same thing means.");
    expect(correction).toContain("same meaning, one primitive");
    expect(correction).toContain("Preview is intentionally not fabricated for Audio");
    expect(correction).toContain("Archive and Restore");
  });
});
