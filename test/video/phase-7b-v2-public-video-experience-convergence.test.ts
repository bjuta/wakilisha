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

  it("makes native captions first class instead of browser-menu metadata", () => {
    expect(canvas).toContain('aria-label="Captions"');
    expect(canvas).toContain(">CC<");
    expect(canvas).toContain("caption.label");
    expect(canvas).toContain('crossOrigin="anonymous"');
    expect(canvas).toContain("onLoad={syncCaptionTracks}");
    expect(canvas).toContain("textTrack.mode =");
    expect(canvas).toContain('"showing"');
    expect(canvas).toContain('"disabled"');
    expect(watching).toContain("defaultCaption.label");
    expect(watching).not.toContain("caption track");
    expect(watching).not.toContain("caption tracks");
  });

  it("owns native playback controls while preserving provider embedding", () => {
    expect(canvas).toContain("<video");
    expect(canvas).not.toMatch(/<video[^>]*\\scontrols(?:=|\\s|>)/);
    expect(canvas).toContain("<iframe");
    expect(canvas).toContain("Rewind 10 seconds");
    expect(canvas).toContain("Forward 10 seconds");
    expect(canvas).toContain("Change playback speed");
    expect(canvas).toContain("Enter fullscreen");
    expect(canvas).toContain("Video progress");
  });

  it("compounds the existing collapse and expand interaction into canonical Video", () => {
    expect(watching).toContain("playerDocked");
    expect(watching).toContain("collapsePlayer");
    expect(watching).toContain("expandPlayer");
    expect(canvas).toContain('aria-label="Collapse video"');
    expect(canvas).toContain('aria-label="Expand video"');
    expect(canvas).toContain('aria-label="Close video"');
  });

  it("puts watching ahead of metadata and keeps publication provenance subordinate", () => {
    const playerIndex = watching.indexOf("<VideoPlaybackCanvas");
    const titleIndex = watching.indexOf("<h1");
    const recordIndex = watching.indexOf("<PublicationRecord");
    expect(playerIndex).toBeGreaterThan(-1);
    expect(titleIndex).toBeGreaterThan(playerIndex);
    expect(recordIndex).toBeGreaterThan(titleIndex);
    expect(watching).toContain("<details");
    expect(watching).toContain("Publication record");
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
