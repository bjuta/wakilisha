import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(path, "utf8");

const migration = read(
  "supabase/migrations/20260823181332_public_artist_search_authority.sql",
);
const verifier = read(
  "scripts/control-plane/verify-public-artist-search-authority.sql",
);
const artistHook = read(
  "src/hooks/useArtistSearchData.ts",
);
const trackHook = read(
  "src/hooks/useTrackSearchData.ts",
);
const globalSearch = read(
  "src/components/search/GlobalSearchSurface.tsx",
);

describe("Public Artist Search authority", () => {
  it("keeps anonymous Artist Search behind a narrow RPC", () => {
    expect(migration).toContain(
      "get_public_registry_artists_for_search",
    );
    expect(migration).toContain(
      "security definer",
    );
    expect(migration).toContain(
      "to anon, authenticated",
    );
    expect(artistHook).toContain(
      '"get_public_registry_artists_for_search"',
    );
    expect(artistHook).not.toContain(
      '.from("registry_artists")',
    );
  });

  it("removes the same direct Artist table read from Track search enrichment", () => {
    expect(trackHook).toContain(
      '"get_public_registry_artists_for_search"',
    );
    expect(trackHook).not.toContain(
      '.from("registry_artists")',
    );
  });

  it("does not eagerly load quick Search datasets while the overlay is closed", () => {
    expect(globalSearch).toContain(
      "useArtistSearchData(open)",
    );
    expect(globalSearch).toContain(
      "useTrackSearchData(open)",
    );
  });

  it("ships a permanent verifier that preserves the table boundary", () => {
    expect(verifier).toContain(
      "PUBLIC_ARTIST_SEARCH_AUTHORITY_PASS",
    );
    expect(verifier).toContain(
      "not has_table_privilege",
    );
  });
});
