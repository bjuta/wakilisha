import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const detail =
  readFileSync(
    "src/pages/playlists/detail/page.tsx",
    "utf8",
  );

const meta =
  readFileSync(
    "src/components/seo/MetaTags.tsx",
    "utf8",
  );

const schema =
  readFileSync(
    "src/components/seo/SchemaOrg.tsx",
    "utf8",
  );

const pageTitle =
  readFileSync(
    "src/components/seo/PageTitle.tsx",
    "utf8",
  );

const share =
  readFileSync(
    "src/components/design-system/share/ShareSheet.tsx",
    "utf8",
  );

describe(
  "Phase 5B Playlist SEO and sharing",
  () => {
    it(
      "publishes Playlist-specific Open Graph metadata",
      () => {
        expect(meta)
          .toContain(
            '"music.playlist"',
          );

        expect(detail)
          .toContain(
            'type="music.playlist"',
          );

        expect(pageTitle)
          .toContain(
            'ogType:\n        "music.playlist"',
          );
      },
    );

    it(
      "keeps Playlist sharing canonical and the hero Share legible",
      () => {
        expect(detail)
          .toContain(
            "shareBaseUrl",
          );

        expect(detail)
          .toContain(
            "canonicalUrl",
          );

        expect(detail)
          .toContain(
            "[--wk-text:#ffffff]",
          );

        expect(detail)
          .toContain(
            "[--wk-border-2:rgba(255,255,255,0.34)]",
          );
      },
    );

    it(
      "publishes MusicPlaylist structured data",
      () => {
        expect(schema)
          .toContain(
            'export interface MusicPlaylistSchema',
          );

        expect(schema)
          .toContain(
            'case "MusicPlaylist"',
          );

        expect(detail)
          .toContain(
            '"@type":\n            "MusicPlaylist"',
          );

        expect(detail)
          .toContain(
            '"MusicRecording" as const',
          );

        expect(detail)
          .toContain(
            "playlist.itemCount",
          );
      },
    );

    it(
      "keeps Playlist canonical authority at the Playlist URL",
      () => {
        expect(pageTitle)
          .toContain(
            '"/playlists"',
          );

        expect(pageTitle)
          .toContain(
            'section === "playlists"',
          );

        expect(detail)
          .toContain(
            "canonicalUrl",
          );
      },
    );

    it(
      "shares individual Playlist placements through their stable anchors",
      () => {
        expect(detail)
          .toContain(
            'label="Share"',
          );

        expect(detail)
          .toContain(
            '`${shareBaseUrl}#${trackAnchorId(',
          );

        expect(detail)
          .toMatch(
            /shareUrl=\{\s*`\$\{shareBaseUrl\}#\$\{trackAnchorId\(/,
          );

        expect(detail)
          .toContain(
            "window.location.pathname",
          );

        expect(share)
          .toContain(
            'first === "playlists"',
          );

        expect(share)
          .toContain(
            '"playlist_track"',
          );
      },
    );
  },
);
