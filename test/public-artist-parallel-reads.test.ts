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
    // Publication verification must run inside the Chart promise, not before
    // both reads begin; the Artist-name fallback must reuse that allowlist.
    const chartStart = artist.indexOf("const [releases, chartResult] = await Promise.all([");
    const chartEnd = artist.indexOf("const allGenres = curatedGenres;", chartStart);
    expect(chartStart).toBeGreaterThan(-1);
    expect(chartEnd).toBeGreaterThan(chartStart);
    const chartPromise = artist.slice(chartStart, chartEnd);
    expect(chartPromise).toContain("publishedChartIds = await loadPublishedChartEditionIds(supabase)");
    expect(chartPromise).toContain('in("edition_id", publishedChartIds)');
    expect(artist).toContain("if (publishedChartIds.length > 0)");
    expect(artist).toContain('ilike("artist_name", displayName).in("edition_id", publishedChartIds)');
    const preflight = artist.slice(
      artist.indexOf("// Discography and initial chart evidence"),
      chartStart,
    );
    expect(preflight).not.toContain("await loadPublishedChartEditionIds(supabase)");
  });
});
