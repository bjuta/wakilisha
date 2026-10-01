import { describe, expect, it } from "vitest";
import { splitMusicArtistDisplayNames } from "@/utils/musicArtistDisplay";

describe("splitMusicArtistDisplayNames", () => {
  it("removes parentheses around featured Artist credits", () => {
    expect(
      splitMusicArtistDisplayNames(
        "Primary Artist (feat. Featured A, Featured B)",
      ),
    ).toEqual([
      "Primary Artist",
      "Featured A",
      "Featured B",
    ]);
  });

  it("removes brackets around featured Artist credits", () => {
    expect(
      splitMusicArtistDisplayNames(
        "Primary Artist [feat. Featured A, Featured B]",
      ),
    ).toEqual([
      "Primary Artist",
      "Featured A",
      "Featured B",
    ]);
  });

  it("keeps punctuation that belongs inside an Artist name", () => {
    expect(
      splitMusicArtistDisplayNames(
        "Macklemore & Ryan Lewis",
      ),
    ).toEqual([
      "Macklemore & Ryan Lewis",
    ]);
  });

  it("deduplicates repeated Artist names without changing display case", () => {
    expect(
      splitMusicArtistDisplayNames(
        "Primary Artist feat. Featured A, featured a",
      ),
    ).toEqual([
      "Primary Artist",
      "Featured A",
    ]);
  });
});
