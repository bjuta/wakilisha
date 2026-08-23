import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layoutSource = readFileSync(
  "src/components/mobile/MobileAppLayout.tsx",
  "utf8",
);

const topBar = readFileSync(
  "src/components/mobile/MobileTopBar.tsx",
  "utf8",
);

const app = layoutSource.slice(
  layoutSource.indexOf(
    "export function MobileAppLayout()",
  ),
);

const nonAuthShell = app.slice(
  app.indexOf(
    'className="wk-app-shell min-h-[100dvh] flex flex-col relative"',
  ),
);

describe("Mobile top bar flow convergence", () => {
  it("lets the top bar own real document space before page content", () => {
    expect(topBar).toContain(
      "pointer-events-none sticky top-0",
    );
    expect(topBar).not.toContain(
      "pointer-events-none fixed",
    );
    expect(nonAuthShell).not.toContain(
      "data-mobile-top-chrome-clearance",
    );

    const topBarIndex =
      nonAuthShell.indexOf("MobileTopBar");
    const mainIndex =
      nonAuthShell.indexOf(
        '<main className="flex-1">',
      );

    expect(topBarIndex).toBeGreaterThan(-1);
    expect(mainIndex).toBeGreaterThan(topBarIndex);
  });

  it("uses one scroll signal for top bar, mini player, and bottom navigation", () => {
    expect(
      layoutSource.match(
        /useScrollDirection\(\)/g,
      )?.length,
    ).toBe(1);

    expect(nonAuthShell).toContain(
      "scrollVisible={scrollVisible}",
    );
    expect(layoutSource).toContain(
      "MobileMiniPlayer scrollVisible={scrollVisible}",
    );
    expect(layoutSource).toContain(
      "MobileBottomNav scrollVisible={scrollVisible}",
    );
    expect(topBar).not.toContain(
      "useScrollDirection()",
    );
    expect(topBar).toContain(
      "scrollVisible || searchOpen || accountOpen",
    );
  });

  it("keeps persistent mobile top chrome to account left and Notifications right", () => {
    expect(topBar).toContain(
      "Open account menu",
    );
    expect(topBar).toContain(
      "NotificationBell",
    );
    expect(topBar).not.toContain(
      "sectionLabel",
    );
    expect(topBar).not.toContain(
      "{label}",
    );
    expect(topBar).not.toContain(
      'aria-label="Search"',
    );
  });

  it("keeps Search available through the account drawer", () => {
    expect(topBar).toContain(
      "MobileAccountDrawer",
    );
    expect(topBar).toContain(
      "onSearch={() => setSearchOpen(true)}",
    );
    expect(topBar).toContain(
      "GlobalSearchSurface",
    );
  });
});
