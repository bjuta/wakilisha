import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  releaseTrackUrl,
  trackUrl,
} from "../src/utils/trackUrl";

describe("release-scoped track routes", () => {
  it("builds a clean release-scoped track URL", () => {
    expect(
      releaseTrackUrl(
        "Nyashinski",
        "Lucky You",
        "Legendary",
      ),
    ).toBe(
      "/releases/nyashinski/lucky-you/legendary",
    );
  });

  it("keeps the standalone track route available", () => {
    expect(
      trackUrl("Valle", ["Matata"]),
    ).toBe("/tracks/matata/valle");
  });

  it("wires release pages and the public gateway to release context", () => {
    const router = readFileSync(
      "src/router/config.tsx",
      "utf8",
    );
    const desktopRelease = readFileSync(
      "src/pages/releases/detail/components/ReleaseTracklist.tsx",
      "utf8",
    );
    const mobileRelease = readFileSync(
      "src/pages/mobile/releases/detail/page.tsx",
      "utf8",
    );
    const trackPage = readFileSync(
      "src/pages/tracks/detail/page.tsx",
      "utf8",
    );
    const lyricsPage = readFileSync(
      "src/pages/tracks/lyrics/contribute/page.tsx",
      "utf8",
    );
    const redirectService = readFileSync(
      "src/services/slugRedirects.ts",
      "utf8",
    );
    const publicClient = readFileSync(
      "src/services/publicApi/client.ts",
      "utf8",
    );
    const publicGateway = readFileSync(
      "supabase/functions/public-content-read/index.ts",
      "utf8",
    );

    expect(router).toContain(
      "/releases/:artistSlug/:releaseSlug/:trackSlug",
    );
    expect(desktopRelease).toContain(
      "releaseTrackUrl(artistSlug, release.slug, track.slug)",
    );
    expect(mobileRelease).toContain(
      "releaseTrackUrl(artistSlug, releaseSlug, track.slug)",
    );
    expect(trackPage).toContain(
      "getReleaseTrack(artistSlug, releaseSlug, trackSlug)",
    );
    expect(trackPage).toContain(
      "{ releaseSlug },",
    );
    expect(lyricsPage).toContain(
      "resolveScopedSlugRedirect(",
    );
    expect(lyricsPage).toContain(
      "`${redirect.newPath}/lyrics/contribute`",
    );
    expect(redirectService).toContain(
      "releaseSlug?: string",
    );
    expect(redirectService).toContain(
      "return `/releases/${scopeSlug}/${releaseSlug}/`;",
    );
    expect(publicClient).toContain(
      "/releases/${encodeURIComponent(artistSlug)}/${encodeURIComponent(releaseSlug)}/${encodeURIComponent(trackSlug)}",
    );
    expect(publicGateway).toContain(
      "ambiguous_release_track_slug",
    );
    expect(publicGateway).toContain(
      "releaseScopedMembership",
    );
    expect(publicGateway).toContain(
      '.select("release_id, track_id, track_number, disc_number")',
    );
  });
  it("makes release-connected tracks own release-scoped canonical URLs", () => {
    const trackPage = readFileSync(
      "src/pages/tracks/detail/page.tsx",
      "utf8",
    );
    const pageTitle = readFileSync(
      "src/components/seo/PageTitle.tsx",
      "utf8",
    );
    const prerender = readFileSync(
      "scripts/seo/prerender-metadata.mjs",
      "utf8",
    );
    const sitemapFunction = readFileSync(
      "supabase/functions/seo-sitemap-admin/index.ts",
      "utf8",
    );

    expect(trackPage).toContain(
      "!releaseSlug &&",
    );
    expect(trackPage).toContain(
      "const scopedPath = releaseTrackUrl(",
    );
    expect(trackPage).toContain(
      "url={canonicalAbsoluteUrl}",
    );
    expect(trackPage).toContain(
      "url: canonicalAbsoluteUrl,",
    );
    expect(pageTitle).toContain(
      'section === "releases" && parts.length >= 4',
    );
    expect(pageTitle).toContain(
      'ogType: "music.song"',
    );
    expect(prerender).toContain(
      'parts[0] === "releases" && parts.length >= 4',
    );
    expect(prerender).toContain(
      'kind: "track"',
    );
    expect(sitemapFunction).toContain(
      'db.from("registry_release_tracks")',
    );
    expect(sitemapFunction).toContain(
      "path: `/releases/${releaseArtistSlug}/${releaseSlug}/${row.slug}`",
    );
    expect(sitemapFunction).toContain(
      "if (scopedItems.length)",
    );
  });

});
