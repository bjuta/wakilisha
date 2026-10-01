import { expect, test } from "@playwright/test";

const soloArtist = {
  id: "13f03a01-9e07-4ac4-8fa5-000000000020",
  slug: "slice3-browser-solo",
  name: "Slice 3 Browser Solo",
  country: "KE",
  imageUrl: "",
  profileImageUrl: "",
  genres: ["Afropop"],
  trackCount: 1,
  releaseCount: 0,
  isChartArtist: false,
  isRising: false,
  topChartPosition: null,
  bio: "Preview solo artist",
  fullBio: "Preview solo artist",
  artistType: "solo",
  followerCount: 0,
  popularity: 0,
  spotifyUrl: "",
  instagram: "",
  chartEntries: [],
  releases: [],
  topSongs: [],
  relatedArtists: [],
  videos: [],
  musicProvenance: {
    artistId: "13f03a01-9e07-4ac4-8fa5-000000000020",
    recordingCredits: [],
    workCredits: [],
    groupMembers: [],
  },
};

const groupArtist = {
  ...soloArtist,
  id: "13f03a01-9e07-4ac4-8fa5-000000000021",
  slug: "slice3-browser-group",
  name: "Slice 3 Browser Group",
  bio: "Preview group artist",
  fullBio: "Preview group artist",
  artistType: "group",
  musicProvenance: {
    artistId: "13f03a01-9e07-4ac4-8fa5-000000000021",
    recordingCredits: [],
    workCredits: [],
    groupMembers: [],
  },
};

const trackDetail = {
  track: {
    id: "13f03a01-9e07-4ac4-8fa5-000000000022",
    slug: "slice3-browser-track",
    title: "Slice 3 Browser Track",
    durationMs: 185000,
    artworkUrl: "",
    isrc: "QZ-SL3-26-00001",
    explicit: false,
    trackNumber: 1,
    discNumber: 1,
    metadata: {},
    status: "active",
    previewUrl: null,
  },
  artists: [
    {
      artistId: soloArtist.id,
      name: soloArtist.name,
      slug: soloArtist.slug,
      isPrimary: true,
      isFeatured: false,
      creditOrder: 0,
      role: "primary_artist",
      artistType: "solo",
    },
    {
      artistId: groupArtist.id,
      name: groupArtist.name,
      slug: groupArtist.slug,
      isPrimary: true,
      isFeatured: false,
      creditOrder: 1,
      role: "primary_artist",
      artistType: "group",
    },
  ],
  artist: {
    slug: soloArtist.slug,
    name: soloArtist.name,
    imageUrl: "",
    artistType: "solo",
  },
  canonicalPath:
    "/tracks/slice3-browser-solo/slice3-browser-track",
  routeBindings: [
    {
      artistId: soloArtist.id,
      artistSlug: soloArtist.slug,
      artistName: soloArtist.name,
      displaySequence: 0,
      isCanonical: true,
      path:
        "/tracks/slice3-browser-solo/slice3-browser-track",
    },
    {
      artistId: groupArtist.id,
      artistSlug: groupArtist.slug,
      artistName: groupArtist.name,
      displaySequence: 1,
      isCanonical: false,
      path:
        "/tracks/slice3-browser-group/slice3-browser-track",
    },
  ],
  recordingContributions: [
    {
      id: "13f03a01-9e07-4ac4-8fa5-000000000023",
      creditedName: "Preview Producer",
      roleKey: "producer",
      roleLabel: "Producer",
      instrument: null,
      detail: null,
      creditOrder: 1,
      resolvedEntity: {
        kind: "person",
        id: "13f03a01-9e07-4ac4-8fa5-000000000024",
        name: "Preview Producer",
        path: "/people/preview-producer",
      },
    },
  ],
  works: [
    {
      id: "13f03a01-9e07-4ac4-8fa5-000000000025",
      title: "Slice 3 Browser Work",
      relationshipKind: "embodies",
      contributions: [
        {
          id: "13f03a01-9e07-4ac4-8fa5-000000000026",
          creditedName: "Preview Songwriter",
          roleKey: "songwriter",
          roleLabel: "Songwriter",
          instrument: null,
          detail: null,
          creditOrder: 1,
          resolvedEntity: null,
        },
      ],
    },
  ],
  provenanceReceipt: {
    summary:
      "Reviewed contribution records support these credits.",
    lastCheckedAt: "2026-10-01T00:00:00.000Z",
  },
  release: null,
  label: null,
  genres: [{ slug: "afropop", name: "Afropop" }],
  chartHistory: [],
  chartAppearances: [],
  chartAppearanceCount: 0,
  peakRank: null,
  weeksOnChart: 0,
  currentRank: null,
  previousRank: null,
  movement: "same",
  movementAmount: 0,
  previewUrl: null,
  appleMusicId: null,
  appleMusicCatalogId: null,
  firstChartedDate: "",
  editionLabels: [],
  sourceProviders: [],
};

