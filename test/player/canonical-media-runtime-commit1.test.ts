import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const seekRail = readFileSync(
  "src/components/design-system/player/SeekRail.tsx",
  "utf8",
);
const compact = readFileSync(
  "src/components/design-system/player/PlayerCompactSurface.tsx",
  "utf8",
);
const full = readFileSync(
  "src/components/design-system/player/PlayerFullSurface.tsx",
  "utf8",
);
const responsive = readFileSync(
  "src/components/mobile/ResponsiveAppLayout.tsx",
  "utf8",
);
const mobileLayout = readFileSync(
  "src/components/mobile/MobileAppLayout.tsx",
  "utf8",
);
const playerContext = readFileSync(
  "src/context/PlayerContext.tsx",
  "utf8",
);
const artistChart = readFileSync(
  "src/pages/artists/detail/components/ArtistChartSection.tsx",
  "utf8",
);
const music = readFileSync(
  "src/pages/music/page.tsx",
  "utf8",
);

describe(
  "canonical media runtime Commit 1",
  () => {
    it(
      "uses one interactive seek primitive across compact and expanded playback",
      () => {
        expect(seekRail).toContain(
          'role="slider"',
        );
        expect(seekRail).toContain(
          "setPointerCapture",
        );
        expect(seekRail).toContain(
          'event.key === "ArrowLeft"',
        );
        expect(
          compact.match(/<SeekRail/g) ?? [],
        ).toHaveLength(2);
        expect(full).toContain(
          "<SeekRail",
        );
        expect(full).not.toContain(
          'type="range"\n                  min={0}\n                  max={Math.max(1, duration || 1)}',
        );
      },
    );

    it(
      "keeps Lyrics inside the player until contribution is explicitly chosen",
      () => {
        expect(full).toContain(
          'label="Lyrics"',
        );
        expect(full).toContain(
          'panel === "lyrics"',
        );
        expect(full).toContain(
          'emptyMessage="No published Lyrics are available for this Track yet."',
        );
        expect(full).toContain(
          "Contribute Lyrics",
        );
        expect(full).not.toContain(
          'else if (lyricsContributionPath) {\n                        goTo(lyricsContributionPath);',
        );
      },
    );

    it(
      "keeps one active mobile player owner",
      () => {
        expect(responsive).toContain(
          'PlayerCompactSurface mode="mobile"',
        );
        expect(responsive).toContain(
          "<PlayerFullSurface",
        );
        expect(mobileLayout).not.toContain(
          "MobileMiniPlayer",
        );
        expect(mobileLayout).not.toContain(
          "MobileFullPlayer",
        );
      },
    );

    it(
      "retains the mobile navigation scroll-lock hook while removing duplicate player ownership",
      () => {
        expect(mobileLayout).toContain(
          'import { useScrollLock } from "@/hooks/useScrollLock";',
        );
        expect(mobileLayout).toContain(
          "useScrollLock(moreOpen);",
        );
      },
    );

    it(
      "uses canonical Track identity and preserves explicit collection listening intent",
      () => {
        expect(playerContext).toContain(
          "playerTrackIdentity",
        );
        expect(
          playerContext.match(
            /playerTrackIdentity\(\s*currentTrackRef\.current,?\s*\)/g,
          )?.length ?? 0,
        ).toBeGreaterThanOrEqual(2);
        expect(playerContext).toContain(
          "continuousCollectionRef",
        );
        expect(playerContext).toContain(
          '"release"',
        );
        expect(playerContext).toContain(
          '"playlist"',
        );
        expect(playerContext).toContain(
          '"chart_edition"',
        );
        expect(playerContext).toContain(
          "isPlayable === false",
        );
      },
    );

    it(
      "resolves Artist chart playback through the canonical public Track contract",
      () => {
        expect(artistChart).toContain(
          'getTrack } from "@/services/publicApi/client"',
        );
        expect(artistChart).toContain(
          "registryTrackId",
        );
        expect(artistChart).toContain(
          '"WAKILISHA Registry"',
        );
        expect(artistChart).not.toContain(
          "const trackId = trackSlug;",
        );
      },
    );

    it(
      "uses canonical Release identity and the shared Share surface on Music",
      () => {
        expect(playerContext).toContain(
          "releaseId?: string",
        );
        expect(music).toContain(
          "activeReleaseId",
        );
        expect(music).toContain(
          "releaseId:",
        );
        expect(music).toContain(
          "<ShareSheet",
        );
        expect(music).not.toContain(
          "navigator.clipboard?.writeText",
        );
      },
    );
  },
);
