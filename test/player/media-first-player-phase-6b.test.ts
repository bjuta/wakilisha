import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const experience = readFileSync(
  "src/services/player/playerExperience.ts",
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
const desktopShell = readFileSync(
  "src/components/layout/AppLayout.tsx",
  "utf8",
);
const responsiveShell = readFileSync(
  "src/components/mobile/ResponsiveAppLayout.tsx",
  "utf8",
);
const playerChrome = readFileSync(
  "src/components/design-system/player/playerChrome.css",
  "utf8",
);
const history = readFileSync(
  "src/services/listeningHistory.ts",
  "utf8",
);
const audioPage = readFileSync(
  "src/pages/audio/detail/page.tsx",
  "utf8",
);

describe("Phase 6B media-first WAKILISHA Player", () => {
  it("separates media kind, playback availability, backend, and capabilities", () => {
    expect(experience).toContain("export type PlayerMediaKind");
    expect(experience).toContain('"music_track"');
    expect(experience).toContain('"audio_episode"');
    expect(experience).toContain('"standalone_audio"');
    expect(experience).toContain("export type PlayerAvailability");
    expect(experience).toContain('"full"');
    expect(experience).toContain('"excerpt"');
    expect(experience).toContain("PlayerCapabilities");
    expect(experience).toContain("jumpBySeconds");
    expect(experience).toContain("chapters");
    expect(experience).toContain("transcript");
  });

  it("keeps compact playback media-first and free of acquisition chrome", () => {
    expect(compact).toContain('data-wk-player-compact={mode}');
    expect(compact).toContain("experience.creatorLabel");
    expect(compact).toContain("experience.spokenAudio");
    expect(compact).toContain("Back ${jump ?? 15} seconds");
    expect(compact).not.toContain("playbackSourceLabel");
    expect(compact).not.toContain("AddToPlaylistButton");
    expect(compact).not.toContain("Connect Apple Music");
    expect(compact).not.toContain('>Full<');
    expect(compact).not.toContain("Preview");
  });

  it("makes provider acquisition contextual, late, and dismissible in the expanded player", () => {
    expect(full).toContain('experience.availability === "excerpt"');
    expect(full).toContain("pct >= 0.72");
    expect(full).toContain("unlockDismissed");
    expect(full).toContain("sessionStorage.setItem");
    expect(full).toContain("Keep listening");
    expect(full).toContain("Connect Apple Music");
    expect(full).not.toContain("playbackSourceLabel");
    expect(full).not.toContain("Playing via Apple Music");
    expect(full).not.toContain("Full track playing");
    expect(full).not.toContain("Unlocked through Apple Music");
  });

  it("gives spoken Audio its own listening grammar without Track-only actions", () => {
    expect(full).toContain("experience.spokenAudio");
    expect(full).toContain("skipBack");
    expect(full).toContain("skipForward");
    expect(full).toContain("Chapters");
    expect(full).toContain("Transcript");
    expect(full).not.toContain("AddToPlaylistButton");
    expect(full).not.toContain("TrackMoment");
    expect(full).not.toContain("Toggle lyrics");
    expect(audioPage).toContain('jumpBySeconds: 15');
    expect(audioPage).toContain('lyrics: false');
    expect(audioPage).toContain('moments: false');
    expect(audioPage).toContain('addToPlaylist: false');
    expect(audioPage).toContain('playbackSpeed: false');
  });

  it("makes the active public shells use the new player chrome and provider media host", () => {
    expect(desktopShell).toContain("PlayerCompactSurface");
    expect(desktopShell).not.toContain("PlayerDock");
    expect(desktopShell).not.toContain("DesktopPlayerPage");
    expect(responsiveShell).toContain("PlayerCompactSurface");
    expect(responsiveShell).toContain("PlayerFullSurface");
    expect(responsiveShell).toContain("isFullPlayerOpen");
    expect(full).toContain('data-wk-provider-media-host={mode}');
    expect(playerChrome).toContain(".phn-miniplayer");
    expect(playerChrome).toContain("display: none !important");
  });

  it("counts full playback by availability rather than provider backend", () => {
    expect(history).toContain('experience.availability === "full"');
    expect(history).not.toContain('input.backend !== "audio"');
    expect(history).toContain("experience.canonicalPath");
    expect(history).toContain("experience.mediaKind");
  });

  it("lets public Audio join the persistent player as full WAKILISHA media", () => {
    expect(audioPage).toContain('playbackAvailability: "full"');
    expect(audioPage).toContain('playbackEngine: "audio"');
    expect(audioPage).toContain("publication.delivery.url");
    expect(audioPage).toContain("playTrack(");
    expect(audioPage).toContain("openFullPlayer");
    expect(audioPage).not.toContain("<audio");
    expect(audioPage).not.toContain("MediaTimeline");
  });
});