async function fulfillJson(
  route: import("@playwright/test").Route,
  body: unknown,
  status = 200,
) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installPublicReadFixtures(
  page: import("@playwright/test").Page,
) {
  await page.route(
    "**://*.supabase.co/auth/v1/**",
    async (route) => {
      await fulfillJson(route, {
        user: null,
        session: null,
      });
    },
  );

  await page.route(
    "**://*.supabase.co/rest/v1/rpc/track_analytics_event",
    async (route) => {
      await fulfillJson(route, null);
    },
  );

  await page.route(
    "**://*.supabase.co/rest/v1/**",
    async (route) => {
      await fulfillJson(route, []);
    },
  );

  await page.route(
    "**://*.supabase.co/functions/v1/**",
    async (route) => {
      const url = new URL(
        route.request().url(),
      );
      const path = url.pathname;

      if (
        path.endsWith(
          "/public-content-read/artists/slice3-browser-solo/discography",
        )
      ) {
        await fulfillJson(route, {
          releases: [],
          appearsOn: [],
        });
        return;
      }

      if (
        path.endsWith(
          "/public-content-read/artists/slice3-browser-group/discography",
        )
      ) {
        await fulfillJson(route, {
          releases: [],
          appearsOn: [],
        });
        return;
      }

      if (
        path.endsWith(
          "/public-content-read/artists/slice3-browser-solo",
        )
      ) {
        await fulfillJson(route, {
          data: { artist: soloArtist },
        });
        return;
      }

      if (
        path.endsWith(
          "/public-content-read/artists/slice3-browser-group",
        )
      ) {
        await fulfillJson(route, {
          data: { artist: groupArtist },
        });
        return;
      }

      if (
        path.endsWith(
          "/public-content-read/tracks/slice3-browser-solo/slice3-browser-track",
        )
      ) {
        await fulfillJson(route, {
          data: trackDetail,
        });
        return;
      }

      await fulfillJson(route, {
        data: null,
      });
    },
  );
}

async function jsonLd(
  page: import("@playwright/test").Page,
) {
  return await page
    .locator(
      'script[type="application/ld+json"]',
    )
    .evaluateAll((nodes) =>
      nodes
        .map((node) => {
          try {
            return JSON.parse(
              node.textContent || "{}",
            );
          } catch {
            return null;
          }
        })
        .filter(Boolean),
    );
}

test.beforeEach(async ({ page }) => {
  await installPublicReadFixtures(page);
});

test("Slice 3 emits Person JSON-LD for a canonical solo Artist", async ({
  page,
}) => {
  await page.goto(
    "/artists/slice3-browser-solo",
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: soloArtist.name,
      exact: true,
    }),
  ).toBeVisible();

  const schemas = await jsonLd(page);
  expect(schemas).toContainEqual(
    expect.objectContaining({
      "@type": "Person",
      name: soloArtist.name,
    }),
  );
});

test("Slice 3 emits MusicGroup JSON-LD for a canonical group Artist", async ({
  page,
}) => {
  await page.goto(
    "/artists/slice3-browser-group",
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: groupArtist.name,
      exact: true,
    }),
  ).toBeVisible();

  const schemas = await jsonLd(page);
  expect(schemas).toContainEqual(
    expect.objectContaining({
      "@type": "MusicGroup",
      name: groupArtist.name,
    }),
  );
});

test("Slice 3 preserves ordered multi-MainArtist recording schema and provenance UI", async ({
  page,
}) => {
  await page.goto(
    "/tracks/slice3-browser-solo/slice3-browser-track",
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: trackDetail.track.title,
      exact: true,
    }),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Who worked on this",
      exact: true,
    }),
  ).toBeVisible();

  const schemas = await jsonLd(page);
  const recording = schemas.find(
    (value: Record<string, unknown>) =>
      value?.["@type"] ===
        "MusicRecording" &&
      value?.name ===
        trackDetail.track.title,
  ) as
    | {
        byArtist?: Array<{
          "@type": string;
          name: string;
        }>;
      }
    | undefined;

  expect(recording).toBeTruthy();
  expect(
    Array.isArray(recording?.byArtist),
  ).toBe(true);
  expect(recording?.byArtist).toEqual([
    expect.objectContaining({
      "@type": "Person",
      name: soloArtist.name,
    }),
    expect.objectContaining({
      "@type": "MusicGroup",
      name: groupArtist.name,
    }),
  ]);

  await expect(
    page.getByText(
      "Preview Producer",
      { exact: true },
    ),
  ).toBeVisible();

  await expect(
    page.getByText(
      "Preview Songwriter",
      { exact: true },
    ),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "How we know this",
      exact: true,
    })
    .click();

  await expect(
    page.getByText(
      "Reviewed contribution records support these credits.",
      { exact: true },
    ),
  ).toBeVisible();

  await expect(
    page.getByRole("link", {
      name: "I worked on this",
      exact: true,
    }),
  ).toHaveAttribute(
    "href",
    /\/credits\?track_id=/,
  );
});
