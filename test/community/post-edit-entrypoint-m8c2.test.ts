import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) =>
  fs.readFileSync(path.join(root, file), "utf8");

describe("M8C.2 Post edit entrypoint", () => {
  it("exposes Edit Post for manageable Posts in the shared action menu", () => {
    const source = read("src/components/community/PostActions.tsx");

    expect(source).toContain("Edit Post");
    expect(source).toContain("setEditOpen(true)");
    expect(source).toContain("<PostEditDialog");
    expect(source).toContain("onEdited={() => navigate(0)}");
  });

  it("reuses the canonical M8C.2-aware PostComposer editor", () => {
    const dialog = read("src/components/community/PostEditDialog.tsx");
    const composer = read("src/components/community/PostComposer.tsx");

    expect(dialog).toContain("editingPost={post}");
    expect(dialog).toContain("actor={post.actor}");
    expect(composer).toContain("setSelectedTrack(editingPost.track)");
    expect(composer).toContain("registryTrackId: selectedTrack?.id ?? null");
    expect(composer).toContain("disabled={busy || uploading || !hasContent}");
  });

  it("keeps Delete Post alongside Edit Post", () => {
    const source = read("src/components/community/PostActions.tsx");

    expect(source).toContain("Edit Post");
    expect(source).toContain("Delete Post");
    expect(source.indexOf("Edit Post")).toBeLessThan(
      source.indexOf("Delete Post"),
    );
  });
});
