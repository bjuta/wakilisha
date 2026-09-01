import { describe, expect, it } from "vitest";
import {
  hasDedicatedPublicReleasePage,
  releaseTaxonomyFromActiveTrackCount,
  releaseTypeLabelFromActiveTrackCount,
} from "../supabase/functions/_shared/release-taxonomy.ts";
import { releaseUrl } from "../src/utils/releaseUrl.ts";

describe("Release taxonomy and public identity", () => {
  it("classifies Releases from active Track membership count", () => {
    expect(releaseTaxonomyFromActiveTrackCount(1)).toBe("single");
    expect(releaseTaxonomyFromActiveTrackCount(2)).toBe("ep");
    expect(releaseTaxonomyFromActiveTrackCount(6)).toBe("ep");
    expect(releaseTaxonomyFromActiveTrackCount(7)).toBe("album");

    expect(releaseTypeLabelFromActiveTrackCount(1)).toBe("Single");
    expect(releaseTypeLabelFromActiveTrackCount(6)).toBe("EP");
    expect(releaseTypeLabelFromActiveTrackCount(7)).toBe("Album");
  });

  it("gives only multi-track Releases dedicated Release detail pages", () => {
    expect(hasDedicatedPublicReleasePage(1)).toBe(false);
    expect(hasDedicatedPublicReleasePage(2)).toBe(true);
    expect(hasDedicatedPublicReleasePage(7)).toBe(true);
  });

  it("routes a Single card directly to its canonical Track", () => {
    expect(
      releaseUrl({
        slug: "nervous-single",
        artist: "Ywaya Tajiri",
        artistSlug: "ywaya-tajiri",
        trackCount: 1,
        singleTrackSlug: "nervous",
        singleTrackArtistSlug: "ywaya-tajiri",
      }),
    ).toBe("/tracks/ywaya-tajiri/nervous");
  });

  it("keeps EP and Album cards on Release detail routes", () => {
    expect(
      releaseUrl({
        slug: "two-track-project",
        artist: "Artist",
        artistSlug: "artist",
        trackCount: 2,
      }),
    ).toBe("/releases/artist/two-track-project");

    expect(
      releaseUrl({
        slug: "seven-track-project",
        artist: "Artist",
        artistSlug: "artist",
        trackCount: 7,
      }),
    ).toBe("/releases/artist/seven-track-project");
  });
});
