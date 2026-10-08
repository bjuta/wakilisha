import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public Artist full-profile query concurrency", () => {
  const source = readFileSync("supabase/functions/public-content-read/index.ts", "utf8");
  const artist = source.slice(source.indexOf('else if (path.startsWith("/artists/"))'),source.indexOf('else if (path === "/artists"',source.indexOf('else if (path.startsWith("/artists/"))')));
  it("executes four independent canonical reads concurrently without changing provenance admission", () => {
    expect(artist).toContain("const [curatedGenresByArtistId, curatedTopSongs, publicCreditTracks, provenanceResult] = await Promise.all([");
    expect(artist).toContain("getArtistPublicTracksFromCredits(supabase, artist.slug)");
    expect(artist).toContain('supabase.rpc("get_public_artist_music_provenance_v1", { p_artist_id: artist.id })');
    expect(artist).toContain("const { data: musicProvenanceRaw, error: musicProvenanceError } = provenanceResult");
  });
  it("loads discography and initial charts concurrently without dropping fallback", () => {
    expect(artist).toContain("const [releases, chartResult] = await Promise.all([");
    expect(artist).toContain("const { data: chartEntriesBySlug } = chartResult");
    expect(artist).toContain("if (chartEntries.length === 0 && displayName)");
  });
});
