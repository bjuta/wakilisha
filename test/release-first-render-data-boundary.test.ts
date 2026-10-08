import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Release first render public data boundary", () => {
  it("uses the single canonical Edge aggregate before any browser Registry fan-out", () => {
    const src = readFileSync("src/services/publicContent/client.ts", "utf8");
    const method = src.slice(src.indexOf("export async function getRelease("),src.indexOf("\nexport async function listGenres(",src.indexOf("export async function getRelease(")));
    expect(method.indexOf("safeApiGet")).toBeGreaterThan(-1);
    expect(method.indexOf("safeApiGet")).toBeLessThan(method.indexOf("getReleaseFromRegistry"));
    expect(method).toContain("if (!result.release)");
    expect(method).toContain("result.release.musicProvenance");
    expect(method).toContain("encodeURIComponent(artistSlug)");
  });
});
