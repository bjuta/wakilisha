import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(path, "utf8");

const music = read("src/pages/music/page.tsx");
const player = read(
  "src/components/design-system/player/PlayerFullSurface.tsx",
);
const contribution = read(
  "src/pages/tracks/lyrics/contribute/page.tsx",
);

describe("Lyrics Registry identity convergence", () => {
  it("preserves Registry Track identity in Music release playback", () => {
    expect(music).toContain("registryTrackId:");
    expect(music).toContain("track.id");
  });

  it("carries Registry Track identity into Lyrics contribution navigation", () => {
    expect(player).toContain("lyricsContributionQuery");
    expect(player).toContain("?track_id=");
    expect(player).toContain(
      "currentTrack.registryTrackId",
    );
  });

  it("hydrates a carried Track ID through public RPC authority before Edge fallback", () => {
    expect(contribution).toContain('get("track_id")');
    expect(contribution).toContain(
      '"get_tracks_by_ids"',
    );
    expect(contribution).toContain(
      '"registry_resolve_artist_slug_for_public"',
    );
    expect(contribution).toContain(
      "const request = releaseSlug",
    );

    const rpcHydration = contribution.indexOf(
      '"get_tracks_by_ids"',
    );
    const edgeFallback = contribution.indexOf(
      "const request = releaseSlug",
    );

    expect(rpcHydration).toBeGreaterThan(-1);
    expect(edgeFallback).toBeGreaterThan(rpcHydration);
  });

  it("keeps Edge reading as fallback rather than the primary carried-ID path", () => {
    const trackIdRead = contribution.indexOf(
      'get("track_id")',
    );
    const edgeFallback = contribution.indexOf(
      "const request = releaseSlug",
    );

    expect(trackIdRead).toBeGreaterThan(-1);
    expect(edgeFallback).toBeGreaterThan(trackIdRead);
  });
});
