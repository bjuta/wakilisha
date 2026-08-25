import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const releaseHero = readFileSync(
  "src/pages/releases/detail/components/ReleaseDetailHero.tsx",
  "utf8",
);
const releaseTracklist = readFileSync(
  "src/pages/releases/detail/components/ReleaseTracklist.tsx",
  "utf8",
);
const publicContentRead = readFileSync(
  "supabase/functions/public-content-read/index.ts",
  "utf8",
);

describe("canonical media runtime acceptance repair", () => {
  it("preserves canonical Release identity when playback begins from the Release hero", () => {
    expect(releaseHero).toContain("releaseId: release.id,");
    expect(
      releaseHero.match(/releaseId: release\.id,/g) ?? [],
    ).toHaveLength(1);
  });

  it("preserves canonical Release identity in both Release tracklist queue paths", () => {
    expect(
      releaseTracklist.match(/releaseId: release\.id,/g) ?? [],
    ).toHaveLength(2);
  });

  it("aligns Artist music discovery with the public Track routability contract", () => {
    expect(publicContentRead).toContain(
      'const PUBLIC_MUSIC_RELATIONSHIP_STATUSES = ["active", "needs_review", "draft"];',
    );
    expect(publicContentRead).toContain(
      "async function getArtistPublicTracksFromCredits(",
    );
    expect(publicContentRead).toContain(
      '.in("status", PUBLIC_MUSIC_RELATIONSHIP_STATUSES)',
    );
    expect(publicContentRead).toContain(
      "const publicCreditTracks = await getArtistPublicTracksFromCredits(supabase, slug);",
    );
    expect(publicContentRead).toContain(
      "publicCreditTracks.trackCount,",
    );
    expect(publicContentRead).toContain(
      "publicCreditTracks.topSongs;",
    );
  });
});
