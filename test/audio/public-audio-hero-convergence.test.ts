import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hero = readFileSync(
  "src/components/design-system/audio/AudioHero.tsx",
  "utf8",
);
const indexPage = readFileSync(
  "src/pages/audio/page.tsx",
  "utf8",
);
const detail = readFileSync(
  "src/components/audio/PublicAudioListeningSurface.tsx",
  "utf8",
);
const audioPublicService = readFileSync(
  "src/services/audio/audioPublicService.ts",
  "utf8",
);
const router = readFileSync(
  "src/router/config.tsx",
  "utf8",
);
const lazy = readFileSync(
  "src/router/lazyPublic.tsx",
  "utf8",
);

describe("Public Audio hero convergence", () => {
  it("uses one hero primitive for the Audio index and published Audio detail", () => {
    expect(hero).toContain("data-wk-audio-hero");
    expect(indexPage).toContain("AudioHero");
    expect(detail).toContain("AudioHero");
    expect(detail).toContain("Ch19GradientImage");
  });

  it("keeps listening authority in the existing persistent player", () => {
    expect(detail).toContain("publicAudioPlayerItem");
    expect(detail).toContain("playTrack(");
    expect(detail).toContain("openFullPlayer");
    expect(detail).toContain("seek(startSeconds)");
    expect(detail).not.toContain("<audio");
    expect(audioPublicService).toContain(
      "export async function getPublicStandaloneAudio(",
    );
    expect(audioPublicService).toContain(
      "export async function getPublicAudioIndex(",
    );
  });

  it("makes /audio a real routed public surface", () => {
    expect(router).toContain("PublicAudioPage");
    expect(router).toContain('{ path: "/audio",');
    expect(router.indexOf('{ path: "/audio",')).toBeLessThan(router.indexOf('{ path: "/audio/:slug",'));
    expect(lazy).toContain("PublicAudioPage");
    expect(indexPage).toContain("getPublicAudioIndex");
  });
});
