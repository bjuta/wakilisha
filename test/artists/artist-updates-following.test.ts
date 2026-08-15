import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const migration =
  readFileSync(
    "docs/engineering/replay-baseline/legacy-migrations/20260814174000_artist_updates_following.sql",
    "utf8",
  );

const managePage =
  readFileSync(
    "src/pages/artists/manage/page.tsx",
    "utf8",
  );

const authorityPanel =
  readFileSync(
    "src/pages/artists/detail/components/ArtistAuthorityPanel.tsx",
    "utf8",
  );

const artistImageField =
  readFileSync(
    "src/components/artists/ArtistImageField.tsx",
    "utf8",
  );

const artistPostComposer =
  readFileSync(
    "src/components/artists/ArtistPostComposer.tsx",
    "utf8",
  );

const updateService =
  readFileSync(
    "src/services/artists/artistUpdates.ts",
    "utf8",
  );

const followingFeed =
  readFileSync(
    "src/services/community/followingFeed.ts",
    "utf8",
  );

const followingPage =
  readFileSync(
    "src/pages/following/page.tsx",
    "utf8",
  );

const artistUpdatePage =
  readFileSync(
    "src/pages/artists/update/page.tsx",
    "utf8",
  );

const communityTypes =
  readFileSync(
    "src/services/community/types.ts",
    "utf8",
  );

const communityService =
  readFileSync(
    "src/services/community/service.ts",
    "utf8",
  );

const shareSheet =
  readFileSync(
    "src/components/design-system/share/ShareSheet.tsx",
    "utf8",
  );

const router =
  readFileSync(
    "src/router/config.tsx",
    "utf8",
  );

const lazyPublic =
  readFileSync(
    "src/router/lazyPublic.tsx",
    "utf8",
  );

const packageJson =
  readFileSync(
    "package.json",
    "utf8",
  );

describe(
  "Artist Updates -> Following",
  () => {
    it(
      "uses M2 can_post_updates as the only Artist Update write authority",
      () => {
        expect(
          migration,
        ).toContain(
          "can_post_updates",
        );
        expect(
          migration,
        ).toContain(
          "insufficient_artist_update_privilege",
        );
        expect(
          migration,
        ).toContain(
          "artist_update_published",
        );
        expect(
          migration,
        ).toContain(
          "artist_update_edited",
        );
        expect(
          migration,
        ).toContain(
          "artist_update_withdrawn",
        );

        expect(
          migration,
        ).not.toMatch(
          /(insert\s+into|update|delete\s+from)\s+public\.registry_artists\b/i,
        );
      },
    );

    it(
      "keeps Artist Updates as authored output instead of pretending Registry Releases were posted",
      () => {
        expect(
          migration,
        ).toContain(
          "'artist_update'::text as item_type",
        );
        expect(
          migration,
        ).toContain(
          "'release'::text as item_type",
        );
        expect(
          migration,
        ).toContain(
          "artist_raw_outputs",
        );
        expect(
          migration,
        ).toContain(
          "partition by candidate.reason_target_id",
        );

        expect(
          followingFeed,
        ).toContain(
          '| "artist_update"',
        );
        expect(
          followingPage,
        ).toContain(
          'return "Artist Update";',
        );
      },
    );

    it(
      "shares the existing three-output Artist limit across Releases and Updates",
      () => {
        expect(
          migration,
        ).toContain(
          "ranked.output_rank <= 3",
        );
        expect(
          migration,
        ).toContain(
          "artist_ranked",
        );
        expect(
          migration,
        ).toContain(
          "per_subject_recent_limit', 3",
        );
      },
    );

    it(
      "makes Artist Posts a shared-composer timeline across profile and Studio",
      () => {
        expect(
          authorityPanel,
        ).toContain(
          "ArtistPostComposer",
        );
        expect(
          authorityPanel,
        ).not.toContain(
          "publishArtistUpdate",
        );

        expect(
          artistPostComposer,
        ).toContain(
          "Share an update from",
        );
        expect(
          artistPostComposer,
        ).toContain(
          "Create Post",
        );
        expect(
          artistPostComposer,
        ).toContain(
          "publishArtistUpdate",
        );
        expect(
          artistPostComposer,
        ).toContain(
          "editArtistUpdate",
        );
        expect(
          artistPostComposer,
        ).toContain(
          "ArtistImageField",
        );

        expect(
          managePage,
        ).toContain(
          'id="artist-posts"',
        );
        expect(
          managePage,
        ).toContain(
          'label="Posts"',
        );
        expect(
          managePage,
        ).toContain(
          'studioSection === "posts"',
        );
        expect(
          managePage,
        ).toContain(
          "ArtistPostComposer",
        );
        expect(
          managePage,
        ).toContain(
          "No posts yet",
        );
        expect(
          managePage,
        ).toContain(
          "Official Artist",
        );
        expect(
          managePage,
        ).toContain(
          "withdrawArtistUpdate",
        );
        expect(
          managePage,
        ).not.toContain(
          'label="Content"',
        );
        expect(
          managePage,
        ).not.toContain(
          "Recent Updates",
        );
        expect(
          artistImageField,
        ).toContain(
          "Choose From Your Media",
        );
      },
    );

    it(
      "makes published Artist Updates first-class Save and Reaction targets",
      () => {
        expect(
          migration,
        ).toContain(
          "community_saves_entity_type_capability_check",
        );
        expect(
          migration,
        ).toContain(
          "'artist_update'::text",
        );
        expect(
          migration,
        ).toContain(
          "community_get_reaction_state_for_public_targets",
        );
        expect(
          migration,
        ).toContain(
          "Reaction target is not currently public",
        );

        expect(
          communityTypes,
        ).toContain(
          "| 'artist_update'",
        );
        expect(
          communityService,
        ).toContain(
          "value === 'artist_update'",
        );
      },
    );

    it(
      "gives each published update a canonical deep link and unified share identity",
      () => {
        expect(
          router,
        ).toContain(
          '"/artists/:slug/updates/:updateId"',
        );
        expect(
          lazyPublic,
        ).toContain(
          "ArtistUpdatePage",
        );
        expect(
          updateService,
        ).toContain(
          "community_get_artist_update",
        );
        expect(
          shareSheet,
        ).toContain(
          '"artist_update"',
        );
        expect(
          shareSheet,
        ).toContain(
          'parts[2] === "updates"',
        );
      },
    );

    it(
      "keeps Following actor-led and renders Update body without fabricating a headline",
      () => {
        expect(
          followingPage,
        ).toContain(
          'item.itemType === "artist_update"',
        );
        expect(
          followingPage,
        ).toContain(
          "{item.summary}",
        );
        expect(
          followingPage,
        ).toContain(
          "View Update",
        );
      },
    );

    it(
      "keeps M4 in the critical suite and public copy free of em dashes",
      () => {
        expect(
          packageJson,
        ).toContain(
          "test/artists/artist-updates-following.test.ts",
        );

        for (
          const source of [
            managePage,
            authorityPanel,
            artistImageField,
            artistPostComposer,
            followingPage,
            artistUpdatePage,
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
