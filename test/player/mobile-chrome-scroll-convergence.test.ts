import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync(
  "src/components/mobile/MobileAppLayout.tsx",
  "utf8",
);

const topBar = readFileSync(
  "src/components/mobile/MobileTopBar.tsx",
  "utf8",
);

describe("Mobile chrome scroll convergence", () => {
  it("owns one scroll-direction signal for the mobile chrome stack", () => {
    expect(
      layout.match(/useScrollDirection\(\)/g)?.length,
    ).toBe(1);
    expect(layout).toContain(
      "const scrollVisible = useScrollDirection();",
    );
    expect(layout).toContain(
      "<MobileTopBar",
    );
    expect(layout).toContain(
      "scrollVisible={scrollVisible}",
    );
    expect(layout).toContain(
      "MobileMiniPlayer scrollVisible={scrollVisible}",
    );
    expect(layout).toContain(
      "MobileBottomNav scrollVisible={scrollVisible}",
    );
  });

  it("moves the collapsed player with the same scroll signal as bottom navigation", () => {
    expect(layout).toContain(
      "function MobileMiniPlayer({ scrollVisible }",
    );
    expect(layout).toContain(
      'visibility: scrollVisible ? "visible" : "hidden"',
    );
    expect(layout).toContain(
      'opacity: scrollVisible ? 1 : 0',
    );
    expect(layout).toContain(
      'transform: scrollVisible ? "translateY(0) translateZ(0)" : "translateY(16px) translateZ(0)"',
    );
    expect(layout).toContain(
      "scrollVisible || moreOpen",
    );
  });

  it("keeps top Search out of persistent chrome while preserving drawer Search", () => {
    expect(topBar).not.toContain(
      'aria-label="Search"',
    );
    expect(topBar).not.toContain(
      '<WkIcon name="Search"',
    );
    expect(topBar).toContain(
      "NotificationBell",
    );
    expect(topBar).toContain(
      "onSearch={() => setSearchOpen(true)}",
    );
  });

  it("does not create another independent top-bar scroll authority", () => {
    expect(topBar).not.toContain(
      "useScrollDirection()",
    );
    expect(topBar).toContain(
      "scrollVisible || searchOpen || accountOpen",
    );
  });

  it("leaves the middle of mobile top chrome empty", () => {
    expect(topBar).not.toContain("sectionLabel");
    expect(topBar).not.toContain("{label}");
    expect(topBar).not.toContain(
      "left-1/2 top-1/2",
    );
  });
});
