import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const primitive = read(
  "src/components/design-system/media/MediaPresentationSurface.tsx",
);
const overlay = read(
  "src/components/video/VideoOverlay.tsx",
);
const watching = read(
  "src/components/video/PublicVideoWatchingSurface.tsx",
);
const provider = read(
  "src/components/design-system/music/ProviderPlaybackCanvas.tsx",
);
const providerCss = read(
  "src/components/design-system/music/ProviderPlaybackCanvas.css",
);
const registry = JSON.parse(
  read("scripts/control-plane/primitive-registry.json"),
) as {
  primitives: Array<{
    id: string;
    maturity: string;
    kind: string;
    authorityOwner: string;
    consumers: string[];
  }>;
};

describe(
  "shared Media presentation convergence",
  () => {
    it(
      "keeps presentation consumer-owned and media-neutral",
      () => {
        expect(primitive).toContain(
          "export type MediaPresentationMode",
        );
        expect(primitive).toContain(
          '"inline"',
        );
        expect(primitive).toContain(
          '"floating"',
        );
        expect(primitive).toContain(
          '"modal"',
        );
        expect(primitive).toContain(
          "setPointerCapture",
        );
        expect(primitive).toContain(
          "releasePointerCapture",
        );
        expect(primitive).toContain(
          "window.innerWidth",
        );
        expect(primitive).toContain(
          "window.innerHeight",
        );
        expect(primitive).toContain(
          "useScrollLock",
        );

        for (const forbidden of [
          "@/services/",
          "@/pages/",
          "@/lib/supabase",
          "VideoPlaybackCanvas",
          "ProviderPlaybackCanvas",
          "youtubePlayback",
          "soundCloudPlayback",
        ]) {
          expect(primitive).not.toContain(forbidden);
        }
      },
    );

    it(
      "removes VideoOverlay local drag authority",
      () => {
        expect(overlay).toContain(
          "MediaPresentationSurface",
        );
        expect(overlay).toContain(
          'mode={isLightbox ? "modal" : "floating"}',
        );
        expect(overlay).toContain(
          "dragHandleProps",
        );
        expect(overlay).toContain(
          "VideoPlaybackCanvas",
        );
        expect(overlay).toContain(
          "onNavigate",
        );
        expect(overlay).not.toContain(
          "pipPos",
        );
        expect(overlay).not.toContain(
          "dragStateRef",
        );
        expect(overlay).not.toContain(
          "handleDragStart",
        );
        expect(overlay).not.toContain(
          "useScrollLock",
        );
      },
    );

    it(
      "gives public Video the same free-drag floating grammar",
      () => {
        expect(watching).toContain(
          "MediaPresentationSurface",
        );
        expect(watching).toContain(
          'mode={playerDocked ? "floating" : "inline"}',
        );
        expect(watching).toContain(
          "draggable={playerDocked}",
        );
        expect(watching).toContain(
          'aria-label="Move floating video"',
        );
        expect(watching).toContain(
          "VideoPlaybackCanvas",
        );
      },
    );

    it(
      "gives music provider playback the shared floating grammar",
      () => {
        expect(provider).toContain(
          "MediaPresentationSurface",
        );
        expect(provider).toContain(
          'mode={isFullPlayerOpen ? "inline" : "floating"}',
        );
        expect(provider).toContain(
          "draggable={active && !isFullPlayerOpen}",
        );
        expect(provider).toContain(
          'aria-label="Move floating media"',
        );
        expect(providerCss).toContain(
          ".wk-provider-playback-drag-handle",
        );
      },
    );

    it(
      "registers the two-domain primitive as canonical",
      () => {
        const entry = registry.primitives.find(
          (item) => item.id === "media.presentation-surface",
        );

        expect(entry).toBeTruthy();
        expect(entry?.kind).toBe("presentation");
        expect(entry?.maturity).toBe("canonical");
        expect(entry?.authorityOwner).toBe("consumer");
        expect(entry?.consumers).toEqual([
          "public:music-playback",
          "public:video-playback",
        ]);
      },
    );
  },
);
