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

const mark = readFileSync(
  "src/components/brand/WakilishaAccountMark.tsx",
  "utf8",
);

describe("Mobile signed-out WAKILISHA identity", () => {
  it("uses the canonical brand mark in the top-left account control", () => {
    expect(topBar).toContain(
      "WakilishaAccountMark",
    );
    expect(topBar).toContain(
      "authUser.id ? (",
    );
  });

  it("uses the same brand mark in the signed-out account drawer", () => {
    expect(drawer).toContain(
      "WakilishaAccountMark",
    );
    expect(drawer).toContain(
      "signedIn ? (",
    );
  });

  it("uses the canonical WAKILISHA thunderbolt geometry", () => {
    expect(mark).toContain(
      'fill="#84C241"',
    );
    expect(mark).toContain(
      "M132.91 11.14 125.04 29.87 141 11.9",
    );
    expect(mark).toContain(
      "M130.72.18h6.59",
    );
  });

  it("does not restore Listener as the signed-out identity", () => {
    expect(drawer).not.toContain(
      '|| "Listener"',
    );
    expect(drawer).toContain(
      '"Your people are here."',
    );
  });
});
