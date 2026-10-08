import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public Artist aliases and Recording route authority", () => {
  it("resolves only one active alias to one active canonical Artist", () => {
    const src = readFileSync("supabase/functions/public-content-read/index.ts", "utf8");
    const artistHandler = src.slice(src.indexOf('else if (path.startsWith("/artists/"))'));
    expect(artistHandler).toContain('.from("registry_artist_aliases")');
    expect(artistHandler).toContain('.eq("alias_slug", slug)');
    expect(artistHandler).toContain('aliases?.length === 1');
    expect(artistHandler).toContain('.eq("id", aliases[0].canonical_artist_id)');
    expect(artistHandler).toContain('.eq("status", "active")');
    expect(artistHandler).toContain('if (!artist) return jsonResponse({ data: null }, origin, 404)');
  });
  it("replaces the inbound alias URL with the canonical Artist profile route", () => {
    const page = readFileSync("src/pages/artists/detail/page.tsx", "utf8");
    expect(page).toContain('core.slug !== slug');
    expect(page).toContain('full.slug !== slug');
    expect(page).toContain('navigate(`/artists/${core.slug}`, { replace: true })');
    expect(page).toContain('navigate(`/artists/${full.slug}`, { replace: true })');
  });
  it("does not derive Search or Artist-chart Recording routes from display names", () => {
    const search = readFileSync("src/pages/search/page.tsx", "utf8");
    const chart = readFileSync("src/pages/artists/detail/components/ArtistChartSection.tsx", "utf8");
    expect(search).not.toContain("slugify(track.artist)");
    expect(search).not.toContain("slugify(entry.artist)");
    expect(chart).not.toContain("slugify(track.artist)");
    expect(chart).toContain("artistSlug ? [artistSlug] : []");
    expect(search).toContain("entry.artistSlug");
    const chartSearch = readFileSync("src/hooks/useChartSearchData.ts", "utf8");
    expect(chartSearch).toContain("mainArtistSlugByTrack");
    expect(chartSearch).toContain('from("registry_track_artists")');
    expect(chartSearch).toContain('from("registry_artists")');
  });
});
