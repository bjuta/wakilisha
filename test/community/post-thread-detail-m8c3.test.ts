import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const detail = readFileSync(
  "src/components/community/PostDetailSurface.tsx",
  "utf8",
);
const service = readFileSync(
  "src/services/community/postDrafts.ts",
  "utf8",
);

describe("WAKILISHA M8C.3 Thread detail UI", () => {
  it("loads Thread context from the selected canonical Post", () => {
    expect(detail).toContain("getPostThreadContext(post.id)");
    expect(detail).toContain("getPostThread(context.threadId)");
    expect(detail).toContain("thread.items.some((item) => item.id === post.id)");
  });

  it("falls back to the selected Post if Thread hydration is unavailable", () => {
    expect(detail).toContain("setThreadPosts(null)");
    expect(detail).toContain("threadPosts && threadPosts.length > 1 ? threadPosts : [post]");
  });

  it("renders a connected authored sequence instead of flattening Thread items", () => {
    expect(detail).toContain("<span>Thread</span>");
    expect(detail).toContain("visiblePosts.map((item, index)");
    expect(detail).toContain("bottom-[-12px] w-px");
    expect(detail).toContain("Post {index + 1} of {visiblePosts.length}");
  });

  it("keeps each canonical Post own actions and attachments", () => {
    expect(detail).toContain("<PostTrackAttachment");
    expect(detail).toContain("<PostLinkAttachment");
    expect(detail).toContain("<QuotedPostCard");
    expect(detail).toContain("post={item}");
    expect(detail).toContain("interaction.toggleReaction(item, reactionType)");
  });

  it("keeps comments attached to the canonical route Post", () => {
    expect(detail).toContain("id: post.id");
    expect(detail).toContain("url: post.canonicalPath");
    expect(detail).toContain('mode="post"');
  });

  it("maps draft and Thread RPC responses through canonical Post decoding", () => {
    expect(service).toContain("mapCommunityPostDraft");
    expect(service).toContain("mapCommunityPost(record.quoted_post)");
    expect(service).toContain("community_publish_post_draft_group");
    expect(service).toContain("community_get_thread");
    expect(service).toContain("community_get_post_thread_context");
  });
});
