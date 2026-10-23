import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync("src/components/mobile/MobileAppLayout.tsx", "utf8");
const header = readFileSync("src/components/mobile/MobileTopBar.tsx", "utf8");
const drawer = readFileSync("src/components/mobile/MobileAccountDrawer.tsx", "utf8");
const desktop = readFileSync("src/components/music/MusicDesktopShell.tsx", "utf8");

describe("Workbook v4 mobile header and sidebar flow", () => {
  it("opens places from the phone menu, not the private You view", () => {
    expect(desktop).toContain("setMenuStartsInYou(false)");
    expect(desktop).toContain("setMenuStartsInYou(true)");
    expect(desktop).toContain("startInYou={menuStartsInYou && isSignedIn}");
  });

  it("floats the application header over content with real light/dark contrast", () => {
    expect(header).toContain("pointer-events-none fixed inset-x-0 top-0");
    expect(header).toContain("bg-transparent");
    expect(header).toContain("mix-blend-difference");
    expect(header).toContain('style={{ paddingTop: "env(safe-area-inset-top)"');
    expect(layout).toContain("<MobileTopBar");
    expect(layout).not.toContain("scrollVisible");
  });

  it("keeps a single start-edge sidebar without a bottom tab or second menu", () => {
    expect(header).toContain("Open WAKILISHA menu");
    expect(header).toContain('aria-controls="wk-workbook-sidebar"');
    expect(drawer).toContain("navigation.map");
    expect(drawer).toContain("ModalOverlay");
    expect(layout).not.toContain("MobileBottomNav");
    expect(layout).not.toContain("phn-nav");
  });

  it("keeps search, notification, profile entry and appearance accessible", () => {
    expect(header).toContain('aria-label="Search"');
    expect(header).toContain("GlobalSearchSurface");
    expect(header).not.toContain("NotificationBell");
    expect(header).toContain('aria-label="Open WAKILISHA menu"');
    expect(drawer).toContain("Appearance");
    expect(drawer).toContain('to="/settings"');
    expect(drawer).toContain("data-wk-appearance-controls");
    expect(drawer).toContain("Profile");
  });
});
