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
      const url = new URL(
        route.request().url(),
      );
      const path = url.pathname;

      if (
        path.endsWith(
          "/rest/v1/registry_tracks",
        ) &&
        url.searchParams
          .get("id")
          ?.includes(
            trackDetail.track.id,
          )
      ) {
        await fulfillJson(route, {
          id: trackDetail.track.id,
          slug: trackDetail.track.slug,
          title: trackDetail.track.title,
          artwork_url: null,
        });
        return;
      }

      if (
        path.endsWith(
          "/rest/v1/registry_track_artists",
        ) &&
        url.searchParams
          .get("track_id")
          ?.includes(
            trackDetail.track.id,
          )
      ) {
        await fulfillJson(route, [
          {
            track_id:
              trackDetail.track.id,
            artist_name_text:
              soloArtist.name,
            artist_slug:
              soloArtist.slug,
            credit_order: 0,
          },
        ]);
        return;
      }

      await fulfillJson(route, []);
    },
  );

  await page.route(
    "**://*.supabase.co/rest/v1/rpc/**",
    async (route) => {
      const url = new URL(
        route.request().url(),
      );
      const rpcName =
        url.pathname.split("/").pop() || "";

      if (
        rpcName ===
        "track_analytics_event"
      ) {
        await fulfillJson(route, null);
        return;
      }

      if (
        rpcName ===
        "get_my_music_credits_v1"
      ) {
        await fulfillJson(route, {
          personId:
            "13f03a01-9e07-4ac4-8fa5-000000000029",
          needsYou: [],
          yourWork: [],
          activity: [],
          sharingPermissions: [],
        });
        return;
      }

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

      if (
        path.endsWith(
          "/public-content-read/releases",
        )
      ) {
        await fulfillJson(route, {
          data: {
            releases: [],
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

async function installAuthenticatedCreditsSession(
  page: import("@playwright/test").Page,
) {
  await page.addInitScript(() => {
    const now = Math.floor(Date.now() / 1000);
    const session = {
      access_token: "browser-test-access-token",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: now + 3600,
      refresh_token: "browser-test-refresh-token",
      user: {
        id:
          "13f03a01-9e07-4ac4-8fa5-000000000029",
        aud: "authenticated",
        role: "authenticated",
        email: "credits-browser@wakilisha.test",
        email_confirmed_at:
          "2026-10-01T00:00:00.000Z",
        confirmed_at:
          "2026-10-01T00:00:00.000Z",
        app_metadata: {},
        user_metadata: {
          full_name:
            "Credits Browser Test",
        },
        identities: [],
        created_at:
          "2026-10-01T00:00:00.000Z",
      },
    };

    window.localStorage.setItem(
      "sb-pgzizndxdyhqmtyywjmt-auth-token",
      JSON.stringify(session),
    );
  });
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
function shortWavPreview(frequency: number, seconds = 6): string {
  const rate = 8000;
  const count = rate * seconds;
  const pcm = Buffer.alloc(44 + count * 2);
  pcm.write("RIFF", 0, "ascii");
  pcm.writeUInt32LE(36 + count * 2, 4);
  pcm.write("WAVEfmt ", 8, "ascii");
  pcm.writeUInt32LE(16, 16);
  pcm.writeUInt16LE(1, 20);
  pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(rate, 24);
  pcm.writeUInt32LE(rate * 2, 28);
  pcm.writeUInt16LE(2, 32);
  pcm.writeUInt16LE(16, 34);
  pcm.write("data", 36, "ascii");
  pcm.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i += 1) {
    const amplitude = Math.round(Math.sin((2 * Math.PI * frequency * i) / rate) * 8000);
    pcm.writeInt16LE(amplitude, 44 + i * 2);
  }
  return `data:audio/wav;base64,${pcm.toString("base64")}`;
}

test("Chapter 25 hot-enables decoded-buffer overlap and switches queue at fade start", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const previews = ["/__wk-mix/ch25-runtime-a.wav", "/__wk-mix/ch25-runtime-b.wav"];
  const audioByName = new Map([
    ["ch25-runtime-a.wav", Buffer.from(shortWavPreview(220, 12).split(",")[1], "base64")],
    ["ch25-runtime-b.wav", Buffer.from(shortWavPreview(330, 12).split(",")[1], "base64")],
  ]);
  const fixture = {
    ...releaseDetail,
    tracks: releaseDetail.tracks.map((track, index) => ({
      ...track,
      duration: 12,
      previewUrl: previews[index],
    })),
  };
  await page.addInitScript(() => {
    // No preseeded mix setting: the actual mobile UI must activate the engine
    // after native playback has already started.
    window.localStorage.removeItem("wk-playback-v2");
    const sourceNodes: AudioBufferSourceNode[] = [];
    const analysers: AnalyserNode[] = [];
    const gainNodes: GainNode[] = [];
    const mediaAttachments: string[] = [];
    Object.assign(window, {
      __wkBufferSources: sourceNodes,
      __wkBufferAnalysers: analysers,
      __wkBufferGains: gainNodes,
      __wkMediaAttachments: mediaAttachments,
    });
    const sourceFactory = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = sourceFactory.call(this);
      sourceNodes.push(source);
      return source;
    };
    const analyserFactory = AudioContext.prototype.createAnalyser;
    AudioContext.prototype.createAnalyser = function () {
      const analyser = analyserFactory.call(this);
      analysers.push(analyser);
      return analyser;
    };
    const gainFactory = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function () {
      const gain = gainFactory.call(this);
      gainNodes.push(gain);
      return gain;
    };
    const oldMediaFactory = AudioContext.prototype.createMediaElementSource;
    AudioContext.prototype.createMediaElementSource = function (element) {
      mediaAttachments.push(element.currentSrc.slice(0, 80));
      return oldMediaFactory.call(this, element);
    };
  });
  await page.route("**/__wk-mix/ch25-runtime-*.wav", async (route) => {
    const path = new URL(route.request().url()).pathname.split("/").pop() || "";
    const wav = audioByName.get(path);
    if (!wav) return route.fulfill({ status: 404, body: "Unknown Ch25 fixture" });
    const range = route.request().headers()["range"]?.match(/^bytes=(\d+)-(\d*)$/);
    const first = range ? Number(range[1]) : 0;
    const last = range && range[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1;
    if (first >= wav.length || last < first) {
      return route.fulfill({ status: 416, headers: { "Content-Range": `bytes */${wav.length}` } });
    }
    const part = wav.subarray(first, last + 1);
    await route.fulfill({
      status: range ? 206 : 200, contentType: "audio/wav",
      headers: {
        "Access-Control-Allow-Origin": "*", "Accept-Ranges": "bytes",
        "Content-Length": String(part.length),
        ...(range ? { "Content-Range": `bytes ${first}-${last}/${wav.length}` } : {}),
      },
      body: part,
    });
  });
  await page.route(
    "**/public-content-read/releases/slice3-browser-solo/slice3-browser-release**",
    async (route) => {
      await fulfillJson(route, { data: { release: fixture } });
    },
  );
  await page.goto("/releases/slice3-browser-solo/slice3-browser-release", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { level: 1, name: releaseDetail.title })).toBeVisible();
  await page.getByRole("button", { name: "Play", exact: true }).first().click();
  const compact = page.locator('[data-wk-player-compact="mobile"]');
  await expect(compact).toBeVisible();
  await compact.getByRole("button", { name: /Slice 3 Browser Track/ }).first().click();
  const expanded = page.locator("[data-wk-player-overlay]");
  await expect(expanded).toBeVisible();
  await expanded.getByRole("button", { name: "More Player actions" }).click();
  await page.getByRole("button", { name: /Transitions/ }).last().click();
  const smart = page.getByRole("radio", { name: /Smart Mix/ });
  await smart.click();
  await expect(smart).toHaveAttribute("aria-checked", "true");

  const measure = () => page.evaluate(() => {
    const w = window as unknown as {
      __wkBufferSources: AudioBufferSourceNode[];
      __wkBufferAnalysers: AnalyserNode[];
      __wkBufferGains: GainNode[];
      __wkMediaAttachments: string[];
    };
    const peaks = (w.__wkBufferAnalysers || []).map(analyser => {
      const pcm = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(pcm);
      return pcm.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0);
    });
    return {
      sources: w.__wkBufferSources.length,
      peaks,
      gains: w.__wkBufferGains.map(gain => gain.gain.value),
      mediaAttachments: w.__wkMediaAttachments,
    };
  });
  try {
    await expect.poll(async () => {
      const m = await measure();
      return m.sources >= 2 &&
        m.peaks.filter(value => value > 0.0005).length >= 2 &&
        m.gains.filter(value => value > 0.05).length >= 2 &&
        m.mediaAttachments.length === 0;
    }, { timeout: 21000, intervals: [80, 100, 120],
      message: "WebKit must mix two actual decoded AudioBufferSourceNode signals; no MediaElement source allowed",
    }).toBe(true);
  } catch (error) {
    console.error("CH25_BUFFER_PLAYER_DIAGNOSTICS=" + JSON.stringify(await measure()));
    throw error;
  }
  await expect(page.locator(
    '[data-wk-player-compact="desktop"], [data-wk-player-compact="mobile"], [data-wk-player-dock]',
  ).getByText("Slice 3 Browser Track Two", { exact: true }).first()).toBeVisible();
});

test("Chapter 25 mobile More tooltip stays inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(
    "**/public-content-read/releases/slice3-browser-solo/slice3-browser-release**",
    async (route) => {
      await fulfillJson(route, { data: { release: releaseDetail } });
    },
  );
  await page.goto("/releases/slice3-browser-solo/slice3-browser-release", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { level: 1, name: releaseDetail.title })).toBeVisible();
  await page.getByRole("button", { name: "Play", exact: true }).first().click();

  // Mobile compact player has no More control. Open its full player first.
  const compact = page.locator('[data-wk-player-compact="mobile"]');
  await expect(compact).toBeVisible();
  await compact.getByRole("button", { name: /Slice 3 Browser Track/ }).first().click();
  const expanded = page.locator("[data-wk-player-overlay]");
  await expect(expanded).toBeVisible();
  await expanded.getByRole("button", { name: "More Player actions" }).click();
  await page.getByRole("button", { name: /Transitions/ }).last().click();
  const tip = page.getByRole("button", { name: "About Smart Mix" });
  await expect(tip).toBeVisible();
  await tip.click();
  const note = page.getByRole("note").filter({ hasText: "Matches nearby tempos" });
  await expect(note).toBeVisible();
  const box = await note.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  await page.keyboard.press("Escape");
  await expect(note).toHaveCount(0);
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

test("creator credits deep link keeps the requested Track selected", async ({
  page,
}) => {
  await installAuthenticatedCreditsSession(
    page,
  );

  await page.goto(
    `/credits?track_id=${trackDetail.track.id}&claim=1`,
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Your Credits",
      exact: true,
    }),
  ).toBeVisible();

  const search = page.getByPlaceholder(
    "Search title or artist",
  );

  await expect(search).toHaveValue(
    trackDetail.track.title,
  );

  const selectedTrack =
    page.getByRole("button", {
      name: new RegExp(
        trackDetail.track.title,
      ),
    });

  await expect(
    selectedTrack,
  ).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await expect(
    page.getByText(
      "Choose the recording, add the role, and tell us who the credit belongs to.",
      { exact: true },
    ),
  ).toBeVisible();

  await expect(
    page.getByText(
      "Open response first",
      { exact: true },
    ),
  ).toHaveCount(0);

  await expect(
    page.getByText(
      /Cannot read properties of undefined/,
    ),
  ).toHaveCount(0);
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
    .getByRole("tab", {
      name: "Music",
      exact: true,
    })
    .click();

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
