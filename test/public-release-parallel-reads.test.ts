import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public Release independent query concurrency", () => {
  const source = readFileSync("supabase/functions/public-content-read/index.ts", "utf8");
  const start = source.indexOf('else if (path.startsWith("/releases/"))');
  const region = source.slice(start, start + 19000);
  it("reads Release membership and Release Artist credits concurrently", () => {
    expect(region).toContain("const [{ data: releaseTracks }, { data: releaseArtists }] = await Promise.all([");
    expect(region).toContain('.from("registry_release_tracks")');
    expect(region).toContain('.from("registry_release_artists")');
  });
  it("reads canonical Tracks and ordered Track Artist credits concurrently", () => {
    expect(region).toContain("const [{ data: tracks }, { data: trackArtistRows }] = await Promise.all([");
    expect(region).toContain('.from("registry_track_artists")');
    expect(region).toContain("const trackById = new Map");
  });
});
