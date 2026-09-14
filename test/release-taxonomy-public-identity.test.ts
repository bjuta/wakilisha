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

  it("gives every resolvable Release a dedicated Release detail page", () => {
    expect(hasDedicatedPublicReleasePage(0)).toBe(false);
    expect(hasDedicatedPublicReleasePage(1)).toBe(true);
    expect(hasDedicatedPublicReleasePage(2)).toBe(true);
    expect(hasDedicatedPublicReleasePage(7)).toBe(true);
  });

  it("keeps Singles, EPs, and Albums on Release detail routes", () => {
    for (const fixture of [
      { slug: "nervous", trackCount: 1 },
      { slug: "two-track-project", trackCount: 2 },
      { slug: "seven-track-project", trackCount: 7 },
    ]) {
      expect(
        releaseUrl({
          slug: fixture.slug,
          artist: "Artist",
          artistSlug: "artist",
          trackCount: fixture.trackCount,
        }),
      ).toBe(`/releases/artist/${fixture.slug}`);
    }
  });
});
