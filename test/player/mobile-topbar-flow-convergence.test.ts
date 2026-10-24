import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync("src/components/mobile/MobileAppLayout.tsx", "utf8");
const header = readFileSync("src/components/mobile/MobileTopBar.tsx", "utf8");
const drawer = readFileSync("src/components/mobile/MobileAccountDrawer.tsx", "utf8");
const desktop = readFileSync("src/components/music/MusicDesktopShell.tsx", "utf8");

describe("Workbook v4 shared public header and drawer flow", () => {
  it("shares one Menu and private You flow across viewport classes", () => {
    expect(desktop).toContain("<MobileTopBar />");
    expect(desktop).not.toContain("<aside");
    expect(header).toContain("setAccountOpen(true)");
    expect(header).toContain("MobileAccountDrawer");
    expect(drawer).toContain("setYouOpen(true)");
    expect(drawer).toContain("visibleWakilishaNavigation");
  });

  it("shows a theme-contrasting logo-free header and reveals it on upward scroll", () => {
    expect(header).toContain("pointer-events-none fixed inset-x-0 top-0");
    expect(header).toContain("bg-transparent");
    expect(header).toContain("text-[var(--wk-text)]");
    expect(header).toContain("bg-[var(--wk-surface)]");
    expect(header).not.toContain("mix-blend-difference");
    expect(header).not.toContain("<img");
    expect(header).not.toContain("useTheme");
    expect(drawer).toContain("/assets/logos/wakilisha-logo-light.svg");
    expect(header).not.toContain("brightness-0 invert");
    expect(header).toContain('headerVisible ? "translate-y-0" : "-translate-y-full"');
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
