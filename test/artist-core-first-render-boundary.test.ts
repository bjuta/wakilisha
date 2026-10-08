import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public Artist first-render authority", () => {
  const edge = readFileSync("supabase/functions/public-content-read/index.ts", "utf8");
  const page = readFileSync("src/pages/artists/detail/page.tsx", "utf8");
  const client = readFileSync("src/services/publicContent/client.ts", "utf8");
  const hero = readFileSync("src/pages/artists/detail/components/ArtistDetailHero.tsx", "utf8");

  it("serves real canonical identity before optional catalogue queries", () => {
    const block = edge.slice(edge.indexOf('else if (path.startsWith("/artists/"))'));
    expect(block.indexOf('if (url.searchParams.get("view") === "core")')).toBeGreaterThan(block.indexOf('if (!artist) return jsonResponse'));
    expect(block.indexOf('if (url.searchParams.get("view") === "core")')).toBeLessThan(block.indexOf("getArtistDiscography(supabase"));
    expect(block).toContain('id: String(artist.id), slug: String(artist.slug), name: displayName');
    expect(block).toContain('discographySource: "deferred"');
  });

  it("allows real profile identity to appear before slow music data", () => {
    expect(client).toContain('options.core ? "?view=core" : ""');
    expect(client).toContain("if (options.core) return mapped as PublicArtistDetail");
    expect(page).toContain('getArtist(slug, { core: true })');
    expect(page).toContain('setStatus("core")');
    expect(page).toContain('showMusicStats={false}');
    expect(page).toContain('navigate(`/artists/${core.slug}`, { replace: true })');
  });

  it("does not invent zero music counts while full catalogue is pending", () => {
    expect(hero).toContain("showMusicStats = true");
    expect(hero).toContain("showMusicStats && <div");
  });
});
