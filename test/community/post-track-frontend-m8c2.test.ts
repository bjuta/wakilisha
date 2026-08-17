import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const posts = read("src/services/community/posts.ts");
const followingService = read("src/services/community/followingFeed.ts");
const composer = read("src/components/community/PostComposer.tsx");
const picker = read("src/components/community/PostTrackPicker.tsx");
const attachment = read("src/components/community/PostTrackAttachment.tsx");
const quote = read("src/components/community/QuotedPostCard.tsx");
const detail = read("src/components/community/PostDetailSurface.tsx");
const artistTimeline = read("src/pages/artists/detail/components/ArtistPostsTimeline.tsx");
const followingPage = read("src/pages/following/page.tsx");
const m8c1Reach = read("test/playlists/personal-playlists-m8c1-reach.test.ts");

describe("WAKILISHA M8C.2 Post Track frontend", () => {
  it("maps canonical Track identity and allows an empty Post body", () => {
    expect(posts).toContain("export type PostTrack");
    expect(posts).toContain("track: PostTrack | null");
    expect(posts).toContain("function readBody");
    expect(posts).toContain('readString(record, "artist_slug")');
    expect(posts).toContain("body == null");
    expect(posts).toContain("body.trim() || imageUrl || linkUrl || track");
    expect(posts).not.toContain("!actorId || !body ||");
  });

  it("sends one Registry Track UUID through publish, edit, and Quote RPCs", () => {
    expect(posts.match(/p_registry_track_id: input\.registryTrackId \|\| null/g)?.length).toBe(3);
    expect(posts).not.toContain("canonicalTrackId");
    expect(m8c1Reach).toContain("lets Post Track attachments use canonical Registry Track identity");
  });

  it("replaces caption-first composer validity with content validity", () => {
    expect(composer).toContain("const hasContent = Boolean(");
    expect(composer).toContain("selectedTrack");
    expect(composer).toContain("if (!hasContent || busy || uploading) return;");
    expect(composer).toContain("disabled={busy || uploading || !hasContent}");
    expect(composer).not.toContain("disabled={busy || uploading || !body.trim()}");
    expect(composer).not.toContain("if (!cleanBody || busy || uploading) return;");
  });

  it("mounts Registry Track search only when the user chooses Track", () => {
    expect(composer).toContain("trackPickerOpen ? (");
    expect(composer).toContain("<PostTrackPicker");
    expect(picker).toContain("useTrackSearchData");
    expect(picker).toContain("selectedTrackId");
    expect(picker).toContain("Choose a Track from WAKILISHA.");
    expect(picker).not.toContain("registry_tracks");
  });

  it("uses the accepted artwork-play and Track-actions grammar for Post attachments", () => {
    expect(attachment).toContain("<PlayableArtwork");
    expect(attachment).toContain("<TrackActionsMenu");
    expect(attachment).toContain("registryTrackId: track.id");
    expect(attachment).toContain("post_track_attachment");
    expect(attachment).toContain("trackHref={track.canonicalPath}");
  });

  it("keeps bodyless Quote Posts available and renders every attachment type", () => {
    expect(posts).toContain("actorType: actor.type");
    expect(quote).not.toContain("!quotedPost.body");
    expect(quote).toContain("quotedPost.body ? (");
    expect(quote).toContain("quotedPost.track ? (");
    expect(quote).toContain("quotedPost.imageUrl && (");
    expect(quote).toContain("quotedPost.linkUrl ? (");
    expect(quote).toContain("You blocked this Person.");
  });

  it("does not render blank Post body paragraphs", () => {
    expect(detail).toContain("{post.body ? (");
    expect(artistTimeline).toContain("{post.body ? (");
    expect(detail).toContain("<PostTrackAttachment");
    expect(artistTimeline).toContain("<PostTrackAttachment");
  });

  it("carries Track-only Posts through Following defensively", () => {
    expect(followingService).toContain("post?.track?.title");
    expect(followingService).toContain("`Post from ${post.actor.name}`");
    expect(followingPage).toContain("post?.track ? (");
    expect(followingPage).toContain("<PostTrackAttachment");
  });

  it("keeps new M8C.2 runtime copy free of em and en dashes", () => {
    for (const source of [
      posts,
      followingService,
      composer,
      picker,
      attachment,
      quote,
      detail,
      artistTimeline,
      followingPage,
    ]) {
      expect(source).not.toContain("—");
      expect(source).not.toContain("–");
    }
  });
});
