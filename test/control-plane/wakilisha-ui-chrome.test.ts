import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { scanWakilishaUiChrome } from "../../scripts/control-plane/verify-wakilisha-ui-chrome.mjs";

describe("WAKILISHA no-browser-chrome control plane", () => {
  it("keeps the native chrome ledger explicit and machine-enforced", () => {
    const baseline = JSON.parse(
      fs.readFileSync(
        "scripts/control-plane/wakilisha-ui-chrome-baseline.json",
        "utf8",
      ),
    );

    expect(baseline.version).toBe(1);
    expect(baseline.violations).toBeTypeOf("object");
    expect(scanWakilishaUiChrome().length).toBeGreaterThan(0);
  });
});
