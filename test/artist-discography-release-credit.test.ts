import {
  describe,
  expect,
  it,
} from "vitest";

import {
  albumArtistCreditIncludesArtist,
  resolveReleaseArtistCredit,
} from "../supabase/functions/ingest-artist-discography/releaseArtistCredit.ts";

describe("artist discography release credits", () => {
  it("matches the current Artist by exact multi-Artist credit token", () => {
    expect(
      albumArtistCreditIncludesArtist(
        "Matata & DJames",
        "Matata",
      ),
    ).toBe(true);

    expect(
      albumArtistCreditIncludesArtist(
        "Matata & DJames",
        "DJames",
      ),
    ).toBe(true);
  });

  it("does not use substring matching for the current Artist", () => {
    expect(
      albumArtistCreditIncludesArtist(
        "The Matata Band",
        "Matata",
      ),
    ).toBe(false);
  });

  it("keeps the ingested current Artist primary when Apple credits them", () => {
    expect(
      resolveReleaseArtistCredit(
        "current_artist",
        true,
      ),
    ).toEqual({
      role: "primary_artist",
      is_primary: true,
      is_featured: false,
    });
  });

  it("keeps an ingested current Artist featured when Apple does not credit them as primary", () => {
    expect(
      resolveReleaseArtistCredit(
        "current_artist",
        false,
      ),
    ).toEqual({
      role: "featured_artist",
      is_primary: false,
      is_featured: true,
    });
  });

  it("keeps discovered Apple relationship Artists featured by default", () => {
    expect(
      resolveReleaseArtistCredit(
        "discovered_album_artist",
      ),
    ).toEqual({
      role: "featured_artist",
      is_primary: false,
      is_featured: true,
    });
  });

  it("preserves explicit admin-selected co-primary Artists", () => {
    expect(
      resolveReleaseArtistCredit(
        "explicit_additional_primary",
      ),
    ).toEqual({
      role: "primary_artist",
      is_primary: true,
      is_featured: false,
    });
  });
});
