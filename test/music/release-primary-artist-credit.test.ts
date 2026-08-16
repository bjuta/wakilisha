import {
  describe,
  expect,
  it,
} from "vitest";
import {
  selectPrimaryReleaseArtistCredit,
} from "../../src/services/publicContent/releaseArtistCredit";

describe(
  "release primary artist resolution",
  () => {
    it(
      "keeps resolved Matata over a later unresolved DJames row when both are marked primary",
      () => {
        const selected =
          selectPrimaryReleaseArtistCredit([
            {
              artistId:
                "0d121663-dc75-43be-ac18-8e37eb52e36a",
              artistNameText:
                "Matata",
              artistSlug:
                "matata",
              isPrimary:
                true,
              creditOrder:
                1,
              confidence:
                90,
            },
            {
              artistId:
                null,
              artistNameText:
                "DJames",
              artistSlug:
                "djames",
              isPrimary:
                true,
              creditOrder:
                2,
              confidence:
                50,
            },
          ]);

        expect(
          selected?.artistNameText,
        ).toBe("Matata");
      },
    );

    it(
      "still prefers a true primary credit over a resolved featured credit",
      () => {
        const selected =
          selectPrimaryReleaseArtistCredit([
            {
              artistId:
                "resolved-feature",
              artistNameText:
                "Featured Artist",
              artistSlug:
                "featured-artist",
              isPrimary:
                false,
              creditOrder:
                1,
              confidence:
                100,
            },
            {
              artistId:
                null,
              artistNameText:
                "Unresolved Primary",
              artistSlug:
                "unresolved-primary",
              isPrimary:
                true,
              creditOrder:
                2,
              confidence:
                50,
            },
          ]);

        expect(
          selected?.artistNameText,
        ).toBe(
          "Unresolved Primary",
        );
      },
    );

    it(
      "uses credit order before confidence among equally resolved primary credits",
      () => {
        const selected =
          selectPrimaryReleaseArtistCredit([
            {
              artistId:
                "artist-b",
              artistNameText:
                "Artist B",
              artistSlug:
                "artist-b",
              isPrimary:
                true,
              creditOrder:
                2,
              confidence:
                100,
            },
            {
              artistId:
                "artist-a",
              artistNameText:
                "Artist A",
              artistSlug:
                "artist-a",
              isPrimary:
                true,
              creditOrder:
                1,
              confidence:
                80,
            },
          ]);

        expect(
          selected?.artistNameText,
        ).toBe("Artist A");
      },
    );

    it(
      "uses higher confidence only when primary, canonical status, and order tie",
      () => {
        const selected =
          selectPrimaryReleaseArtistCredit([
            {
              artistId:
                null,
              artistNameText:
                "Lower Confidence",
              artistSlug:
                "lower-confidence",
              isPrimary:
                true,
              creditOrder:
                1,
              confidence:
                50,
            },
            {
              artistId:
                null,
              artistNameText:
                "Higher Confidence",
              artistSlug:
                "higher-confidence",
              isPrimary:
                true,
              creditOrder:
                1,
              confidence:
                90,
            },
          ]);

        expect(
          selected?.artistNameText,
        ).toBe(
          "Higher Confidence",
        );
      },
    );

    it(
      "ignores empty and unknown artist names",
      () => {
        const selected =
          selectPrimaryReleaseArtistCredit([
            {
              artistId:
                "unknown",
              artistNameText:
                "Unknown artist",
              artistSlug:
                "",
              isPrimary:
                true,
              creditOrder:
                1,
              confidence:
                100,
            },
          ]);

        expect(selected).toBeNull();
      },
    );
  },
);
