import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PlaybackSessionArbiter } from "../../src/services/player/playbackSession";

const read = (path: string) => readFileSync(path, "utf8");

const player = read("src/context/PlayerContext.tsx");
const apple = read("src/services/appleMusicPlayback.ts");
const full = read("src/components/design-system/player/PlayerFullSurface.tsx");
const shell = read("src/components/music/MusicDesktopShell.tsx");
const trackSearch = read("src/hooks/useTrackSearchData.ts");
const search = read("src/pages/search/page.tsx");

describe("player and public-shell convergence", () => {
  it("invalidates stale playback sessions deterministically", () => {
    const arbiter = new PlaybackSessionArbiter();
    expect(arbiter.current()).toBe(0);

    const first = arbiter.claim();
    expect(arbiter.isCurrent(first)).toBe(true);
    expect(arbiter.current()).toBe(first);

    const second = arbiter.claim();
    expect(second).toBeGreaterThan(first);
    expect(arbiter.isCurrent(first)).toBe(false);
    expect(arbiter.isCurrent(second)).toBe(true);

    const invalidated = arbiter.invalidate();
    expect(invalidated).toBeGreaterThan(second);
    expect(arbiter.isCurrent(second)).toBe(false);
  });

  it("makes one player context arbitrate every playback engine and Pause every source", () => {
    expect(player).toContain("PlaybackSessionArbiter");
    expect(player).toContain("stopEveryEngine");
    expect(player).toContain("pauseEveryEngine");
    expect(player).toContain("sessionIsCurrent");
    expect(player).toContain("stopAppleMusic");
    expect(player).toContain("stopYouTube");
    expect(player).toContain("stopSoundCloud");
    expect(player).toContain("audio.pause()");
    expect(player).toContain("queueContext");
    expect(player).toContain("playbackRate");
    expect(player).toContain("setPlaybackRate");
  });

  it("invalidates stale MusicKit work before an old async request can resume", () => {
    expect(apple).toContain("playbackRequestSerial");
    expect(apple).toContain("playbackOperation");
    expect(apple).toContain("stale completion");
    expect(apple).toContain("export async function stopAppleMusic");
    expect(apple).toContain("playbackRequestSerial += 1");
  });

  it("keeps Audio transport semantic while retaining queue context", () => {
    expect(full).toContain("experience.spokenAudio");
    expect(full).toContain("skipBack");
    expect(full).toContain("skipForward");
    expect(full).toContain("Previous episode");
    expect(full).toContain("Next episode");
    expect(full).toContain("queueContext?.label");
    expect(full).toContain("Playing from {queueContext.label}");
  });

  it("moves global Search into the sidebar and removes the redundant desktop utility bar", () => {
    expect(shell).toContain('role="search"');
    expect(shell).toContain('placeholder="Search WAKILISHA"');
    expect(shell).toContain("submitSearch");
    expect(shell).toContain('to="/search"');
    expect(shell).not.toContain('h-[76px]');
    expect(shell).not.toContain("Upload Music");
    expect(shell).toContain("Artist Studio");
  });

  it("passes exact Registry preview authority from Search into the persistent Player", () => {
    expect(trackSearch).toContain("preview_url");
    expect(trackSearch).toContain("previewUrl: string | null");
    expect(trackSearch).toContain("isPlayable: Boolean(previewUrl)");
    expect(search).toContain("previewUrl: track.previewUrl ?? undefined");
    expect(search).toContain('mediaKind: "music_track"');
    expect(search).toContain('label: "Search"');
  });
});
