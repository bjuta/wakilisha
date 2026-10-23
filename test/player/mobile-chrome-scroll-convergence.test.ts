import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync("src/components/mobile/MobileAppLayout.tsx", "utf8");
const header = readFileSync("src/components/mobile/MobileTopBar.tsx", "utf8");
const drawer = readFileSync("src/components/mobile/MobileAccountDrawer.tsx", "utf8");
const player = readFileSync("src/components/design-system/player/PlayerCompactSurface.tsx", "utf8");

describe("Workbook v4 mobile shell and safe-area convergence", () => {
  it("uses exactly one persistent app header and an accessible start-edge menu", () => {
    expect(layout).toContain("<MobileTopBar");
    expect(header).toContain('data-wk-mobile-app-header="v4"');
    expect(header).toContain('aria-controls="wk-workbook-sidebar"');
    expect(header).toContain('aria-label="Open WAKILISHA menu"');
    expect(drawer).toContain('id="wk-workbook-sidebar"');
    expect(drawer).toContain("navigation.map");
    expect(drawer).toContain("useScrollLock(open)");
  });

  it("shows the one real header on upward scroll, hides on downward scroll, and adds no browser imitation", () => {
    expect(layout).not.toContain("MobileBottomNav");
    expect(layout).not.toContain("useScrollDirection()");
    expect(header).not.toContain("useScrollDirection()");
    expect(header).not.toContain("scrollVisible");
    expect(header).toContain("fixed inset-x-0 top-0");
    expect(header).toContain("bg-transparent");
    expect(header).toContain("h-14");
    expect(header).toContain('data-wk-mobile-header-visible={headerVisible ? "true" : "false"}');
    expect(header).toContain('window.addEventListener("scroll", onScroll, { passive: true })');
    expect(header).toContain('nextDirection < 0 && travelled >= 6');
    expect(header).toContain('nextDirection > 0 && y > 96 && travelled >= 18');
    expect(header).toContain('headerVisible ? "translate-y-0" : "-translate-y-full"');
    expect(header).toContain("motion-reduce:transition-none");
    expect(header).toContain("onFocusCapture");
  });

  it("reserves only the canonical compact player above the bottom safe area", () => {
    expect(layout).toContain("calc(84px + env(safe-area-inset-bottom))");
    expect(player).toContain("calc(env(safe-area-inset-bottom) + 8px)");
    expect(player).not.toContain("calc(52px + max(env(safe-area-inset-bottom)");
  });

  it("keeps Search and notification actions in real app controls", () => {
    expect(header).toContain('aria-label="Search"');
    expect(header).toContain("GlobalSearchSurface");
    expect(header).not.toContain("NotificationBell");
    expect(drawer).toContain("onSearch");
  });
});
