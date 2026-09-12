import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  scanWakilishaUiChrome,
  scanWakilishaUiChromeSource,
} from "../../scripts/control-plane/verify-wakilisha-ui-chrome.mjs";

describe("WAKILISHA no-browser-chrome control plane", () => {
  it("keeps the native chrome ledger explicit and machine-enforced", () => {
    const baseline = JSON.parse(
      fs.readFileSync(
        "scripts/control-plane/wakilisha-ui-chrome-baseline.json",
        "utf8",
      ),
    ) as {
      version: number;
      violations: Record<string, Record<string, number>>;
    };
    const summary: Record<string, Record<string, number>> = {};

    for (const issue of scanWakilishaUiChrome()) {
      summary[issue.path] ??= {};
      summary[issue.path][issue.kind] =
        (summary[issue.path][issue.kind] ?? 0) + 1;
    }

    expect(baseline.version).toBe(1);
    expect(baseline.violations).toBeTypeOf("object");
    expect(summary).toEqual(baseline.violations);
  });
  it("pins the approved React Aria interaction runtime exactly", () => {
    const packageJson = JSON.parse(
      fs.readFileSync("package.json", "utf8"),
    ) as {
      dependencies?: Record<string, string>;
    };
    const packageLock = JSON.parse(
      fs.readFileSync("package-lock.json", "utf8"),
    ) as {
      packages?: Record<string, { version?: string }>;
    };

    expect(packageJson.dependencies?.["react-aria-components"]).toBe("1.21.1");
    expect(
      packageLock.packages?.["node_modules/react-aria-components"]?.version,
    ).toBe("1.21.1");
  });

  it("distinguishes React components from intrinsic browser elements", () => {
    const issues = scanWakilishaUiChromeSource(`
      function Probe() {
        return (
          <>
            <Dialog />
            <Input type="date" />
            <Select />
            <DataList />
            <Audio controls />
            <Video controls />
            <dialog />
            <input type="date" />
            <select />
            <datalist />
            <audio controls />
            <video controls />
          </>
        );
      }
    `);

    expect(issues.map((issue) => issue.kind)).toEqual([
      "native-dialog-element",
      "native-input-date",
      "native-select",
      "native-datalist",
      "native-media-controls",
      "native-media-controls",
    ]);
  });

});
