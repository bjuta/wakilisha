import {
  describe,
  expect,
  it,
} from "vitest";
import fs from "node:fs";

const player =
  fs.readFileSync(
    "src/context/PlayerContext.tsx",
    "utf8",
  );

const youtube =
  fs.readFileSync(
    "src/services/player/youtubePlayback.ts",
    "utf8",
  );

const soundcloud =
  fs.readFileSync(
    "src/services/player/soundCloudPlayback.ts",
    "utf8",
  );

const canvas =
  fs.readFileSync(
    "src/components/design-system/music/ProviderPlaybackCanvas.tsx",
    "utf8",
  );

const canvasCss =
  fs.readFileSync(
    "src/components/design-system/music/ProviderPlaybackCanvas.css",
    "utf8",
  );

const dock =
  fs.readFileSync(
    "src/components/design-system/music/PlayerDock.tsx",
    "utf8",
  );

const desktop =
  fs.readFileSync(
    "src/pages/player/page.tsx",
    "utf8",
  );

const mobile =
  fs.readFileSync(
    "src/components/mobile/MobileFullPlayer.tsx",
    "utf8",
  );

const history =
  fs.readFileSync(
    "src/services/listeningHistory.ts",
    "utf8",
  );

describe(
  "Phase 5B global provider playback",
  () => {
    it(
      "keeps YouTube inside the existing global player",
      () => {
        expect(player)
          .toContain(
            'playbackBackendRef.current = "youtube"',
          );

        expect(player)
          .toContain(
            "playYouTubeTrack(",
          );

        expect(player)
          .toContain(
            "handleEndedRef.current()",
          );

        expect(player)
          .toContain(
            "ProviderPlaybackCanvas",
          );

        expect(youtube)
          .toContain(
            "https://www.youtube.com/iframe_api",
          );

        expect(youtube)
          .toContain(
            "loadVideoById",
          );

        expect(youtube)
          .toContain(
            "activePlayer.loadVideoById(",
          );

        expect(youtube)
          .toContain(
            "pauseVideo",
          );

        expect(youtube)
          .toContain(
            "seekTo",
          );

        expect(youtube)
          .toContain(
            "setVolume",
          );
      },
    );

    it(
      "keeps the YouTube viewport visibly compliant",
      () => {
        expect(canvas)
          .toContain(
            "wk-youtube-player-target",
          );

        expect(canvasCss)
          .toContain(
            "min-width: 200px",
          );

        expect(canvasCss)
          .toContain(
            "min-height: 200px",
          );

        expect(canvasCss)
          .not.toContain(
            "width: 1px",
          );

        expect(canvasCss)
          .not.toContain(
            "height: 1px",
          );
      },
    );

    it(
      "moves provider playback into the existing full-player media slot",
      () => {
        expect(canvas)
          .toContain(
            "createPortal",
          );

        expect(canvas)
          .toContain(
            "[data-wk-provider-media-host]",
          );

        expect(desktop)
          .toContain(
            'data-wk-provider-media-host="desktop"',
          );

        expect(mobile)
          .toContain(
            'data-wk-provider-media-host="mobile"',
          );

        expect(desktop)
          .toContain(
            "!usesProviderMedia && isPlaying",
          );

        expect(mobile)
          .toContain(
            "!usesProviderMedia && isPlaying",
          );
      },
    );

    it(
      "makes the collapsed WAKILISHA scrubber backend-neutral",
      () => {
        expect(dock)
          .toContain(
            'role="slider"',
          );

        expect(dock)
          .toContain(
            "seekFromClientX",
          );

        expect(dock)
          .toContain(
            "currentTime",
          );

        expect(dock)
          .toContain(
            "duration",
          );

        expect(dock)
          .toContain(
            "seek(",
          );
      },
    );

    it(
      "controls SoundCloud through the same player state",
      () => {
        expect(player)
          .toContain(
            'playbackBackendRef.current = "soundcloud"',
          );

        expect(player)
          .toContain(
            "playSoundCloudTrack(",
          );

        expect(soundcloud)
          .toContain(
            "https://w.soundcloud.com/player/api.js",
          );

        expect(soundcloud)
          .toContain(
            "seekTo",
          );

        expect(soundcloud)
          .toContain(
            "setVolume",
          );

        expect(soundcloud)
          .toContain(
            "PLAY_PROGRESS",
          );

        expect(soundcloud)
          .toContain(
            "FINISH",
          );
      },
    );

    it(
      "uses one WAKILISHA queue and one completion path",
      () => {
        expect(player)
          .toContain(
            "queue: PlayerTrack[]",
          );

        expect(player)
          .toContain(
            "Handle completion for every playback backend.",
          );

        expect(youtube)
          .not.toContain(
            "playlistItems",
          );

        expect(soundcloud)
          .not.toContain(
            "playlistItems",
          );
      },
    );

    it(
      "invalidates late provider startup and never reparents the live iframe",
      () => {
        expect(youtube)
          .toContain(
            "requestSerial",
          );

        expect(youtube)
          .toContain(
            "stopVideo",
          );

        expect(youtube)
          .toContain(
            "autoplay: 0",
          );

        expect(soundcloud)
          .toContain(
            "requestSerial",
          );

        expect(soundcloud)
          .toContain(
            '"auto_play",\n    "true"',
          );

        expect(soundcloud)
          .toContain(
            "stopSoundCloud",
          );

        expect(player)
          .toContain(
            "stopYouTube",
          );

        expect(player)
          .toContain(
            "stopSoundCloud",
          );

        expect(canvas)
          .toContain(
            "getBoundingClientRect",
          );

        expect(canvas)
          .not.toContain(
            "destination.appendChild",
          );

        expect(canvas)
          .not.toContain(
            "mediaHost.appendChild",
          );
      },
    );

    it(
      "keeps WAKILISHA position authoritative for provider playback",
      () => {
        expect(soundcloud)
          .toContain(
            "getPosition",
          );

        expect(soundcloud)
          .toContain(
            "getDuration",
          );

        expect(soundcloud)
          .toContain(
            "isPaused",
          );

        expect(soundcloud)
          .toContain(
            "readSoundCloudPlaybackSnapshot",
          );

        expect(player)
          .toContain(
            "startSoundCloudPolling",
          );

        expect(player)
          .toContain(
            "startYouTubePolling",
          );

        expect(player)
          .toContain(
            "onAutoplayBlocked",
          );

        expect(player)
          .not.toContain(
            "window.requestAnimationFrame(() => {\n        playYouTubeTrack(",
          );

        expect(player)
          .not.toContain(
            "window.requestAnimationFrame(() => {\n        playSoundCloudTrack(",
          );
      },
    );

    it(
      "keeps provider playback full without equating HTML Audio with excerpts",
      () => {
        expect(history)
          .toContain(
            'experience.availability === "full"',
          );

        expect(history)
          .not.toContain(
            'input.backend !== "audio"',
          );

        expect(history)
          .not.toContain(
            'input.backend === "apple"',
          );
      },
    );
  },
);
