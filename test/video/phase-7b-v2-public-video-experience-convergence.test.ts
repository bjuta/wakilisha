import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(file: string): string {
  return fs.readFileSync(path.resolve(file), "utf8");
}

const canvas = read("src/components/video/VideoPlaybackCanvas.tsx");
const overlay = read("src/components/video/VideoOverlay.tsx");
const legacyCard = read("src/components/video/VideoCard.tsx");
const cardFrame = read("src/components/video/VideoCardFrame.tsx");
const publicCard = read("src/components/video/PublicVideoCard.tsx");
const watching = read(
  "src/components/video/PublicVideoWatchingSurface.tsx",
);
const indexPage = read("src/pages/video/page.tsx");
const detailPage = read("src/pages/video/detail/page.tsx");
const mobileLayout = read("src/components/mobile/MobileAppLayout.tsx");
const mobileTopBar = read("src/components/mobile/MobileTopBar.tsx");
const scrollDirection = read("src/hooks/useScrollDirection.ts");

describe("Phase 7B V2 public Video experience convergence", () => {
  it("uses one playback canvas for canonical and legacy Video presentation", () => {
    expect(canvas).toContain("export function VideoPlaybackCanvas");
    expect(canvas).toContain('kind: "native"');
    expect(canvas).toContain('kind: "provider"');
    expect(watching).toContain("<VideoPlaybackCanvas");
    expect(overlay).toContain("<VideoPlaybackCanvas");
    expect(overlay).not.toContain("<iframe");
    expect(watching).not.toContain("<video");
    expect(watching).not.toContain("<iframe");
  });

  it("keeps the established Video card real estate as a shared visual primitive", () => {
    expect(cardFrame).toContain("export function VideoCardFrame");
    expect(legacyCard).toContain("<VideoCardFrame");
    expect(publicCard).toContain("<VideoCardFrame");
    expect(indexPage).toContain("<PublicVideoCard");
  });

  it("keeps captions governed and moves them into player settings", () => {
    expect(canvas).toContain('aria-label="Video settings"');
    expect(canvas).toContain("Settings");
    expect(canvas).toContain("Captions");
    expect(canvas).toContain("caption.label");
    expect(canvas).toContain('crossOrigin="anonymous"');
    expect(canvas).toContain("onLoad={() => {");
    expect(canvas).toContain("syncCaptionTracks();");
    expect(canvas).toContain("textTrack.mode =");
    expect(canvas).toContain('"hidden"');
    expect(canvas).toContain('"disabled"');
    expect(canvas).toContain("activeCueLines");
    expect(canvas).toContain('data-wk-video-captions="active"');
    expect(canvas).toContain(
      "const cues = selectedTrack?.cues",
    );
    expect(canvas).toContain(
      "time < vttCue.startTime",
    );
    expect(canvas).toContain(
      "time >= vttCue.endTime",
    );
    expect(canvas).toContain(
      "syncActiveCueLines(nextTime)",
    );
    expect(canvas).not.toContain(
      "selectedTrack?.activeCues",
    );
    expect(canvas).not.toContain('"showing"');
    expect(canvas).not.toContain("default={caption.isDefault}");
    expect(canvas).not.toContain('aria-label="Captions"');
    expect(watching).not.toContain("defaultCaption.label");
    expect(watching).not.toContain(">CC<");
    expect(watching).not.toContain("caption track");
    expect(watching).not.toContain("caption tracks");
  });

  it("owns native playback controls while preserving provider embedding", () => {
    expect(canvas).toContain("<video");
    expect(canvas).not.toMatch(/<video[^>]*\\scontrols(?:=|\\s|>)/);
    expect(canvas).toContain("<iframe");
    expect(canvas).toContain("Rewind 10 seconds");
    expect(canvas).toContain("Forward 10 seconds");
    expect(canvas).toContain("Playback speed");
    expect(canvas).toContain("Set playback speed to");
    expect(canvas).toContain("Enter fullscreen");
    expect(canvas).toContain("Video progress");
    expect(canvas).toContain("controlsHideTimerRef");
    expect(canvas).toContain("2400");
    expect(canvas).toContain('"opacity-0"');
    expect(canvas).toContain("onPointerMove={revealControls}");
    expect(canvas).toContain("onPointerDown={revealControls}");
  });

  it("compounds the existing collapse and expand interaction into canonical Video", () => {
    expect(watching).toContain("playerDocked");
    expect(watching).toContain("collapsePlayer");
    expect(watching).toContain("expandPlayer");
    expect(canvas).toContain('aria-label="Collapse video"');
    expect(canvas).toContain('aria-label="Expand video"');
    expect(canvas).toContain('aria-label="Close video"');
  });

  it("puts watching at the top with no Video-specific header", () => {
    const playerIndex = watching.indexOf("<VideoPlaybackCanvas");
    const titleIndex = watching.indexOf("<h1");
    const recordIndex = watching.indexOf("<PublicationRecord");
    expect(playerIndex).toBeGreaterThan(-1);
    expect(titleIndex).toBeGreaterThan(playerIndex);
    expect(recordIndex).toBeGreaterThan(titleIndex);
    expect(watching).toContain("<details");
    expect(watching).toContain("Publication record");
    expect(watching).not.toContain('className="sticky top-0 z-40');
    expect(watching).not.toContain("Back to Video");
  });

  it("keeps global top chrome transient while preserving the shared bottom-navigation signal", () => {
    expect(scrollDirection).toContain("topVisible");
    expect(scrollDirection).toContain("850");
    expect(scrollDirection).toContain("setTopVisible(false)");
    expect(mobileLayout).toContain("scrollChrome.topVisible");
    expect(mobileLayout).toContain("scrollChrome.visible");
    expect(mobileTopBar).toContain("scrollVisible || searchOpen || accountOpen");
  });

  it("keeps the Video directory aligned to existing public page conventions", () => {
    expect(indexPage).toContain("var(--wk-bg)");
    expect(indexPage).toContain("var(--wk-surface)");
    expect(indexPage).toContain("Search Video");
    expect(indexPage).toContain("Latest Video");
    expect(indexPage).not.toContain("Watch the culture move.");
    expect(detailPage).toContain("<PublicVideoWatchingSurface");
  });

  it("does not introduce forbidden public copy punctuation", () => {
    for (const source of [canvas, watching, indexPage, publicCard, cardFrame]) {
      expect(source).not.toContain("—");
      expect(source).not.toContain(" -- ");
    }
  });
});
