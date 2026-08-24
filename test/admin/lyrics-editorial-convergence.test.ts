import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(relative: string): string {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

describe("Lyrics editorial convergence", () => {
  const lyricsPage = source("src/pages/admin/content/lyrics/page.tsx");
  const lyricsReview = source(
    "src/pages/admin/content/lyrics/components/LyricsContributionReviewWorkspace.tsx",
  );
  const lyricsHistory = source(
    "src/pages/admin/content/lyrics/components/LyricsHistoryWorkspace.tsx",
  );
  const lyricsAdminService = source(
    "src/services/player/trackLyricsAdminService.ts",
  );
  const audioReview = source(
    "src/pages/admin/content/audio/detail/components/AudioReviewWorkspace.tsx",
  );
  const audioWorkspace = source(
    "src/pages/admin/content/audio/detail/AudioEditorWorkspace.tsx",
  );
  const playlistWorkspace = source(
    "src/pages/admin/content/playlists/detail/PlaylistEditorWorkspace.tsx",
  );
  const articleWorkspace = source(
    "src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx",
  );
  const decisionPrimitive = source(
    "src/components/design-system/editorial/EditorialDecisionWorkspace.tsx",
  );
  const diffPrimitive = source(
    "src/components/design-system/editorial/EditorialTextDiff.tsx",
  );
  const recordActions = source(
    "src/components/design-system/admin/AdminRecordActions.tsx",
  );
  const primitiveRegistry = JSON.parse(
    source("scripts/control-plane/primitive-registry.json"),
  ) as {
    primitives: Array<{
      id: string;
      maturity: string;
      consumers: string[];
    }>;
  };
  const lyricsReviewMigration = source(
    "supabase/migrations/20260824061359_track_lyrics_review_provenance.sql",
  );

  it("makes Lyrics a contribution-first operations hub", () => {
    expect(lyricsPage).toContain('useState<LyricsWorkspaceView>("inbox")');
    expect(lyricsPage).toContain('label: "Inbox"');
    expect(lyricsPage).toContain('label: "Library / Add Lyrics"');
    expect(lyricsPage).toContain('label: "Review"');
    expect(lyricsPage).toContain('label: "History"');
    expect(lyricsPage).toContain("fetchTrackLyricsContributionInbox");
    expect(lyricsPage).toContain("searchTrackLyricsAdminTracks");
    expect(lyricsPage).not.toContain("listLyricsTrackChoices");
  });

  it("locks the browser-accepted search priority and truthful History grammar", () => {
    expect(lyricsAdminService).toContain(
      "Number(right.pendingContributionCount > 0)",
    );
    expect(lyricsAdminService).toContain(
      "Number(left.pendingContributionCount > 0)",
    );
    expect(lyricsHistory).toContain(
      'item.status !== "submitted"',
    );
    expect(lyricsHistory).toContain('title="Contribution history"');
    expect(lyricsHistory).toContain("Review decisions");
    expect(lyricsHistory).toContain("Contributions");
    expect(lyricsHistory).toContain("Current published versions");
    expect(lyricsHistory).not.toContain("Contribution decisions");
  });

  it("makes contribution review preserve the original while editing a separate revision", () => {
    expect(lyricsReview).toContain("Original listener submission");
    expect(lyricsReview).toContain("WAKILISHA revision");
    expect(lyricsReview).toContain("EditorialTextDiff");
    expect(lyricsReview).toContain('"as_submitted"');
    expect(lyricsReview).toContain('"with_revisions"');
    expect(lyricsReview).toContain("Accept as submitted");
    expect(lyricsReview).toContain("Accept WAKILISHA revision");
    expect(lyricsReview).toContain("requiresNote: true");
  });

  it("keeps accepted Lyrics in Review for the separate Publish decision", () => {
    expect(lyricsReview).toContain("async function publishAcceptedLyrics");
    expect(lyricsReview).toContain("await publishTrackLyrics(workspace)");
    expect(lyricsReview).toContain('label: "Publish"');
    expect(lyricsReview).toContain("Accepted · Not published");
    expect(lyricsReview).toContain(
      "Publication remains a separate governed decision in this same workspace.",
    );
    expect(lyricsPage).toContain("const reviewed = historyRows.find(");
    expect(lyricsPage).toContain("setSelectedContribution(reviewed)");
    expect(lyricsPage).toContain("openHistoricalContribution");
    expect(lyricsHistory).toContain("onOpenContribution");
    expect(lyricsHistory).toContain(
      "Open current accepted version in Review",
    );
    expect(lyricsHistory).toContain("version.id === item.acceptedVersionId");
    expect(lyricsHistory).toContain("version.isWorking");
    expect(lyricsReview).toContain("setDecisionStatus(contribution.status)");
    expect(lyricsReview).toContain(
      "setAcceptedVersionId(contribution.acceptedVersionId)",
    );
    expect(lyricsReview).toContain(
      "acceptedVersionId === workspace.currentWorkingVersionId",
    );
    expect(lyricsReview).toContain("Accepted · Historical version");
    expect(lyricsReview).toContain("lyricsDocumentToEditorText(next.working)");
    expect(lyricsPage).not.toContain(
      'setSelectedContribution(null);\n    await Promise.all([loadInbox(""), loadHistory()]);\n    setInboxQuery("");\n    setView("inbox");',
    );
  });

  it("reuses one editorial decision grammar for Audio and Lyrics", () => {
    expect(audioReview).toContain("EditorialDecisionWorkspace");
    expect(lyricsReview).toContain("EditorialDecisionWorkspace");
    expect(audioReview).toContain("Request Changes");
    expect(audioReview).toContain("Approve");
    expect(audioReview).toContain("Publish");
    expect(decisionPrimitive).not.toContain("@/services/");
    expect(decisionPrimitive).not.toContain("@/lib/supabase");
  });

  it("extends the shared record action primitive instead of creating a second header grammar", () => {
    expect(recordActions).toContain('placement?: "inline" | "overflow"');
    expect(recordActions).toContain("overflowLabel");
    expect(recordActions).toContain('aria-haspopup="menu"');
    expect(lyricsPage).toContain("AdminRecordHeader");
    expect(lyricsPage).toContain("AdminRecordActions");
    expect(lyricsPage).toContain("AdminSaveState");
  });

  it("promotes workspace and workflow primitives only after Lyrics becomes a second consumer", () => {
    const byId = new Map(
      primitiveRegistry.primitives.map((primitive) => [primitive.id, primitive]),
    );

    expect(byId.get("admin.workspace-section")).toMatchObject({
      maturity: "canonical",
      consumers: ["admin:audio", "admin:lyrics"],
    });
    expect(byId.get("editorial.workflow-rail")).toMatchObject({
      maturity: "canonical",
      consumers: ["admin:audio", "admin:lyrics"],
    });
    expect(byId.get("editorial.decision-workspace")).toMatchObject({
      maturity: "canonical",
      consumers: [
        "admin:articles",
        "admin:playlists",
        "admin:audio",
        "admin:lyrics",
      ],
    });
    expect(byId.get("editorial.text-diff")).toMatchObject({
      maturity: "canonical",
      consumers: ["admin:articles", "admin:lyrics"],
    });
  });

  it("wires shared decision helpers into the real parent workspaces", () => {
    expect(audioWorkspace).toContain("AudioEditorHeader");
    expect(playlistWorkspace).toContain("PlaylistReviewDecisionWorkspace");
    expect(articleWorkspace).toContain("ArticleReviewDecisionWorkspace");
    expect(lyricsPage).toContain("LyricsHistoryWorkspace");
  });

  it("keeps Lyrics search and contribution decisions behind governed RPCs", () => {
    for (const rpc of [
      "get_admin_track_lyrics_contribution_inbox",
      "search_admin_track_lyrics_tracks",
      "review_track_lyrics_contribution",
      "reject_track_lyrics_contribution",
    ]) {
      expect(lyricsAdminService).toContain(rpc);
    }

    expect(lyricsAdminService).not.toContain('.from("registry_tracks")');
    expect(lyricsAdminService).not.toContain('.from("track_lyrics_contributions")');
  });

  it("removes bookmark capability from Track Lyrics editorial authority", () => {
    expect(lyricsReviewMigration).not.toMatch(/current_user_has_capability\('save_content'\)/);
    for (const capability of [
      "view_audio",
      "edit_own_audio",
      "edit_others_audio",
      "manage_review_queue",
      "publish_audio",
    ]) {
      expect(lyricsReviewMigration).toContain(`current_user_has_capability('${capability}')`);
    }
  });

  it("stores structural contribution provenance instead of a presentation-only disclaimer", () => {
    for (const field of [
      "source_contribution_id",
      "source_contributor_id",
      "source_contributor_label",
      "community_revision_mode",
      "acceptance_mode",
    ]) {
      expect(lyricsReviewMigration).toContain(field);
    }

    expect(lyricsReviewMigration).toContain("protect_track_lyrics_contribution_payload");
    expect(lyricsReviewMigration).toContain("Submitted Lyrics contribution payload is immutable");
  });

  it("keeps the diff primitive consumer-owned and domain-neutral", () => {
    expect(diffPrimitive).toContain("buildEditorialTextDiff");
    expect(diffPrimitive).not.toContain("@/services/");
    expect(diffPrimitive).not.toContain("@/pages/");
    expect(diffPrimitive).not.toContain("@/lib/supabase");
  });
});
