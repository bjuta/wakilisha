import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const shell = readFileSync(
  "src/components/music/MusicDesktopShell.tsx",
  "utf8",
);
const topBar = readFileSync("src/components/mobile/MobileTopBar.tsx", "utf8");
const globalSearch = readFileSync(
  "src/components/search/GlobalSearchSurface.tsx",
  "utf8",
);
const trackSearch = readFileSync(
  "src/hooks/useTrackSearchData.ts",
  "utf8",
);
const searchPage = readFileSync(
  "src/pages/search/page.tsx",
  "utf8",
);
const full = readFileSync(
  "src/components/design-system/player/PlayerFullSurface.tsx",
  "utf8",
);
const audioAdapter = readFileSync(
  "src/services/audio/audioPlayerAdapter.ts",
  "utf8",
);
const playerContext = readFileSync(
  "src/context/PlayerContext.tsx",
  "utf8",
);

describe(
  "WAKILISHA listening convergence",
  () => {
    it("uses the same Search action in the public top bar on desktop", () => {
      expect(shell).toContain("<MobileTopBar />");
      expect(topBar).toContain("GlobalSearchSurface");
      expect(topBar).toContain('aria-label="Search"');
      expect(shell).not.toContain("Upload Music");
      expect(topBar).toContain("setSearchOpen(true)");
    });

    it("keeps Search playback truthful", () => {
      expect(trackSearch).toContain("previewUrl");
      expect(searchPage).toContain("previewUrl: track.previewUrl");
      expect(globalSearch).toContain("previewUrl: track.previewUrl");
      expect(globalSearch).toContain("See All Results");
    });

    it("restores Music utilities while keeping spoken Audio grammar distinct", () => {
      expect(full).toContain("AddToPlaylistButton");
      expect(full).toContain("TrackMomentDrawer");
      expect(full).toContain("ShareSheet");
      expect(full).toContain("Lyrics");
      expect(full).toContain("Queue");
      expect(full).toContain("Playback speed");
      expect(full).toContain("Transcript");
      expect(audioAdapter).toContain("playbackSpeed: true");
      expect(audioAdapter).toContain("lyrics: false");
      expect(audioAdapter).toContain("addToPlaylist: false");
      expect(playerContext).toContain("setPlaybackRate");
    });
  },
);
