import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync("src/components/mobile/MobileAppLayout.tsx", "utf8");
const header = readFileSync("src/components/mobile/MobileTopBar.tsx", "utf8");
const drawer = readFileSync("src/components/mobile/MobileAccountDrawer.tsx", "utf8");

describe("Workbook v4 mobile header and sidebar flow", () => {
  it("places the 56px application header in normal content flow", () => {
    expect(header).toContain("sticky top-0");
    expect(header).toContain("h-14");
    expect(layout).toContain("<MobileTopBar");
    expect(header).not.toContain("pointer-events-none fixed inset-x-0 top-0");
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
    expect(header).toContain('aria-label="Account"');
    expect(drawer).toContain("Appearance");
    expect(drawer).toContain('to="/settings"');
    expect(drawer).toContain("Profile");
  });
});
