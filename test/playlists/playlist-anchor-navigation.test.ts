import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const navigator =
  readFileSync(
    "src/components/design-system/navigation/AnchorNavigator.tsx",
    "utf8",
  );

const detail =
  readFileSync(
    "src/pages/playlists/detail/page.tsx",
    "utf8",
  );

describe(
  "WAKILISHA shared anchor navigation",
  () => {
    it(
      "uses a reusable searchable navigator instead of native select chrome",
      () => {
        expect(detail)
          .toContain(
            "<AnchorNavigator",
          );

        expect(detail)
          .not.toContain(
            "<select",
          );

        expect(navigator)
          .toContain(
            'placeholder="Find by title, artist, or number"',
          );

        expect(navigator)
          .toContain(
            '"ArrowDown"',
          );

        expect(navigator)
          .toContain(
            '"ArrowUp"',
          );

        expect(navigator)
          .toContain(
            '"Enter"',
          );

        expect(navigator)
          .toContain(
            '"Escape"',
          );
      },
    );

    it(
      "removes the repetitive Playlist track-count header",
      () => {
        expect(detail)
          .not.toContain(
            "Choose a track",
          );

        expect(detail)
          .toContain(
            'label="Jump to track"',
          );
      },
    );

    it(
      "keeps stable resource-backed anchors",
      () => {
        expect(detail)
          .toContain(
            "track.playlistItemResourceId",
          );

        expect(detail)
          .toContain(
            "window.location.hash",
          );

        expect(detail)
          .toContain(
            "window.history.replaceState",
          );
      },
    );
  },
);
