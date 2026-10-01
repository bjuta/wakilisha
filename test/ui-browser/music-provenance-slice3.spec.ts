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
  topSongs: [
    {
      id: "13f03a01-9e07-4ac4-8fa5-000000000031",
      slug: "slice3-grouped-artist-track",
      artistSlug: "slice3-browser-solo",
      title: "Slice 3 Grouped Artist Track",
      artists:
        "Slice 3 Browser Solo (feat. Preview Producer, Preview Songwriter)",
      image: "",
      duration: "3:05",
      songUrl: "",
    },
  ],
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
  topSongs: [],
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

const releaseDetail = {
  id: "13f03a01-9e07-4ac4-8fa5-000000000027",
  slug: "slice3-browser-release",
  title: "Slice 3 Browser Release",
  artist: soloArtist.name,
  artistSlug: soloArtist.slug,
  year: "2026",
  releaseDate: "2026-10-01",
  releaseType: "Album",
  labelName: "Preview Label",
  labelSlug: "preview-label",
  artworkUrl: "",
  trackCount: 2,
  totalDuration: 365,
  description: "Preview release",
  tracks: [
    {
      id: trackDetail.track.id,
      slug: trackDetail.track.slug,
      artistSlug: soloArtist.slug,
      title: trackDetail.track.title,
      artist: soloArtist.name,
      duration: 185,
      trackNumber: 1,
      artworkUrl: "",
      previewUrl: null,
    },
    {
      id: "13f03a01-9e07-4ac4-8fa5-000000000028",
      slug: "slice3-browser-track-two",
      artistSlug: groupArtist.slug,
      title: "Slice 3 Browser Track Two",
      artist: groupArtist.name,
      duration: 180,
      trackNumber: 2,
      artworkUrl: "",
      previewUrl: null,
    },
  ],
  metadata: {},
  artists: [
    {
      artistId: soloArtist.id,
      name: soloArtist.name,
      slug: soloArtist.slug,
      isPrimary: true,
      isFeatured: false,
      creditOrder: 0,
      artistType: "solo",
    },
    {
      artistId: groupArtist.id,
      name: groupArtist.name,
      slug: groupArtist.slug,
      isPrimary: true,
      isFeatured: false,
      creditOrder: 1,
      artistType: "group",
    },
  ],
  musicProvenance: {
    tracks: [
      {
        trackId: trackDetail.track.id,
        trackSlug: trackDetail.track.slug,
        artistSlug: soloArtist.slug,
        title: trackDetail.track.title,
        artworkUrl: "",
        recordingContributions:
          trackDetail.recordingContributions,
        works: trackDetail.works,
        provenanceReceipt:
          trackDetail.provenanceReceipt,
      },
      {
        trackId:
          "13f03a01-9e07-4ac4-8fa5-000000000028",
        trackSlug: "slice3-browser-track-two",
        artistSlug: groupArtist.slug,
        title: "Slice 3 Browser Track Two",
        artworkUrl: "",
        recordingContributions: [],
        works: [],
        provenanceReceipt: null,
      },
    ],
    recordingCreditCount: 1,
    workCreditCount: 1,
    hasCanonicalCredits: true,
  },
  featuredArtists: [],
  chartStats: null,
};

const personFixture = {
  personId:
    "13f03a01-9e07-4ac4-8fa5-000000000024",
  canonicalPath: "/people/preview-producer",
  displayName: "Preview Producer",
  bio: "Preview producer",
  avatarUrl: null,
  coverUrl: null,
  location: "Nairobi",
  username: null,
  registryAuthorSlug: null,
  publicRoles: [],
  redirectTo: null,
};

