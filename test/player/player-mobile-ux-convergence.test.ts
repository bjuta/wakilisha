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
    expect(timedText).toContain("scrollIntoView");
    expect(timedText).toContain('variant: "lyrics" | "transcript"');
  });

  it("makes mobile top chrome floating and scroll-reactive", () => {
    expect(mobileLayout).toContain("MobileTopBar");
    expect(mobileLayout).toContain(
      "<MobileTopBar",
    );
    expect(mobileLayout).toContain(
      "scrollVisible={scrollVisible}",
    );
    expect(mobileLayout).toContain(
      "const scrollVisible = useScrollDirection();",
    );
    expect(mobileTopBar).not.toContain("useScrollDirection()");
    expect(mobileTopBar).toContain("translateY(-16px)");
    expect(mobileTopBar).toContain(
      "pointer-events-none sticky top-0",
    );
    expect(mobileTopBar).not.toContain("border-b");
    expect(mobileTopBar).not.toContain('to="/profile"');
    expect(mobileTopBar).not.toContain("sectionLabel");
    expect(mobileTopBar).not.toContain("{label}");
  });

  it("opens a left account drawer from the listener control instead of navigating", () => {
    expect(mobileTopBar).toContain("MobileAccountDrawer");
    expect(mobileTopBar).toContain("setAccountOpen(true)");
    expect(mobileTopBar).toContain("GlobalSearchSurface");
    expect(mobileTopBar).toContain("NotificationBell");
    expect(accountDrawer).toContain("WAKILISHA Menu");
    expect(accountDrawer).toContain("translateX(-18px)");
    expect(accountDrawer).toContain("New This Week");
    expect(accountDrawer).toContain("On The Radar");
    expect(accountDrawer).toContain("From The Registry");
    expect(accountDrawer).toContain("Appearance");
    expect(accountDrawer).toContain("Settings");
    expect(accountDrawer).toContain("Profile");
  });

  it("makes expanded Player top chrome use the same mobile scroll formula", () => {
    expect(topBar).toContain("useScrollDirection()");
    expect(topBar).toContain("translateY(-16px)");
    expect(topBar).toContain("pointer-events-none");
    expect(topBar).toContain("bg-black/20");
    expect(topBar).not.toContain("w-full rounded");
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
  });
});
