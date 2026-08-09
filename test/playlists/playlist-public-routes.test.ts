import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

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

const collection =
  readFileSync(
    "src/pages/playlists/page.tsx",
    "utf8",
  );

const detail =
  readFileSync(
    "src/pages/playlists/detail/page.tsx",
    "utf8",
  );

describe(
  "Phase 5B public Playlist routes",
  () => {
    it(
      "ships stable public collection and detail routes",
      () => {
        expect(router)
          .toContain(
            'path: "/playlists"',
          );

        expect(router)
          .toContain(
            'path: "/playlists/:slug"',
          );

        expect(lazyPublic)
          .toContain(
            "PublicPlaylistsPage",
          );

        expect(lazyPublic)
          .toContain(
            "PublicPlaylistDetailPage",
          );
      },
    );

    it(
      "reads only through the public Playlist service",
      () => {
        expect(collection)
          .toContain(
            "listPublicPlaylists",
          );

        expect(detail)
          .toContain(
            "getPublicPlaylist",
          );

        expect(collection)
          .not.toContain(
            "editorial.",
          );

        expect(detail)
          .not.toContain(
            "editorial.",
          );
      },
    );

    it(
      "feeds the canonical global player",
      () => {
        expect(detail)
          .toContain(
            "usePlayer",
          );

        expect(detail)
          .toContain(
            "toPlayerQueue",
          );

        expect(detail)
          .toContain(
            "playTrack(",
          );

        expect(detail)
          .toContain(
            'pageType:\n            "playlist"',
          );

        expect(detail)
          .not.toContain(
            "<audio",
          );
      },
    );

    it(
      "uses the existing WAKILISHA public design grammar",
      () => {
        expect(collection)
          .toContain(
            'className="wk-eyebrow"',
          );

        expect(collection)
          .toContain(
            'className="wk-h-page mt-4"',
          );

        expect(detail)
          .toContain(
            "wk-container-wide",
          );

        expect(detail)
          .toContain(
            "font-[var(--wk-font-display)]",
          );

        expect(detail)
          .toContain(
            "<WkButton",
          );

        expect(detail)
          .toContain(
            "<ShareButton",
          );

        expect(detail)
          .toContain(
            "WkButton",
          );

        expect(detail)
          .toContain(
            "WkIcon",
          );

        expect(detail)
          .toContain(
            "ShareButton",
          );

        expect(detail)
          .toContain(
            "Ch19GradientImage",
          );

        expect(detail)
          .not.toContain(
            "Tracklist",
          );

        expect(detail)
          .toContain(
            'label="Jump to track"',
          );
      },
    );

    it(
      "does not expose implementation or publication mechanics as product UI",
      () => {
        expect(detail)
          .not.toContain(
            "providerLabel",
          );

        expect(detail)
          .not.toContain(
            "WAKILISHA + Apple Music",
          );

        expect(detail)
          .not.toContain(
            "Published edition",
          );

        expect(detail)
          .not.toContain(
            ">References<",
          );

        expect(detail)
          .not.toContain(
            ">Corrections<",
          );

        expect(detail)
          .not.toContain(
            "Not published.",
          );

        expect(detail)
          .toContain(
            "Playlist not found",
          );
      },
    );

    it(
      "keeps the public Playlist curatorial content visible",
      () => {
        expect(detail)
          .toContain(
            "playlist.curatorLabel",
          );

        expect(detail)
          .toContain(
            "playlist.description",
          );

        expect(detail)
          .toContain(
            "track.notes",
          );

        expect(detail)
          .not.toContain(
            "Editor's note",
          );

        expect(detail)
          .not.toContain(
            "More about this track",
          );

        expect(detail)
          .toContain(
            "Jump to",
          );

        expect(detail)
          .toContain(
            "CommunitySection",
          );

        expect(detail)
          .toContain(
            "ContextAnchorCommentDrawer",
          );

        expect(detail)
          .toContain(
            "AnchorNavigator",
          );

        expect(detail)
          .toContain(
            "SchemaOrg",
          );

        expect(detail)
          .toContain(
            'type="music.playlist"',
          );
      },
    );
  },
);
