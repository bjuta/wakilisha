import { readFileSync } from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const full = readFileSync(
  "src/components/design-system/player/PlayerFullSurface.tsx",
  "utf8",
);
const compact = readFileSync(
  "src/components/design-system/player/PlayerCompactSurface.tsx",
  "utf8",
);
const seekRail = readFileSync(
  "src/components/design-system/player/SeekRail.tsx",
  "utf8",
);
const topBar = readFileSync(
  "src/components/design-system/player/PlayerTopBar.tsx",
  "utf8",
);
const panelSheet = readFileSync(
  "src/components/design-system/player/PlayerPanelSheet.tsx",
  "utf8",
);
const contextSheet = readFileSync(
  "src/components/design-system/player/PlayerContextSheet.tsx",
  "utf8",
);
const queuePanel = readFileSync(
  "src/components/design-system/player/PlayerQueuePanel.tsx",
  "utf8",
);
const timedText = readFileSync(
  "src/components/design-system/player/PlayerTimedTextPanel.tsx",
  "utf8",
);
const playerContext = readFileSync(
  "src/context/PlayerContext.tsx",
  "utf8",
);
const mobileLayout = readFileSync(
  "src/components/mobile/MobileAppLayout.tsx",
  "utf8",
);
const mobileTopBar = readFileSync(
  "src/components/mobile/MobileTopBar.tsx",
  "utf8",
);
const accountDrawer = readFileSync(
  "src/components/mobile/MobileAccountDrawer.tsx",
  "utf8",
);

