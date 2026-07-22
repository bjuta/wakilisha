import {
  describe,
  expect,
  it,
} from "vitest";

import {
  resolveExistingAppleRelease,
  type ExistingAppleRelease,
} from "../supabase/functions/ingest-artist-discography/releaseIdentity";

function release(
  overrides: Partial<ExistingAppleRelease>,
): ExistingAppleRelease {
  return {
    id: "release-default",
    slug: "balance-single",
    title: "Balance - Single",
    upc: null,
    metadata: null,
    ...overrides,
  };
}

function maps(
  releases: ExistingAppleRelease[],
) {
  const byAppleAlbumId =
    new Map<string, ExistingAppleRelease>();

  const byUpc =
    new Map<string, ExistingAppleRelease>();

  const bySlug =
    new Map<string, ExistingAppleRelease>();

  const byTitle =
    new Map<string, ExistingAppleRelease>();

  for (const item of releases) {
    const appleAlbumId = String(
      item.metadata?.apple_music_album_id ??
      "",
    ).trim();

    if (appleAlbumId) {
      byAppleAlbumId.set(
        appleAlbumId,
        item,
      );
    }

    if (item.upc) {
      byUpc.set(item.upc, item);
    }

    bySlug.set(item.slug, item);

    byTitle.set(
      item.title.toLowerCase().trim(),
      item,
    );
  }

  return {
    byAppleAlbumId,
    byUpc,
    bySlug,
    byTitle,
  };
}

describe(
  "artist discography release identity",
  () => {
    it(
      "prefers the exact Apple album identity",
      () => {
        const savara = release({
          id: "savara-release",
          metadata: {
            apple_music_album_id:
              "1594997038",
          },
        });

        const nyashinski = release({
          id: "nyashinski-release",
          metadata: {
            apple_music_album_id:
              "1832011670",
          },
        });

        expect(
          resolveExistingAppleRelease(
            maps([
              savara,
              nyashinski,
            ]),
            {
              appleAlbumId:
                "1832011670",
              upc: null,
              rawSlug:
                "balance-single",
              normalizedTitle:
                "balance - single",
            },
          )?.id,
        ).toBe("nyashinski-release");
      },
    );

    it(
      "does not merge a same-slug release with another Apple album",
      () => {
        const savara = release({
          id: "savara-release",
          metadata: {
            apple_music_album_id:
              "1594997038",
          },
        });

        expect(
          resolveExistingAppleRelease(
            maps([savara]),
            {
              appleAlbumId:
                "1832011670",
              upc: null,
              rawSlug:
                "balance-single",
              normalizedTitle:
                "balance - single",
            },
          ),
        ).toBeUndefined();
      },
    );

    it(
      "does not merge a same-title release with a conflicting UPC",
      () => {
        const existing = release({
          id: "existing-release",
          upc: "111111111111",
        });

        expect(
          resolveExistingAppleRelease(
            maps([existing]),
            {
              appleAlbumId:
                "new-provider-id",
              upc: "222222222222",
              rawSlug:
                "balance-single",
              normalizedTitle:
                "balance - single",
            },
          ),
        ).toBeUndefined();
      },
    );

    it(
      "allows legacy fallback when provider identity is absent",
      () => {
        const legacy = release({
          id: "legacy-release",
          metadata: {
            source: "legacy-import",
          },
        });

        expect(
          resolveExistingAppleRelease(
            maps([legacy]),
            {
              appleAlbumId:
                "1832011670",
              upc: null,
              rawSlug:
                "balance-single",
              normalizedTitle:
                "balance - single",
            },
          )?.id,
        ).toBe("legacy-release");
      },
    );
  },
);
