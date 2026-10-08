import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("desktop Release first content paint", () => {
  const source = readFileSync("src/pages/releases/detail/page.tsx", "utf8");
  it("shows canonical Release data without waiting for the global catalogue", () => {
    expect(source).toContain("getRelease(artistSlug, releaseSlug)");
    expect(source).toContain("setRelease(data);\n        setStatus(\"ready\");");
    expect(source).toContain("void listReleases()");
    expect(source).not.toContain("await Promise.all([\n        getRelease(artistSlug, releaseSlug),\n        listReleases(),");
  });
  it("never replaces a valid Release with an error if related discovery fails", () => {
    expect(source).toContain('console.warn("Related Release discovery unavailable:", error)');
    expect(source).toContain("if (!alive) return;");
    expect(source).toContain("return () => { alive = false; };");
  });
});
