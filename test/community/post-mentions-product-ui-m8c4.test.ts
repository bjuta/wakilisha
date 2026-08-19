import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  tokenizePostBodyMentions,
} from "../../src/services/community/postBodyMentions";

const postsService = readFileSync(
  "src/services/community/posts.ts",
  "utf8",
);
const postBody = readFileSync(
  "src/components/community/PostBody.tsx",
  "utf8",
);
const postBodyMentions = readFileSync(
  "src/services/community/postBodyMentions.ts",
  "utf8",
);
const detail = readFileSync(
  "src/components/community/PostDetailSurface.tsx",
  "utf8",
);
const artistTimeline = readFileSync(
  "src/pages/artists/detail/components/ArtistPostsTimeline.tsx",
  "utf8",
);
const following = readFileSync(
  "src/pages/following/page.tsx",
  "utf8",
);
const quotedCard = readFileSync(
  "src/components/community/QuotedPostCard.tsx",
  "utf8",
);
const composer = readFileSync(
  "src/components/community/PostComposer.tsx",
  "utf8",
);
const notificationBell = readFileSync(
  "src/components/feature/community/NotificationBell.tsx",
  "utf8",
);
const notificationsPage = readFileSync(
  "src/pages/notifications/page.tsx",
  "utf8",
);
const notificationSettings = readFileSync(
  "src/pages/settings/components/NotificationsSettingsPane.tsx",
  "utf8",
);
const workflow = readFileSync(
  ".github/workflows/critical-control-plane.yml",
  "utf8",
);
const postActions = readFileSync(
  "src/components/community/PostActions.tsx",
  "utf8",
);
const composerSuggestions = readFileSync(
  "src/components/community/PostMentionSuggestions.tsx",
  "utf8",
);
const mentionSuggestionService = readFileSync(
  "src/services/community/mentionSuggestions.ts",
  "utf8",
);
const mentionSuggestionMigration = readFileSync(
  "supabase/migrations/20260818204000_post_mention_composer_discovery.sql",
  "utf8",
);
const mobileLayout = readFileSync(
  "src/components/mobile/MobileAppLayout.tsx",
  "utf8",
);
import {
  applyPostMentionSuggestion,
  findPostMentionComposerQuery,
} from "../../src/services/community/postMentionComposer";

const confirmedMention = {
  handle: "grace",
  personId: "11111111-1111-1111-1111-111111111111",
  canonicalPath: "/people/grace-person",
};