describe("Player and mobile media UX convergence", () => {
  it("keeps the small player above browser chrome with bottom preview progress", () => {
    expect(compact).toContain("window.visualViewport");
    expect(compact).toContain("browserGap + 8");
    expect(compact).toContain('variant="edge"');
    expect(compact).toContain('tone={experience.availability === "excerpt" ? "preview" : "full"}');
    expect(compact).toContain('min-h-[62px]');
    expect(seekRail).toContain('tone?: "brand" | "full" | "preview"');
  });

  it("expands Lyrics on phones without exposing timestamps as visual chrome", () => {
    expect(panelSheet).toContain('const fullScreenLyrics = mobile && title === "Lyrics";');
    expect(panelSheet).toContain("h-[100dvh]");
    expect(timedText).toContain('timed && variant !== "lyrics"');
    expect(timedText).toContain("aria-label={timed");
    expect(timedText).toContain("prefers-reduced-motion");
    expect(full).toContain('playbackBackend === "youtube" ? "aspect-video"');
  });


  it("turns the player ellipsis into a real contextual action surface without exposing diagnostics", () => {
    expect(full).toContain("PlayerTopBar");
    expect(full).toContain('onMore={() => setPanel("more")}');
    expect(full).toContain("PlayerContextSheet");
    expect(contextSheet).toContain("PlayerContextAction");
    expect(contextSheet).toContain("playlistAction");
    expect(topBar).toContain("More Player actions");
    expect(full).not.toContain('>Playback<');
    expect(full).not.toContain('>Available<');
  });

  it("upgrades Queue from a flat list into Now Playing, Up Next, and history", () => {
    expect(full).toContain("PlayerQueuePanel");
    expect(queuePanel).toContain("Now Playing");
    expect(queuePanel).toContain("Up Next");
    expect(queuePanel).toContain("Clear Up Next");
    expect(queuePanel).toContain("Move Earlier");
    expect(queuePanel).toContain("Move Later");
    expect(queuePanel).toContain("Remove");
    expect(queuePanel).toContain("Played Earlier");
  });

  it("gives Queue real local session mutations without changing publication authority", () => {
    expect(playerContext).toContain("queueOrder");
    expect(playerContext).toContain("moveQueueItem");
    expect(playerContext).toContain("removeQueueItem");
    expect(playerContext).toContain("clearUpcoming");
    expect(playerContext).toContain("resolveQueueOrder");
  });

  it("uses one responsive player sheet grammar for Queue, Lyrics, Transcript, Chapters, and More", () => {
    expect(full).toContain("PlayerPanelSheet");
    expect(panelSheet).toContain('mode: "desktop" | "mobile"');
    expect(panelSheet).toContain("rounded-t-[30px]");
    expect(panelSheet).toContain("rounded-[28px]");
    expect(panelSheet).toContain("data-wk-player-panel-scroll");
    expect(timedText).toContain('closest<HTMLElement>("[data-wk-player-panel-scroll]")');
    expect(timedText).not.toContain("activeRef.current?.scrollIntoView(");
    expect(timedText).toContain('variant: "lyrics" | "transcript"');
  });

  it("keeps one persistent 56px Workbook header and no fake browser chrome or bottom menu", () => {
    expect(mobileLayout).toContain('data-wk-workbook-mobile-shell="v4"');
    expect(mobileLayout).toContain("<MobileTopBar");
    expect(mobileLayout).not.toContain("MobileBottomNav");
    expect(mobileLayout).not.toContain("useScrollDirection()");
    expect(mobileTopBar).toContain('data-wk-mobile-app-header="v4"');
    expect(mobileTopBar).toContain("fixed inset-x-0 top-0");
    expect(mobileTopBar).toContain("bg-[var(--wk-surface)]");
    expect(mobileTopBar).toContain("mix-blend-difference");
    expect(mobileTopBar).toContain("h-14");
    expect(mobileTopBar).toContain('aria-label="Open WAKILISHA menu"');
    expect(mobileTopBar).toContain('aria-label="Search"');
    expect(mobileTopBar).not.toContain("NotificationBell");
  });

  it("opens a left account drawer from the listener control instead of navigating", () => {
    expect(mobileTopBar).toContain("MobileAccountDrawer");
    expect(mobileTopBar).toContain("setAccountOpen(true)");
    expect(mobileTopBar).toContain("GlobalSearchSurface");
    expect(mobileTopBar).not.toContain("NotificationBell");
    expect(accountDrawer).toContain("WAKILISHA Menu");
    expect(accountDrawer).toContain("ModalOverlay");



    expect(accountDrawer).toContain("navigation.map");
    expect(accountDrawer).toContain("useScrollLock(open)");
    expect(accountDrawer).toContain("WakilishaToggle");
    expect(accountDrawer).toContain('ariaLabel="Dark mode"');
    expect(accountDrawer).toContain("Settings");
    expect(accountDrawer).toContain("Profile");
  });

  it("keeps the expanded Player exit control visible even when the article has scrolled", () => {
    expect(topBar).not.toContain("useScrollDirection()");
    expect(topBar).toContain('aria-label="Close Player"');
    expect(topBar).toContain("grid-cols-[44px_minmax(0,1fr)_44px]");
    expect(topBar).not.toContain("mix-blend-difference");
    expect(topBar).toContain("bg-[var(--wk-bg)]/95");
    expect(full).toContain("calc(80px + env(safe-area-inset-top))");
    expect(topBar).toContain('aria-label="Close Player"');
    expect(topBar).toContain("pointer-events-none");
    expect(topBar).toContain("pointer-events-auto");
    expect(topBar).toContain("bg-black/20");
  });

  it("keeps Music and spoken Audio transport grammars distinct", () => {
    expect(full).toContain("skipBack");
    expect(full).toContain("skipForward");
    expect(full).toContain('name="SkipBack"');
    expect(full).toContain('name="SkipForward"');
    expect(full).toContain("Playback Speed");
    expect(full).toContain("queueAvailable");
    expect(full).toContain("!experience.spokenAudio || queue.length > 1");
    expect(full).toContain('label: "Lyrics"');
    expect(full).toContain("Contribute Lyrics");
    expect(full).toContain("View Transcript");
    expect(full).toContain("AddToPlaylistButton");
    expect(full).toContain("TrackMomentDrawer");
    expect(full).toContain('aria-pressed={saved}');
    expect(full).toContain('label="Comments"');
    expect(full).toContain('label="Lyrics"');
    expect(full).toContain('label="Queue"');
    const anchoredComments = readFileSync(
      "src/components/feature/community/TrackMomentDrawer.tsx",
      "utf8",
    );
    expect(anchoredComments).toContain("Comments at this time");
    expect(anchoredComments).toContain("createTrackMomentComment");
    expect(anchoredComments).toContain("anchorTimeMs: selectedTimeMs");
  });
});
