import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Release detail Artist profile route authority", () => {
  for (const page of [
    "src/pages/releases/detail/page.tsx",
    "src/pages/mobile/releases/detail/page.tsx",
  ]) {
    it(`${page} links only to a resolved canonical Registry Artist`, () => {
      const source = readFileSync(page, "utf8");
      expect(source).not.toContain("slugify(release.artist)");
      expect(source).toContain("canonicalPrimaryArtist");
      expect(source).toContain("artist.isPrimary && artist.artistId && artist.artistType && artist.slug");
      expect(source).toContain("/artists/${canonicalPrimaryArtist.slug}");
    });
  }
});
