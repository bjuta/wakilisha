import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { PositiveReadCoalescer } from "../../src/services/publicContent/positiveReadCoalescer";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

type Value = { records: string[] };

describe("public Discography DB read coalescing", () => {
  it("shares concurrent work and caches only a nonempty successful response", async () => {
    const reads = new PositiveReadCoalescer<string, Value>((v) => v.records.length > 0);
    let fetches = 0;
    const pending = deferred<Value>();
    const reader = () => { fetches += 1; return pending.promise; };
    const a = reads.read("artist", reader);
    const b = reads.read("artist", reader);

    expect(a).toBe(b);
    await Promise.resolve();
    expect(fetches).toBe(1);

    const value = { records: ["recording"] };
    pending.resolve(value);
    expect(await a).toBe(value);
    expect(await reads.read("artist", reader)).toBe(value);
    expect(fetches).toBe(1);
  });

  it("does not cache empty responses or failures and permits a later retry", async () => {
    const reads = new PositiveReadCoalescer<string, Value>((v) => v.records.length > 0);
    let calls = 0;
    await reads.read("artist", async () => { calls++; return { records: [] }; });
    await reads.read("artist", async () => { calls++; return { records: ["published"] }; });
    expect(calls).toBe(2);

    await expect(reads.read("other", async () => { throw new Error("503"); }))
      .rejects.toThrow("503");
    expect((await reads.read("other", async () => ({ records: ["recovered"] }))).records)
      .toEqual(["recovered"]);
  });

  it("never caches an obsolete in-flight response after publication invalidation", async () => {
    const reads = new PositiveReadCoalescer<string, Value>((v) => v.records.length > 0);
    const before = deferred<Value>();
    const after = deferred<Value>();

    const stale = reads.read("artist", () => before.promise);
    reads.clear("artist");
    const fresh = reads.read("artist", () => after.promise);

    after.resolve({ records: ["new-authority"] });
    expect((await fresh).records).toEqual(["new-authority"]);
    before.resolve({ records: ["withdrawn"] });
    expect((await stale).records).toEqual(["withdrawn"]);
    const current = await reads.read("artist", async () => {
      throw new Error("cached latest should win");
    });
    expect(current.records).toEqual(["new-authority"]);
  });

  it("keeps network freshness and removes unique cache-busting on public Discography", () => {
    const source = fs.readFileSync("src/services/publicContent/client.ts", "utf8");
    const start = source.indexOf("async function fetchDiscographyFromEdge(");
    const end = source.indexOf("export async function getArtistDiscographyFromRegistry(", start);
    expect(start).toBeGreaterThan(0);
    const section = source.slice(start, end);
    expect(section).toContain("discographyReads.read(artistSlug");
    expect(section).toContain('cache: "no-store"');
    expect(section).not.toContain("Date.now()");
    expect(section).not.toContain("?t=");
    expect(section).toContain("discographyReads.clear(artistSlug)");
  });
});
