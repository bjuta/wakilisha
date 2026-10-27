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
const artistTopSongs = readFileSync(
  "src/pages/artists/detail/components/ArtistTopSongs.tsx",
  "utf8",
);
const albumModal = readFileSync(
  "src/components/design-system/releases/AlbumModal.tsx",
  "utf8",
);
const releaseTracklist = readFileSync(
  "src/pages/releases/detail/components/ReleaseTracklist.tsx",
  "utf8",
);
const mobileRelease = readFileSync(
  "src/pages/mobile/releases/detail/page.tsx",
  "utf8",
);
const trackReleaseTracklist = readFileSync(
  "src/pages/tracks/detail/components/TrackReleaseTracklist.tsx",
  "utf8",
);
const articleRelease = readFileSync(
  "src/pages/magazine/article/components/ArticleReleaseEmbeds.tsx",
  "utf8",
);
const playbackSettings = readFileSync(
  "src/hooks/useUserSettings.ts",
  "utf8",
);
const playbackControls = readFileSync(
  "src/components/design-system/player/PlaybackControls.tsx",
  "utf8",
);
const trackDetail = readFileSync(
  "src/pages/tracks/detail/page.tsx",
  "utf8",
);
const dock = readFileSync(
  "src/components/design-system/music/PlayerDock.tsx",
  "utf8",
);
const accountSync = readFileSync(
  "src/services/player/playbackAccountSync.ts",
  "utf8",
);

describe("Chapter 25 audible-media and device-independent icon acceptance", () => {
  it("routes native play first and has two independent provider-audio recovery paths", () => {
    const play = playerContext.indexOf("await activeAudio.play()");
    const mix = playerContext.indexOf("mixEngineRef.current.prepare(activeAudio, source)");
    expect(play).toBeGreaterThan(-1);
    expect(mix).toBeGreaterThan(play);
    expect(playerContext).toContain('failedMixSourcesRef.current.add(source.url)');
    expect(playerContext).toContain("hasAudioSignal(activeAudio)");
    expect(playerContext).toContain("activeAudio.currentSrc === expectedMixUrl");
    expect(playerContext).not.toContain('activeAudio.currentSrc.includes("/__wk-mix/") &&');
    expect(playerContext).toContain("fallback.src = track.previewUrl!");
  });
  it("displays one compact, collapsible mode instead of a contradictory gapless toggle", () => {
    expect(playbackControls).toContain("TransitionDisclosure");
    expect(playbackControls).toContain('aria-expanded={expanded}');
    expect(playbackControls).toContain('"off", label: "Off"');
    expect(playbackControls).toContain('"crossfade", label: "Crossfade"');
    expect(playbackControls).toContain('"smart", label: "Smart Mix"');
    expect(playbackControls).not.toContain('label="Keep albums gapless"');
  });
  it("uses the bundled SVG sprite for formerly emoji-prone external-link arrows", () => {
    for (const file of ["src/pages/video/page.tsx", "src/pages/shows/page.tsx", "src/pages/audio/page.tsx"]) {
      const view = readFileSync(file, "utf8");
      expect(view).toContain('name="ArrowUpRight"');
      expect(view).not.toContain("↗");
    }
  });
});

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
        ).toHaveLength(3);
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
        // The full player is code-split, not eagerly mounted by the shell.
        expect(responsive).toContain(
          '"@/components/design-system/player/PlayerFullSurface"',
        );
        expect(responsive).toContain(
          '<LazyPlayerFullSurface mode={isMobile ? "mobile" : "desktop"}',
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
      "locks the single Workbook navigation drawer without duplicate player ownership",
      () => {
        const drawer = readFileSync(
          "src/components/mobile/MobileAccountDrawer.tsx",
          "utf8",
        );
        expect(drawer).toContain("useScrollLock(open)");
        expect(drawer).toContain("navigation.map");
        expect(mobileLayout).not.toContain("MobileBottomNav");
        expect(mobileLayout).not.toContain("useScrollLock(moreOpen)");
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
      "continues ordered collection playback and respects the listening preference",
      () => {
        expect(artistTopSongs).toContain(
          "songs.map((song) => topSongQueueTrack(song, artistSlug))",
        );
        expect(artistTopSongs).toContain("playTrack(selected, queue, {");
        expect(albumModal).toContain("playTrack(selected, queueTracks, {");
        expect(albumModal).not.toContain("const remainingTracks =");
        expect(releaseTracklist).toContain("playTrack(selected, queueTracks, {");
        expect(mobileRelease).toContain("playTrack(selected, queue, {");
        expect(trackReleaseTracklist).toContain("playTrack(selected, queueTracks, {");
        expect(trackDetail).toContain("inRelease ? releaseQueue : [playerTrack]");
        expect(articleRelease).toContain("playTrack(playerTrack, [playerTrack],");
        expect(artistTopSongs).toContain("sourceSection: \"top_songs_expanded\"");
        expect(playerContext).toContain('if (!playbackPrefs.autoplay && repeatMode !== "all") {');
        expect(playbackSettings).toContain("autoplay: true,");
        expect(playbackSettings).toContain("crossfade: false,");
        expect(playbackSettings).toContain("crossfadeSeconds: 6,");
        expect(playbackControls).toContain("TransitionDisclosure");
        expect(playbackControls).toContain("Smart Mix");
        expect(playbackControls).toContain("Queue");
        expect(playbackControls).not.toContain("label=\"Keep albums gapless\"");
        expect(playbackControls).toContain("<WkSlider");
        expect(playerContext).toContain("Play starts the collection again.");
        expect(full).toContain("<PlaybackMoreControls");
        expect(full).toContain("Not available for YouTube");
        expect(compact).toContain('openFullPlayer("more")');
        expect(dock).toContain("<PlaybackMoreControls");
        expect(full).toContain('label: "Go to Release"');
        expect(full).toContain('label: "Credits"');
        expect(playerContext).toContain("releasePath?: string");
        expect(accountSync).toContain('session?.user?.id !== expectedUser');
        expect(accountSync).toContain('existingOwner !== accountId');
        expect(accountSync).toContain('delete existing.appleMusicToken');
      },
    );

    it(
      "keeps the Track hero compact and responsive",
      () => {
        expect(trackDetail).toContain('h-[232px] w-[232px]');
        expect(trackDetail).toContain('px-5 pb-6 pt-12 sm:px-6 md:py-10');
        expect(trackDetail).toContain('md:h-[260px] md:w-[260px]');
        expect(trackDetail).toContain('overflowWrap: "anywhere"');
        expect(trackDetail).toContain('canonicalTrackUrl(');
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