const personMusicCredits = {
  personId: personFixture.personId,
  recordingCredits: [
    {
      id: trackDetail.recordingContributions[0].id,
      roleKey: "producer",
      roleLabel: "Producer",
      instrument: null,
      detail: null,
      creditedAs: "Preview Producer",
      subject: {
        kind: "track",
        id: trackDetail.track.id,
        title: trackDetail.track.title,
        path:
          "/tracks/slice3-browser-solo/slice3-browser-track",
        artworkUrl: null,
      },
    },
  ],
  workCredits: [],
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
    "**://*.supabase.co/rest/v1/**",
    async (route) => {
      await fulfillJson(route, []);
    },
  );

  await page.route(
    "**://*.supabase.co/rest/v1/rpc/track_analytics_event",
    async (route) => {
      await fulfillJson(route, null);
    },
  );

  await page.route(
    "**://*.supabase.co/rest/v1/rpc/get_public_person",
    async (route) => {
      await fulfillJson(
        route,
        personFixture,
      );
    },
  );

  await page.route(
    "**://*.supabase.co/rest/v1/rpc/list_public_person_work",
    async (route) => {
      await fulfillJson(route, []);
    },
  );

  await page.route(
    "**://*.supabase.co/rest/v1/rpc/get_public_person_social_summary",
    async (route) => {
      await fulfillJson(route, {
        person_id:
          personFixture.personId,
        follower_count: 0,
        following_count: 0,
      });
    },
  );

  await page.route(
    "**://*.supabase.co/rest/v1/rpc/get_public_person_music_credits_v1",
    async (route) => {
      await fulfillJson(
        route,
        personMusicCredits,
      );
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

      if (
        path.endsWith(
          "/public-content-read/releases/slice3-browser-solo/slice3-browser-release",
        )
      ) {
        await fulfillJson(route, {
          data: {
            release:
              releaseDetail,
          },
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

test("Slice 3 normalizes grouped Artist credits without hanging brackets", async ({
  page,
}) => {
  await page.goto(
    "/artists/slice3-browser-solo",
    {
      waitUntil: "domcontentloaded",
    },
  );

  await page
    .getByText(
      "Slice 3 Grouped Artist Track",
      { exact: true },
    )
    .click();

  const chips = page.locator(
    "[data-wk-artist-credit-chip]",
  );

  await expect(chips).toHaveCount(3);
  await expect(chips.nth(0)).toHaveText(
    soloArtist.name,
  );
  await expect(chips.nth(1)).toHaveText(
    "Preview Producer",
  );
  await expect(chips.nth(2)).toHaveText(
    "Preview Songwriter",
  );

  expect(
    await chips.allTextContents(),
  ).toEqual([
    soloArtist.name,
    "Preview Producer",
    "Preview Songwriter",
  ]);
});

test("Slice 3 renders Release provenance and ordered typed Artist schema on desktop", async ({
  page,
}) => {
  await page.setViewportSize({
    width: 1280,
    height: 900,
  });

  await page.goto(
    "/releases/slice3-browser-solo/slice3-browser-release",
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: releaseDetail.title,
      exact: true,
    }),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", {
      level: 2,
      name:
        "Who worked on this release",
      exact: true,
    }),
  ).toBeVisible();

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

  const schemas = await jsonLd(page);
  const album = schemas.find(
    (value: Record<string, unknown>) =>
      value?.["@type"] ===
        "MusicAlbum" &&
      value?.name ===
        releaseDetail.title,
  ) as
    | {
        byArtist?: Array<{
          "@type": string;
          name: string;
        }>;
      }
    | undefined;

  expect(album).toBeTruthy();
  expect(album?.byArtist).toEqual([
    expect.objectContaining({
      "@type": "Person",
      name: soloArtist.name,
    }),
    expect.objectContaining({
      "@type": "MusicGroup",
      name: groupArtist.name,
    }),
  ]);

  await page
    .getByRole("button", {
      name: "How we know this",
      exact: true,
    })
    .click();

  await expect(
    page.getByText(
      "WAKILISHA does not infer contribution from Release Artist billing.",
      { exact: true },
    ),
  ).toBeVisible();
});

test("Slice 3 renders the same Release provenance contract on mobile", async ({
  page,
}) => {
  await page.setViewportSize({
    width: 390,
    height: 844,
  });

  await page.goto(
    "/releases/slice3-browser-solo/slice3-browser-release",
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(
    page.getByRole("heading", {
      level: 2,
      name:
        "Who worked on this release",
      exact: true,
    }),
  ).toBeVisible();

  await expect(
    page
      .locator(
        "[data-wk-release-provenance]",
      ),
  ).toContainText(
    "Release Artist billing is separate from contribution roles.",
  );

  const schemas = await jsonLd(page);
  const album = schemas.find(
    (value: Record<string, unknown>) =>
      value?.["@type"] ===
        "MusicAlbum" &&
      value?.name ===
        releaseDetail.title,
  ) as
    | {
        byArtist?: Array<{
          "@type": string;
          name: string;
        }>;
      }
    | undefined;

  expect(album?.byArtist).toEqual([
    expect.objectContaining({
      "@type": "Person",
      name: soloArtist.name,
    }),
    expect.objectContaining({
      "@type": "MusicGroup",
      name: groupArtist.name,
    }),
  ]);
});

test("Slice 3 keeps canonical music credits visible on the Person surface", async ({
  page,
}) => {
  await page.goto(
    "/people/preview-producer",
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(
    page.getByRole("heading", {
      name:
        "Recorded work and songwriting",
      exact: true,
    }),
  ).toBeVisible();

  await expect(
    page.getByText(
      trackDetail.track.title,
      { exact: true },
    ),
  ).toBeVisible();

  await expect(
    page.getByText(
      "Producer",
      { exact: true },
    ),
  ).toBeVisible();
});

