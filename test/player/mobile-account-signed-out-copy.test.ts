import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const drawer = readFileSync(
  "src/components/mobile/MobileAccountDrawer.tsx",
  "utf8",
);

describe("Mobile signed-out account copy", () => {
  it("welcomes signed-out people instead of assigning the Listener role", () => {
    expect(drawer).toContain(
      ': "Your people are here."',
    );
    expect(drawer).not.toContain(
      '|| "Listener"',
    );
  });

  it("keeps the sign-in support line underneath the welcome message", () => {
    expect(drawer).toContain(
      'signedIn ? "WAKILISHA listener" : "Sign in to keep your place"',
    );
  });

  it("uses the WAKILISHA brand mark while signed out", () => {
    expect(drawer).toContain(
      "WakilishaAccountMark",
    );
    expect(drawer).toContain(
      "signedIn ? (",
    );
  });
});
