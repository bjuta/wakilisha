import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const composer = readFileSync(
  "src/components/community/PostComposer.tsx",
  "utf8",
);
const draftsDialog = readFileSync(
  "src/components/community/PostDraftsDialog.tsx",
  "utf8",
);
const service = readFileSync(
  "src/services/community/postDrafts.ts",
  "utf8",
);

describe("WAKILISHA M8C.3 Drafts and Thread composer", () => {
  it("makes private Drafts a first-class entry point beside the universal composer", () => {
    expect(composer).toContain(">\n          Drafts\n        </button>");
    expect(composer).toContain("<PostDraftsDialog");
    expect(draftsDialog).toContain("Saved privately as {actor.name}");
    expect(draftsDialog).toContain("Post draft");
    expect(draftsDialog).toContain("Thread draft");
  });

  it("lets authored work be saved without requiring publication", () => {
    expect(composer).toContain("Save draft");
    expect(composer).toContain("persistCurrentDraft");
    expect(composer).toContain("savePostDraft({");
    expect(service).toContain('rpc("community_save_post_draft"');
  });

  it("turns Add another Post into one private Thread draft group", () => {
    expect(composer).toContain("+ Add another Post");
    expect(composer).toContain("setThreadMode(true)");
    expect(composer).toContain("setActiveDraftId(null)");
    expect(composer).toContain("Post Thread");
    expect(composer).toContain("publishPostDraftGroup(groupId)");
  });

  it("preserves the existing authored content grammar inside Thread items", () => {
    expect(composer).toContain("uploadPostImage(actor, file)");
    expect(composer).toContain("<PostTrackPicker");
    expect(composer).toContain("<PostTrackAttachment");
    expect(composer).toContain("<PostLinkAttachment");
    expect(composer).toContain("<QuotedPostCard");
    expect(composer).toContain("registryTrackId: selectedTrack?.id ?? null");
  });

  it("keeps a direct Quote attached only to the Thread item that authored it", () => {
    expect(composer).toContain(
      "const [quotedPostDetached, setQuotedPostDetached] = useState(false)",
    );
    expect(composer).toContain(
      "const activeQuotedPost = quotedPostDetached ? null : quotedPost",
    );
    expect(composer).toContain(
      "quotedPostId: activeQuotedPost?.id ?? draftQuotedPost?.id ?? null",
    );
    expect(composer).toContain(
      "await persistCurrentDraft();\n      setQuotedPostDetached(true);\n      setThreadMode(true)",
    );
    expect(composer).toContain("quotedPostId: activeQuotedPost.id");
  });

  it("re-attaches a new direct Quote when the quoted Post prop changes", () => {
    expect(composer).toContain(
      "setQuotedPostDetached(false);\n  }, [quotedPost?.id])",
    );
    expect(composer).toContain("setQuotedPostDetached(false);\n    setThreadMode(false)");
  });

  it("keeps mobile composition full-screen while exposing Thread controls", () => {
    expect(composer).toContain('aria-label="Close Post Composer"');
    expect(composer).toContain("h-[100dvh]");
    expect(composer).toContain('threadMode\n                ? "Create Thread"');
    expect(composer).toContain("+ Add another Post");
    expect(composer).toContain("Save draft");
  });

  it("does not fork publication authority in the client", () => {
    expect(service).toContain("community_publish_post_draft_group");
    expect(composer).toContain("publishPostDraftGroup(groupId)");
    expect(composer).not.toContain("supabase.from(\"community_posts\")");
  });
});