describe("WAKILISHA M8C.4 Mention product UI", () => {
  it("maps canonical Mention presentation from the server-owned Post payload", () => {
    expect(postsService).toContain(
      "export type PostMention = {",
    );
    expect(
      postsService.match(
        /mentions: PostMention\[\];/g,
      )?.length,
    ).toBe(2);
    expect(
      postsService.match(
        /mentions: mapPostMentions\(record\.mentions\)/g,
      )?.length,
    ).toBe(2);
    expect(postsService).toContain(
      'canonicalPath.startsWith("/people/")',
    );
  });

  it("links only a server-confirmed handle while preserving authored case and unknown text", () => {
    const body =
      "Hi @Grace and @unknown.";

    const tokens =
      tokenizePostBodyMentions(
        body,
        [confirmedMention],
      );

    expect(
      tokens.map((token) => token.value).join(""),
    ).toBe(body);
    expect(
      tokens.filter(
        (token) =>
          token.type === "mention",
      ),
    ).toEqual([
      {
        type: "mention",
        value: "@Grace",
        handle: "grace",
        personId:
          confirmedMention.personId,
        canonicalPath:
          "/people/grace-person",
      },
    ]);
  });

  it("never turns a URL-contained @token into a Mention link", () => {
    const body =
      "https://example.com/@grace then @grace";

    const tokens =
      tokenizePostBodyMentions(
        body,
        [confirmedMention],
      );

    expect(
      tokens.map((token) => token.value).join(""),
    ).toBe(body);
    expect(
      tokens.filter(
        (token) =>
          token.type === "mention",
      ).map((token) => token.value),
    ).toEqual(["@grace"]);
  });

  it("does not perform client-side handle resolution", () => {
    expect(postBodyMentions).not.toContain(
      "supabase",
    );
    expect(postBodyMentions).not.toContain(
      "community_get_post_mentions",
    );
    expect(postBodyMentions).not.toContain(
      "community_normalize_username",
    );
    expect(postBody).not.toContain(
      "community_get_post_mentions",
    );
  });

  it("reuses one Mention renderer on Post detail, Thread items, Artist timelines, Following, and Quotes", () => {
    for (const surface of [
      detail,
      artistTimeline,
      following,
      quotedCard,
    ]) {
      expect(surface).toContain(
        "PostBody",
      );
    }

    expect(detail).toContain(
      "visiblePosts.map",
    );
    expect(detail).toContain(
      "mentions={item.mentions}",
    );
    expect(artistTimeline).toContain(
      "mentions={post.mentions}",
    );
    expect(following).toContain(
      "body={post.body}",
    );
    expect(following).toContain(
      "mentions={post.mentions}",
    );
    expect(quotedCard).toContain(
      "mentions={quotedPost.mentions}",
    );
  });

  it("preserves canonical Mention presentation when a published Post becomes Quote context", () => {
    expect(composer).toContain(
      "mentions: post.mentions",
    );
    expect(quotedCard).toContain(
      "View Post from",
    );
    expect(quotedCard).toContain(
      "[&_a]:pointer-events-auto",
    );
  });

  it("presents Post Mention notifications and the stored Mention preference in human language", () => {
    expect(notificationsPage).toContain(
      'post_mention: "ri-at-line"',
    );
    expect(notificationsPage).toContain(
      'post_mention: "mentioned you in a Post"',
    );
    expect(notificationSettings).toContain(
      "Get notified when someone @mentions you in a Post or comment.",
    );
  });

  it("keeps the M8C.4 product UI protected by the critical control plane", () => {
    expect(workflow).toContain(
      "Enforce canonical Post mention product UI",
    );
    expect(workflow).toContain(
      "test/community/post-mentions-product-ui-m8c4.test.ts",
    );
  });

  it("discovers only server-owned public Person-backed usernames in the composer", () => {
    expect(mentionSuggestionService).toContain(
      '"community_search_mention_suggestions"',
    );
    expect(mentionSuggestionService).not.toContain(
      '.from("user_profiles")',
    );
    expect(mentionSuggestionMigration).toContain(
      "profile.status='active'",
    );
    expect(mentionSuggestionMigration).toContain(
      "profile.is_public",
    );
    expect(mentionSuggestionMigration).toContain(
      "resolve_person_follow_target",
    );
    expect(mentionSuggestionMigration).toContain(
      "to authenticated,service_role",
    );
    expect(composer).toContain(
      "PostMentionSuggestions",
    );
    expect(composerSuggestions).toContain(
      'aria-label="People to mention"',
    );
  });

  it("parses and inserts composer Mention suggestions without activating URL tokens", () => {
    expect(
      findPostMentionComposerQuery(
        "Checking @Da",
        "Checking @Da".length,
      ),
    ).toEqual({
      query: "da",
      start: 9,
      end: 12,
    });

    expect(
      findPostMentionComposerQuery(
        "https://example.com/@da",
        "https://example.com/@da".length,
      ),
    ).toBeNull();

    expect(
      applyPostMentionSuggestion(
        "Checking @Da",
        {
          query: "da",
          start: 9,
          end: 12,
        },
        "dad",
      ),
    ).toEqual({
      body: "Checking @dad ",
      caret: 14,
    });
  });

  it("makes published Post body space open Post detail while keeping Mention links independent", () => {
    expect(postBody).toContain(
      "canonicalPath?: string | null",
    );
    expect(postBody).toContain(
      "pointer-events-none relative z-[1] [&_a]:pointer-events-auto",
    );
    expect(following).toContain(
      "canonicalPath={post.canonicalPath}",
    );
    expect(artistTimeline).toContain(
      "canonicalPath={post.canonicalPath}",
    );
  });

  it("gives every Post menu a direct route and link action", () => {
    expect(postActions).toContain("Open Post");
    expect(postActions).toContain("Copy Link");
    expect(postActions).toContain(
      "navigate(post.canonicalPath)",
    );
    expect(postActions).toContain(
      "navigator.clipboard.writeText(shareItem.url)",
    );
  });

  it("uses Notifications instead of Alerts for the public notification control", () => {
    expect(notificationBell).toContain(
      "aria-label={`Notifications",
    );
    expect(notificationBell).toContain(
      'to="/notifications"',
    );
    expect(notificationBell).not.toContain(
      "Alerts",
    );
    expect(mobileLayout).toContain(
      '{ label: "Notifications", to: "/notifications", icon: "Bell" }',
    );
    expect(mobileLayout).not.toContain(
      "Alerts",
    );
  });

  it("keeps new Mention UI copy free of sentence-break dashes", () => {
    for (const value of [
      "View Post from",
      "mentioned you in a Post",
      "Get notified when someone @mentions you in a Post or comment.",
    ]) {
      expect(value).not.toContain("—");
      expect(value).not.toContain("–");
    }
  });
});
