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
      "const scrollChrome = useScrollDirection();",
    );
    expect(layout).toContain(
      "<MobileTopBar",
    );
    expect(layout).toContain(
      "scrollVisible={scrollChrome.topVisible}",
    );
    expect(layout).toContain(
      "scrollVisible={scrollChrome.visible}",
    );
  });

  it("keeps top chrome transient while bottom navigation keeps the shared scroll signal", () => {
    expect(layout).toContain(
      "scrollChrome.topVisible",
    );
    expect(layout).toContain(
      "scrollChrome.visible",
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

  it("keeps top chrome out of content flow and leaves its middle empty", () => {
    expect(topBar).toContain(
      "pointer-events-none fixed inset-x-0 top-0",
    );
    expect(topBar).not.toContain("sectionLabel");
    expect(topBar).not.toContain("{label}");
    expect(topBar).not.toContain(
      "left-1/2 top-1/2",
    );
  });
});
