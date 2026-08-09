import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const dock =
  readFileSync(
    "src/components/design-system/music/PlayerDock.tsx",
    "utf8",
  );

const mobile =
  readFileSync(
    "src/components/mobile/MobileFullPlayer.tsx",
    "utf8",
  );

const canvas =
  readFileSync(
    "src/components/design-system/music/ProviderPlaybackCanvas.tsx",
    "utf8",
  );

const canvasCss =
  readFileSync(
    "src/components/design-system/music/ProviderPlaybackCanvas.css",
    "utf8",
  );

describe(
  "Phase 5B mobile provider playback",
  () => {
    it(
      "makes collapsed seeking touch-usable",
      () => {
        expect(dock)
          .toContain(
            "onPointerDown",
          );

        expect(dock)
          .toContain(
            "onPointerMove",
          );

        expect(dock)
          .toContain(
            "setPointerCapture",
          );

        expect(dock)
          .toContain(
            "touch-none",
          );
      },
    );

    it(
      "does not label full provider playback as a preview",
      () => {
        expect(mobile)
          .toContain(
            'playbackBackend === "audio"',
          );

        expect(mobile)
          .toContain(
            '? "Preview"',
          );

        expect(mobile)
          .toContain(
            ': "Now playing"',
          );
      },
    );

    it(
      "reacquires provider media geometry as the full player settles",
      () => {
        expect(canvas)
          .toContain(
            "MutationObserver",
          );

        expect(canvas)
          .toContain(
            "requestAnimationFrame",
          );

        expect(canvas)
          .toContain(
            "trackTitle,",
          );

        expect(canvas)
          .toContain(
            "backend,",
          );

        expect(canvas)
          .toContain(
            "getBoundingClientRect",
          );
      },
    );

    it(
      "keeps provider media valid while a replacement host resolves",
      () => {
        expect(canvas)
          .toContain(
            "is-awaiting-host",
          );

        expect(canvasCss)
          .toContain(
            ".wk-provider-playback-canvas.is-awaiting-host",
          );

        expect(canvasCss)
          .toContain(
            "opacity: 0",
          );
      },
    );
  },
);
