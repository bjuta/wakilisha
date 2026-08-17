import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260816083408_community_social_graph_m8b_read_surfaces.sql",
  "utf8",
);

const verifier = readFileSync(
  "scripts/control-plane/verify-community-social-graph-m8b-read-surfaces.sql",
  "utf8",
);

const posts = readFileSync(
  "src/services/community/posts.ts",
  "utf8",
);

const following = readFileSync(
  "src/services/community/followingFeed.ts",
  "utf8",
);

const followingPage = readFileSync(
  "src/pages/following/page.tsx",
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

const quotedCard = readFileSync(
  "src/components/community/QuotedPostCard.tsx",
  "utf8",
);

const communityTypes = readFileSync(
  "src/services/community/types.ts",
  "utf8",
);

describe(
  "WAKILISHA M8B-M2 social graph read surfaces",
  () => {
    it(
      "keeps Quote Post linkage immutable after publication",
      () => {
        expect(
          migration,
        ).toContain(
          "trg_community_posts_quoted_post_immutable",
        );

        expect(
          migration,
        ).toContain(
          "quoted_post_link_is_immutable",
        );
      },
    );

    it(
      "returns an unavailable Quote state instead of erasing the Quote Post",
      () => {
        expect(
          migration,
        ).toContain(
          "'quoted_post_id',v_post.quoted_post_id",
        );

        expect(
          migration,
        ).toContain(
          "'available',false",
        );

        expect(
          posts,
        ).toContain(
          "CommunityQuotedPost",
        );

        expect(
          quotedCard,
        ).toContain(
          "The original Post is unavailable.",
        );

        expect(
          quotedCard,
        ).not.toContain(
          "This Post is no longer available.",
        );
      },
    );

    it(
      "redacts quoted Post context when the viewer has blocked its actor",
      () => {
        expect(
          migration,
        ).toContain(
          "auth.uid() is not null",
        );

        expect(
          migration,
        ).toContain(
          "v_quoted.person_resource_id::text",
        );

        expect(
          migration,
        ).toContain(
          "v_quoted.artist_id::text",
        );

        expect(
          migration,
        ).toContain(
          "'unavailable_reason','blocked'",
        );

        expect(
          quotedCard,
        ).toContain(
          "You blocked this Artist. Unblock them to view the original Post.",
        );

        expect(
          quotedCard,
        ).toContain(
          "The original Post is unavailable.",
        );

        expect(
          quotedCard,
        ).not.toContain(
          "This Post is no longer available.",
        );
      },
    );

    it(
      "preserves the mature social feed as a private layer",
      () => {
        expect(
          migration,
        ).toContain(
          "rename to community_get_social_feed_legacy_m8b",
        );

        expect(
          migration,
        ).toContain(
          "revoke all on function public.community_get_social_feed_legacy_m8b",
        );

        expect(
          verifier,
        ).toContain(
          "Legacy social feed remains directly executable",
        );
      },
    );

    it(
      "models Repost as Post content with a distinct activity key",
      () => {
        expect(
          migration,
        ).toContain(
          "'repost:'||repost.id::text as item_key",
        );

        expect(
          migration,
        ).toContain(
          "repost.post_id::text as item_id",
        );

        expect(
          migration,
        ).toContain(
          "'repost_actor',page.repost_actor",
        );

        expect(
          following,
        ).toContain(
          "repostActor: PostActor | null",
        );

        expect(
          followingPage,
        ).toContain(
          'return "Repost";',
        );
      },
    );

    it(
      "filters feed Post content through the viewer Block graph",
      () => {
        expect(
          migration,
        ).toContain(
          "private.community_is_blocked_target",
        );

        expect(
          migration,
        ).toContain(
          "base_filtered",
        );

        expect(
          migration,
        ).toContain(
          "post_payload.value->'actor'->>'id'",
        );
      },
    );

    it(
      "hydrates canonical Post payloads instead of reconstructing Reposts as new Posts",
      () => {
        expect(
          migration,
        ).toContain(
          "public.community_get_post(",
        );

        expect(
          following,
        ).toContain(
          "mapCommunityPost",
        );

        expect(
          followingPage,
        ).toContain(
          "if (item.post)",
        );

        expect(
          followingPage,
        ).toContain(
          "return item.post;",
        );
      },
    );

    it(
      "ships typed Repost, Quote, Block, and Post Report client commands",
      () => {
        for (
          const token of [
            "quotePost",
            "setPostRepostState",
            "getActorRepostState",
            "setBlockState",
            "getBlockState",
            "reportPost",
          ]
        ) {
          expect(
            posts,
          ).toContain(
            token,
          );
        }
      },
    );

    it(
      "shows Quote context on every shared Post presentation surface",
      () => {
        expect(
          detail,
        ).toContain(
          "QuotedPostCard",
        );

        expect(
          artistTimeline,
        ).toContain(
          "QuotedPostCard",
        );

        expect(
          followingPage,
        ).toContain(
          "QuotedPostCard",
        );
      },
    );

    it(
      "extends the existing Report type instead of creating another moderation type",
      () => {
        expect(
          communityTypes,
        ).toContain(
          "postId: string | null",
        );

        expect(
          migration,
        ).not.toContain(
          "create table public.community_post_reports",
        );
      },
    );

    it(
      "keeps M8B-M2 runtime source free of em and en dashes",
      () => {
        for (
          const source of [
            migration,
            verifier,
            posts,
            following,
            followingPage,
            detail,
            artistTimeline,
            quotedCard,
          ]
        ) {
          expect(
            source,
          ).not.toContain(
            "—",
          );

          expect(
            source,
          ).not.toContain(
            "–",
          );
        }
      },
    );
  },
);
