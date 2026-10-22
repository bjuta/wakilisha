import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const topBar = readFileSync("src/components/mobile/MobileTopBar.tsx", "utf8");
const drawer = readFileSync("src/components/mobile/MobileAccountDrawer.tsx", "utf8");
const mark = readFileSync("src/components/brand/WakilishaAccountMark.tsx", "utf8");

describe("Signed-out WAKILISHA menu brand", () => {
  it("uses the official wordmark in topbar and menu", () => {
    expect(topBar).toContain("/assets/logos/wakilisha-logo-dark.svg");
    expect(topBar).toContain("/assets/logos/wakilisha-logo-light.svg");
    expect(drawer).toContain("/assets/logos/wakilisha-logo-dark.svg");
    expect(drawer).toContain("/assets/logos/wakilisha-logo-light.svg");
    expect(drawer).toContain("WakilishaAccountMark");
  });
  it("keeps the product bolt and honest sign-in copy", () => {
    expect(mark).toContain('fill="var(--wk-brand-dot)"');
    expect(mark).toContain("M132.91 11.14 125.04 29.87 141 11.9");
    expect(drawer).toContain('"Your people are here."');
    expect(drawer).not.toContain('|| "Listener"');
  });
});
