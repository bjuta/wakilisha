import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const m1Migration = readFileSync(
  "supabase/migrations/20260816083500_community_social_graph_m8b_authority.sql",
  "utf8",
);
const postActions = readFileSync("src/components/community/PostActions.tsx", "utf8");
const postComposer = readFileSync("src/components/community/PostComposer.tsx", "utf8");
const quoteDialog = readFileSync("src/components/community/PostQuoteDialog.tsx", "utf8");
const reportDialog = readFileSync("src/components/community/PostReportDialog.tsx", "utf8");
const interaction = readFileSync("src/hooks/usePostInteractionState.ts", "utf8");
const notificationBell = readFileSync(
  "src/components/feature/community/NotificationBell.tsx",
  "utf8",
);
const detail = readFileSync("src/components/community/PostDetailSurface.tsx", "utf8");
const artistTimeline = readFileSync(
  "src/pages/artists/detail/components/ArtistPostsTimeline.tsx",
  "utf8",
);
const followingPage = readFileSync("src/pages/following/page.tsx", "utf8");

describe("WAKILISHA M8B-M3 shared Post actions", () => {
  it("extends one Post action grammar", () => {
    for (const label of ["Repost", "Quote Post", "Block", "Report Post"]) {
      expect(postActions).toContain(label);
    }
    expect(postActions).toContain("PostQuoteDialog");
    expect(postActions).toContain("PostReportDialog");
  });

  it("uses the canonical signed-in Person as the default shared acting identity", () => {
    expect(interaction).toContain("viewerActor");
    expect(interaction).toContain('viewerActor?.type === "person"');
    expect(postActions).toContain("actionActor");
  });

  it("hydrates and toggles durable Repost state", () => {
    expect(interaction).toContain("getActorRepostState");
    expect(interaction).toContain("setPostRepostState");
    expect(interaction).toContain("repostStates");
    expect(interaction).toContain("repostingPostIds");
    expect(postActions).toContain("Undo Repost");
  });

  it("reuses PostComposer for Quote Post", () => {
    expect(postComposer).toContain("quotedPost");
    expect(postComposer).toContain("quotePost");
    expect(postComposer).toContain("QuotedPostCard");
    expect(quoteDialog).toContain("PostComposer");
    expect(quoteDialog).not.toContain("<textarea");
  });

  it("makes Block update Follow state immediately", () => {
    expect(interaction).toContain("setBlockState");
    expect(interaction).toContain("blockedActorKeys");
    expect(interaction).toContain("setFollowedActorKeys");
    expect(postActions).toContain("You will unfollow them");
  });

  it("reuses the canonical Community report reasons", () => {
    for (const reason of [
      "spam",
      "harassment",
      "hate_or_abuse",
      "misinformation",
      "privacy",
      "copyright",
      "off_topic",
      "other",
    ]) {
      expect(reportDialog).toContain(`"${reason}"`);
    }
    expect(interaction).toContain("reportPost");
    expect(interaction).toContain("submitReport");
  });

  it("wires the same M8B state to all shared Post surfaces", () => {
    for (const surface of [detail, artistTimeline, followingPage]) {
      expect(surface).toContain("actionActor=");
      expect(surface).toContain("repostState=");
      expect(surface).toContain("onToggleRepost=");
      expect(surface).toContain("onToggleBlock=");
      expect(surface).toContain("onReport=");
    }
  });

  it("makes Repost and Quote Post notifications navigable", () => {
    expect(m1Migration).toContain("'canonical_path'");
    expect(notificationBell).toContain("post_repost");
    expect(notificationBell).toContain("post_quote");
    expect(notificationBell).toContain("canonical_path");
  });

  it("keeps owner moderation distinct from Block and Report", () => {
    expect(postActions).toContain("Delete Post");
    expect(postActions).toContain("canManage ?");
  });

  it("keeps primary Post actions icon-first and accessibly named", () => {
    expect(postActions).toContain('title="Reply"');
    expect(postActions).toContain('aria-label="Reply"');
    expect(postActions).toContain(
      'title={saved ? "Remove Bookmark" : "Bookmark"}',
    );
    expect(postActions).toContain(
      'activeReactions.length > 0',
    );
    expect(postActions).toContain(
      '? "Manage Reactions"',
    );
    expect(postActions).toContain(
      'title={viewerReposted ? "Repost Options" : "Repost"}',
    );
    expect(postActions).toContain('title="Share"');
    expect(postActions).toContain('className="sr-only">Reply</span>');
    expect(postActions).toContain('className="sr-only">React</span>');
    expect(postActions).toContain('className="sr-only">Repost</span>');
    expect(postActions).toContain('className="sr-only">Share</span>');
    expect(postActions).not.toContain(
      'reactionCount > 0 ? reactionCount : "React"',
    );
    expect(postActions).not.toContain(
      'repostCount > 0 ? repostCount : "Repost"',
    );
  });

  it("keeps M8B-M3 runtime copy free of em and en dashes", () => {
    for (const source of [
      m1Migration,
      postActions,
      postComposer,
      quoteDialog,
      reportDialog,
      interaction,
      notificationBell,
      detail,
      artistTimeline,
      followingPage,
    ]) {
      expect(source).not.toContain("—");
      expect(source).not.toContain("–");
    }
  });
});
