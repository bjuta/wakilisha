import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public Artist discography batching authority", () => {
  const source = readFileSync("supabase/functions/public-content-read/index.ts", "utf8");
  const start = source.indexOf('else if (path.endsWith("/discography")');
  const end = source.indexOf('else if (path === "/authors"', start);
  const handler = source.slice(start, end);

  it("fetches Track and credit graph in bounded chunks, not inside each Release loop", () => {
    expect(handler).toContain("const batchDiscographyTracks = async");
    expect(handler).toContain("offset += 100");
    expect(handler).toContain('select("release_id, track_id, track_number, disc_number")');
    expect(handler).toContain('select("track_id, artist_slug, artist_name_text, is_primary, credit_order")');
    expect(handler).toContain("const renderDiscographyTracks");
    expect(handler).not.toContain('.eq("release_id", rel.id)');
    expect(handler).not.toContain(".find((tr: any) => tr.id === rt.track_id)");
  });

  it("retains featured appearances, MainArtist selection, and ordered Track membership", () => {
    expect(handler).toContain("featuredReleaseIdsFromBoth");
    expect(handler).toContain("primaryByRelease");
    expect(handler).toContain("credit.is_primary");
    expect(handler).toContain('order("disc_number").order("track_number")');
    expect(handler).toContain("trackCount: tracks.length");
    expect(handler).toContain("appearsOn");
  });
});
