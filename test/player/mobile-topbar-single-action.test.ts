import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const topBar = readFileSync("src/components/mobile/MobileTopBar.tsx", "utf8");
const drawer = readFileSync("src/components/mobile/MobileAccountDrawer.tsx", "utf8");
const musicShell = readFileSync("src/components/music/MusicDesktopShell.tsx", "utf8");

describe("Workbook phone chrome", () => {
  it("contains only menu, real wordmark, and search", () => {
    expect(topBar).toContain('aria-label="Open WAKILISHA menu"');
    expect(topBar).toContain('aria-label="Search"');
    expect(topBar).toContain('/assets/logos/wakilisha-logo-dark.svg');
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
  it("floats a transparent 56px bar above real content without a fake browser strip", () => {
    expect(topBar).toContain("pointer-events-none fixed inset-x-0 top-0");
    expect(topBar).toContain("h-14");
    expect(topBar).toContain("bg-transparent");
    expect(topBar).toContain("mix-blend-difference");
    expect(topBar).not.toContain("brightness-0 invert");
    expect(topBar).toContain('className="pointer-events-auto flex min-w-0 flex-1 justify-center"');
    expect(topBar).toContain("pointer-events-auto");
    expect(topBar).not.toContain("backdrop-blur-xl");
    expect(topBar).not.toContain("border-b border-[var(--wk-border)]");
    expect(musicShell).not.toContain("brightness-0 invert");
    expect(musicShell).not.toContain('className="pointer-events-auto min-w-0 flex-1 mix-blend-difference"');
  });
});
