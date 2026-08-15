import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const postState =
  readFileSync(
    "src/hooks/usePostInteractionState.ts",
    "utf8",
  );

const postActions =
  readFileSync(
    "src/components/community/PostActions.tsx",
    "utf8",
  );

const personProfile =
  readFileSync(
    "src/pages/people/detail/page.tsx",
    "utf8",
  );

describe(
  "M8A browser acceptance repair",
  () => {
    it(
      "preserves Artist Update reaction compatibility",
      () => {
        expect(postState).toContain(
          'post.actor.type === "artist"',
        );
        expect(postState).toContain(
          '"artist_update"',
        );
        expect(postState).toContain(
          "reactionTargetType(post)",
        );
      },
    );

    it(
      "does not loop hydration on posts array identity",
      () => {
        expect(postState).toContain(
          "[postKey, user.loading, user.id]",
        );
        expect(postState).not.toContain(
          "[postKey, posts, user.loading, user.id]",
        );
      },
    );

    it(
      "keeps React visible before hydrated counts arrive",
      () => {
        expect(postActions).toContain(
          "{onReact && (",
        );
        expect(postActions).not.toContain(
          "{reactionState && onReact && (",
        );
      },
    );

    it(
      "presents the existing owner-only save library as Bookmarks",
      () => {
        expect(personProfile).toContain(
          'label: "Bookmarks"',
        );
        expect(personProfile).toContain(
          "Your bookmarks",
        );
        expect(personProfile).toContain(
          "getUserSaves",
        );
        expect(personProfile).toContain(
          "isOwner",
        );
        expect(personProfile).toContain(
          'post: "Post"',
        );
        expect(personProfile).toContain(
          'artist_update: "Post"',
        );
      },
    );
  },
);
