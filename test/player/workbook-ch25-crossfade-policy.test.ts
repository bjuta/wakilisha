import { describe, expect, it } from "vitest";
import { resolvePreviewCrossfadeSeconds, type PreviewCrossfadeRequest } from "@/services/player/crossfadePolicy";

const base: PreviewCrossfadeRequest = {
  enabled: true,
  continuousPlayback: true,
  selectedSeconds: 6,
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
  it("crossfades ordered releases when the listener selects Crossfade or Smart Mix", () => {
    expect(resolvePreviewCrossfadeSeconds({ ...base, sourceEntityType: "release" })).toBe(6);
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


import { describe as mixDescribe, expect as mixExpect, it as mixIt } from "vitest";
import { equalPowerLevels, resolveMixableAudioSource, safeTempoMatchRate, estimateBeatTempo, WakilishaMixEngine } from "@/services/player/WakilishaMixEngine";

mixDescribe("Chapter 25 WAKILISHA shared Smart Mix engine", () => {
  mixIt("does not attach a media element when audio context is absent or suspended", () => {
    const engine = new WakilishaMixEngine();
    mixExpect(engine.isRunning()).toBe(false);
    const source = { url: "/__wk-mix/itunes-assets/AudioPreview221/v4/a.m4a", mixable: true };
    mixExpect(engine.prepare({} as HTMLAudioElement, source)).toBe(false);
  });
  mixIt("uses equal-power gain envelopes at the quarter, midpoint and endpoints", () => {
    const zero = equalPowerLevels(0), half = equalPowerLevels(0.5), end = equalPowerLevels(1);
    mixExpect(zero.outgoing).toBeCloseTo(1, 5);
    mixExpect(zero.incoming).toBeCloseTo(0, 5);
    mixExpect(half.incoming ** 2 + half.outgoing ** 2).toBeCloseTo(1, 5);
    mixExpect(end.incoming).toBeCloseTo(1, 5);
    mixExpect(end.outgoing).toBeCloseTo(0, 5);
  });
  mixIt("routes only exact public preview media to WAKILISHA sample-level delivery", () => {
    const origin = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/da/cb/f3/file.plus.aac.p.m4a";
    mixExpect(resolveMixableAudioSource(origin)).toEqual({
      url: "/__wk-mix/itunes-assets/AudioPreview221/v4/da/cb/f3/file.plus.aac.p.m4a",
      mixable: true,
    });
    for (const bad of [
      "https://evil.example/itunes-assets/AudioPreview221/v4/x.m4a",
      "https://audio-ssl.itunes.apple.com/secret.mp3",
      "http://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/x.m4a",
      "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/x.php",
    ]) {
      mixExpect(resolveMixableAudioSource(bad)).toEqual({ url: bad, mixable: false });
    }
  });
  mixIt("aligns nearby BPM and never forces extreme time stretching", () => {
    mixExpect(safeTempoMatchRate(120, 124)).toBeCloseTo(120 / 124, 5);
    mixExpect(safeTempoMatchRate(90, 140)).toBe(1);
    mixExpect(safeTempoMatchRate(null, 120)).toBe(1);
  });
  mixIt("extracts a strong 120 BPM pulse from synthetic short audio", () => {
    const sampleRate = 8000;
    const samples = new Float32Array(sampleRate * 12);
    for (let start = 0; start < samples.length; start += sampleRate / 2) {
      for (let j = 0; j < 160; j++) samples[start + j] = 0.8;
    }
    const clip = {
      sampleRate,
      duration: 12,
      getChannelData: () => samples,
    } as unknown as AudioBuffer;
    mixExpect(estimateBeatTempo(clip)).toBeGreaterThanOrEqual(118);
    mixExpect(estimateBeatTempo(clip)).toBeLessThanOrEqual(122);
  });
});
