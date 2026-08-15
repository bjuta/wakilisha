import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const appLayout =
  readFileSync(
    "src/components/layout/AppLayout.tsx",
    "utf8",
  );

const desktopShell =
  readFileSync(
    "src/components/music/MusicDesktopShell.tsx",
    "utf8",
  );

const following =
  readFileSync(
    "src/pages/following/page.tsx",
    "utf8",
  );

describe(
  "global desktop shell and universal Post parity",
  () => {
    it(
      "makes the sidebar shell the default desktop AppLayout",
      () => {
        expect(appLayout).toContain(
          "<MusicDesktopShell>",
        );

        expect(appLayout).not.toContain(
          "AppTopBar",
        );

        expect(appLayout).not.toContain(
          "<footer",
        );

        expect(appLayout).not.toContain(
          "FOOTER_DISCOVER",
        );
      },
    );

    it(
      "keeps only special-purpose public routes shellless",
      () => {
        expect(appLayout).toContain(
          'pathname === "/auth"',
        );

        expect(appLayout).toContain(
          'pathname.startsWith("/preview/")',
        );

        expect(appLayout).toContain(
          '"/lyrics/contribute"',
        );

        expect(appLayout).not.toContain(
          '"/manage"',
        );
      },
    );

    it(
      "maps the root Magazine route to Posts navigation",
      () => {
        expect(desktopShell).toContain(
          'if (pathname === "/")',
        );

        expect(desktopShell).toContain(
          'return "posts";',
        );
      },
    );

    it(
      "uses the same PostActions contract in Following",
      () => {
        expect(following).toContain(
          "PostActions",
        );

        expect(following).toContain(
          "usePostInteractionState",
        );

        expect(following).toContain(
          "postInteraction.savedPostIds",
        );

        expect(following).toContain(
          "postInteraction.reactionStates",
        );

        expect(following).toContain(
          "postInteraction.followedActorKeys",
        );

        expect(following).toContain(
          "postInteraction.manageableActorKeys",
        );

        expect(following).toContain(
          "postInteraction.toggleSave",
        );

        expect(following).toContain(
          "postInteraction.toggleReaction",
        );

        expect(following).toContain(
          "postInteraction.toggleFollow",
        );

        expect(following).toContain(
          "onPostWithdrawn",
        );
      },
    );

    it(
      "keeps specialized action controls for non-Post activity",
      () => {
        expect(following).toContain(
          "{post ? (",
        );

        expect(following).toContain(
          "<FollowingShareAction",
        );

        expect(following).toContain(
          "<FollowingReactionAction",
        );
      },
    );

    it(
      "removes the old reduced Post navigation treatment",
      () => {
        expect(following).not.toContain(
          "View Post",
        );

        expect(following).not.toContain(
          "View Update",
        );
      },
    );
  },
);
