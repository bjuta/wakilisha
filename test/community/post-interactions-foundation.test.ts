import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const postActions = readFileSync("src/components/community/PostActions.tsx", "utf8");
const postState = readFileSync("src/hooks/usePostInteractionState.ts", "utf8");
const postSurface = readFileSync("src/components/community/PostDetailSurface.tsx", "utf8");
const artistTimeline = readFileSync("src/pages/artists/detail/components/ArtistPostsTimeline.tsx", "utf8");
const personPost = readFileSync("src/pages/posts/detail/page.tsx", "utf8");
const artistPost = readFileSync("src/pages/artists/update/page.tsx", "utf8");
const managePage = readFileSync("src/pages/artists/manage/page.tsx", "utf8");


describe("M8A universal Post interaction foundation", () => {
  it("ships one serious Post action grammar", () => {
    for (const label of ["Reply", "Bookmark", "React", "Share", "Follow", "Delete Post"]) {
      expect(postActions).toContain(label);
    }
    expect(postActions).toContain("withdrawPost");
  });

  it("reuses existing Save, Follow, Reaction, and Artist representation authority", () => {
    expect(postState).toContain("getUserSaves");
    expect(postState).toContain("getUserFollowing");
    expect(postState).toContain("getReactionStateForPublicTargets");
    expect(postState).toContain("getArtistRepresentationState");
  });

  it("makes both canonical Post routes real threaded conversations", () => {
    expect(postSurface).toContain("CommunitySection");
    expect(postSurface).toContain('type: "post"');
    expect(personPost).toContain("PostDetailSurface");
    expect(artistPost).toContain("PostDetailSurface");
    expect(artistPost).toContain("getPost");
  });

  it("uses universal actions on the public Artist timeline", () => {
    expect(artistTimeline).toContain("PostActions");
    expect(artistTimeline).toContain("usePostInteractionState");
  });

  it("retires duplicate Artist Studio posting", () => {
    expect(managePage).not.toContain('label="Posts"');
    expect(managePage).not.toContain('id="artist-posts"');
    expect(managePage).not.toContain("ArtistPostComposer");
  });

  it("does not fake the next authority milestones", () => {
    expect(postActions).not.toContain("Repost");
    expect(postActions).not.toContain("Block");
    expect(postActions).not.toContain("Report Post");
    expect(postActions).not.toContain("Add to Playlist");
  });

  it("keeps new runtime copy free of em and en dashes", () => {
    for (const source of [postActions, postState, postSurface, personPost, artistPost]) {
      expect(source).not.toContain("—");
      expect(source).not.toContain("–");
    }
  });
});
