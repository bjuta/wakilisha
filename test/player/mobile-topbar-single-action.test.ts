import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const topBar = readFileSync(
  "src/components/mobile/MobileTopBar.tsx",
  "utf8",
);

const drawer = readFileSync(
  "src/components/mobile/MobileAccountDrawer.tsx",
  "utf8",
);

describe("Mobile top bar single action grammar", () => {
  it("reserves the shell top-right slot for Notifications", () => {
    expect(topBar).toContain("NotificationBell");
    expect(topBar).not.toContain('aria-label="Search"');
    expect(topBar).not.toContain('<WkIcon name="Search"');
  });

  it("keeps Search in the account drawer instead of duplicating it in top chrome", () => {
    expect(topBar).toContain(
      "onSearch={() => setSearchOpen(true)}",
    );
    expect(topBar).toContain("GlobalSearchSurface");
    expect(drawer).toContain("onSearch();");
    expect(drawer).toContain('name="Search"');
    expect(drawer).toContain("<span>Search</span>");
  });

  it("keeps the mobile top chrome floating on the shared scroll signal", () => {
    expect(topBar).not.toContain("useScrollDirection()");
    expect(topBar).toContain(
      "scrollVisible || searchOpen || accountOpen",
    );
    expect(topBar).toContain("translateY(-16px)");
    expect(topBar).toContain(
      "pointer-events-none fixed inset-x-0 top-0",
    );
  });

  it("does not repeat the page title in mobile top chrome", () => {
    expect(topBar).not.toContain("sectionLabel");
    expect(topBar).not.toContain("{label}");
    expect(topBar).not.toContain(
      "left-1/2 top-1/2",
    );
  });
});
