import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const topBar = readFileSync("src/components/mobile/MobileTopBar.tsx", "utf8");
const drawer = readFileSync("src/components/mobile/MobileAccountDrawer.tsx", "utf8");
const musicShell = readFileSync("src/components/music/MusicDesktopShell.tsx", "utf8");

describe("Workbook phone chrome", () => {
  it("contains only Menu and Search; official wordmark lives in the sidebar", () => {
    expect(topBar).toContain('aria-label="Open WAKILISHA menu"');
    expect(topBar).toContain('aria-label="Search"');
    expect(topBar).not.toContain("<img");
    expect(topBar).not.toContain("isMagazineArticle");
    expect(topBar).not.toContain('aria-label="WAKILISHA home"');
    expect(drawer).toContain('/assets/logos/wakilisha-logo-dark.svg');
    expect(drawer).toContain('/assets/logos/wakilisha-logo-light.svg');
    expect(topBar).not.toContain("NotificationBell");
    expect(topBar).not.toContain('aria-label="Account"');
  });
  it("opens the same accessible You surface as desktop", () => {
    expect(topBar).toContain("MobileAccountDrawer");
    expect(topBar).toContain("GlobalSearchSurface");
    expect(drawer).toContain("startInYou");
    expect(drawer).toContain("visibleWakilishaNavigation");
    expect(drawer).toContain("onSearch();");
    expect(drawer).toContain('name="Search"');
  });
  it("keeps a contrast-safe 56px bar without a fake browser strip", () => {
    expect(topBar).toContain("pointer-events-none fixed inset-x-0 top-0");
    expect(topBar).toContain("h-14");
    expect(topBar).toContain("bg-transparent");
    expect(topBar).toContain("text-white");
    expect(topBar).toContain("border-0 bg-transparent");
    expect(topBar).toContain("drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]");
    expect(topBar).not.toContain("bg-[var(--wk-surface)]");
    expect(topBar).not.toContain("mix-blend-difference");
    expect(topBar).not.toContain("brightness-0 invert");
    expect(topBar).not.toContain('<span aria-hidden="true" className="h-11 w-11" />');
    expect(musicShell).not.toContain('className="h-7 max-w-[128px] object-contain object-left"');
    expect(musicShell).toContain("<MobileTopBar />");
    expect(musicShell).not.toContain("<aside");
    expect(drawer).toContain("onSearch();");
    expect(topBar).toContain("pointer-events-auto");
    expect(topBar).not.toContain("backdrop-blur-xl");
    expect(topBar).not.toContain("border-b border-[var(--wk-border)]");
    expect(musicShell).not.toContain("brightness-0 invert");
    expect(musicShell).not.toContain('className="pointer-events-auto min-w-0 flex-1 mix-blend-difference"');
  });
});
