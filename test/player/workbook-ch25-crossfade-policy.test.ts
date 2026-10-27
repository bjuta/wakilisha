import { describe, expect, it } from "vitest";
import { resolvePreviewCrossfadeSeconds, type PreviewCrossfadeRequest } from "@/services/player/crossfadePolicy";

const base: PreviewCrossfadeRequest = {
  enabled: true,
  continuousPlayback: true,
  selectedSeconds: 6,
  keepAlbumsGapless: true,
  sourceEntityType: "chart_edition",
  shuffled: false,
  repeatOne: false,
  automatic: true,
  backend: "audio",
  nextPrefersApple: false,
  currentPreviewUrl: "https://example.invalid/current.mp3",
  nextPreviewUrl: "https://example.invalid/next.mp3",
  currentDuration: 30,
  nextDuration: 30,
};

describe("Workbook Chapter 25 preview crossfade policy", () => {
  it("limits a 30-second preview transition to seven seconds", () => {
    expect(resolvePreviewCrossfadeSeconds({ ...base, selectedSeconds: 12 })).toBe(7);
  });
  it("keeps ordered albums and EPs without overlap", () => {
    expect(resolvePreviewCrossfadeSeconds({ ...base, sourceEntityType: "release" })).toBe(0);
    expect(resolvePreviewCrossfadeSeconds({ ...base, sourceEntityType: "release", shuffled: true })).toBe(6);
  });
  it("never fades on skips, Repeat One, or when the listener turned it off", () => {
    expect(resolvePreviewCrossfadeSeconds({ ...base, automatic: false })).toBe(0);
    expect(resolvePreviewCrossfadeSeconds({ ...base, repeatOne: true })).toBe(0);
    expect(resolvePreviewCrossfadeSeconds({ ...base, enabled: false })).toBe(0);
  });
  it("keeps unsupported providers and Apple-bound transitions clean", () => {
    for (const backend of ["apple", "youtube", "soundcloud"] as const) {
      expect(resolvePreviewCrossfadeSeconds({ ...base, backend })).toBe(0);
    }
    expect(resolvePreviewCrossfadeSeconds({ ...base, nextPrefersApple: true })).toBe(0);
  });
  it("requires playable previews and duration evidence", () => {
    expect(resolvePreviewCrossfadeSeconds({ ...base, nextPreviewUrl: null })).toBe(0);
    expect(resolvePreviewCrossfadeSeconds({ ...base, currentDuration: NaN })).toBe(0);
    expect(resolvePreviewCrossfadeSeconds({ ...base, nextDuration: 0 })).toBe(0);
  });
});
