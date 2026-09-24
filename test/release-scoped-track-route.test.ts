import {
  existsSync,
  readFileSync,
} from "node:fs";
import { describe, expect, it } from "vitest";

import {
  canonicalTrackUrl,
  trackUrl,
} from "../src/utils/trackUrl";

describe("canonical public Track and Release routes", () => {
  it("keeps Registry UUID internal and uses Artist-scoped Track URLs", () => {
    expect(
      trackUrl("Legendary", ["Nyashinski"]),
    ).toBe("/tracks/nyashinski/legendary");

    expect(
      canonicalTrackUrl(
        "wakadinali",
        "interlude",
      ),
    ).toBe("/tracks/wakadinali/interlude");

    const trackUrlSource = readFileSync(
      "src/utils/trackUrl.ts",
      "utf8",
    );
    expect(trackUrlSource).not.toContain("trackId");
  });

  it("retires UUID-bearing and Release-scoped Track route ownership without redirects", () => {
    const router = readFileSync(
      "src/router/config.tsx",
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
    const releasePage = readFileSync(
      "src/pages/releases/detail/page.tsx",
      "utf8",
    );
    const mobileReleasePage = readFileSync(
      "src/pages/mobile/releases/detail/page.tsx",
      "utf8",
    );
    const articlePage = readFileSync(
      "src/pages/magazine/article/page.tsx",
      "utf8",
    );
    const articleService = readFileSync(
      "src/services/articles/articleAdminService.ts",
      "utf8",
    );
    const seoEdge = readFileSync(
      "supabase/functions/seo-sitemap-admin/index.ts",
      "utf8",
    );
    const prerender = readFileSync(
      "scripts/seo/prerender-metadata.mjs",
      "utf8",
    );
    const sitemapBuilder = readFileSync(
      "scripts/seo/build-public-sitemap-html.mjs",
      "utf8",
    );
    const seoAudit = readFileSync(
      "scripts/seo/audit-prerender-output.mjs",
      "utf8",
    );

    expect(router).toContain(
      'path: "/tracks/:artistSlug/:trackSlug"',
    );
    expect(router).toContain(
      'path: "/tracks/:artistSlug/:trackSlug/lyrics/contribute"',
    );
    expect(router).not.toContain(
      'path: "/tracks/:artistSlug/:trackSlug/:trackId"',
    );
    expect(router).not.toContain(
      'path: "/releases/:artistSlug/:releaseSlug/:trackSlug"',
    );

    for (const retiredOwner of [
      "LegacyEntityRedirect",
      "LegacyTaxonomyRedirect",
      "LegacyArticleRedirect",
      "LegacyAuthorPersonRedirect",
    ]) {
      expect(router).not.toContain(retiredOwner);
    }

    expect(trackPage).not.toContain("trackId } = useParams");
    expect(lyricsPage).not.toContain("trackId,");
    expect(releasePage).toContain("data.trackCount <= 1");
    expect(releasePage).not.toContain("navigate(");
    expect(mobileReleasePage).toContain("data.trackCount <= 1");
    expect(mobileReleasePage).not.toContain("navigate(");

    expect(articlePage).not.toContain("lookupSlugRedirect");
    expect(articleService).not.toContain("insertSlugRedirect");
    expect(articleService).not.toContain("lookupSlugRedirect");
    expect(articleService).not.toContain("wk_slug_redirects");

    expect(seoEdge).toContain(
      'loc: makeUrl(`/tracks/${artistSlug}/${row.slug}`)',
    );
    expect(seoEdge).not.toContain(
      'path: `/releases/${releaseArtistSlug}/${releaseSlug}/${row.slug}`',
    );
    expect(seoEdge).not.toContain(
      "const scopedItems:",
    );
    expect(prerender).toContain(
      'parts[0] === "tracks" &&',
    );
    expect(prerender).toContain(
      "parts.length === 3",
    );
    expect(prerender).not.toContain(
      'parts[0] === "releases" && parts.length >= 4',
    );
    expect(sitemapBuilder).toContain(
      "SEO metadata manifest contains retired public music identities",
    );
    expect(seoAudit).toContain(
      "Registry Track metadata must use canonical Artist-scoped Track identity.",
    );

    for (const retiredModule of [
      "src/services/slugRedirects.ts",
      "src/pages/LegacyArticleRedirect.tsx",
      "src/pages/authors/legacy-redirect/page.tsx",
    ]) {
      expect(existsSync(retiredModule)).toBe(false);
    }
  });

  it("fails closed on ambiguous or wrong-Artist Track identity", () => {
    const edge = readFileSync(
      "supabase/functions/public-content-read/index.ts",
      "utf8",
    );

    expect(edge).toContain(
      'reason: "ambiguous_track_slug"',
    );
    expect(edge).toContain(
      "identityReviewRequired: true",
    );
    expect(edge).not.toContain(
      "canonicalIdentityRequired",
    );
    expect(edge).not.toContain(
      "isTrackIdentityPath",
    );
    expect(edge).not.toContain(
      "isReleaseTrackPath",
    );
    expect(edge).not.toContain(
      '.eq("id", urlTrackId)',
    );

    const scopedTrackResolver = edge.slice(
      edge.indexOf("async function findTrackByScopedPublicSlug("),
      edge.indexOf("async function findReleaseByScopedPublicSlug("),
    );
    expect(scopedTrackResolver).toContain(
      "matches.length !== 1",
    );
    expect(scopedTrackResolver).toContain(
      '.eq("is_primary", true)',
    );
    expect(scopedTrackResolver).not.toContain(
      "return matches.sort",
    );

    const publicTrackBranch = edge.slice(
      edge.indexOf('else if (path.startsWith("/tracks/"))'),
      edge.indexOf('if (path.startsWith("/charts/"))'),
    );
    expect(publicTrackBranch).not.toContain(
      '.eq("slug", trackSlug)',
    );
    expect(publicTrackBranch).not.toContain(
      "Chart-entry fallback",
    );
    expect(publicTrackBranch).toContain(
      '.eq("is_primary", true)',
    );

    const releaseResolver = edge.slice(
      edge.indexOf("async function findReleaseByScopedPublicSlug("),
      edge.indexOf("function extractYear", edge.indexOf("async function findReleaseByScopedPublicSlug(")),
    );
    expect(releaseResolver).toContain(
      '.eq("is_primary", true)',
    );
    expect(edge).not.toContain(
      "byReleaseSlug",
    );
  });

  it("keeps Track capability and Release context without UUID route material", () => {
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

    expect(desktopRelease).toContain(
      "canonicalTrackUrl(",
    );
    expect(mobileRelease).toContain(
      "canonicalTrackUrl(",
    );

    for (const capability of [
      "From This Release",
      "Track Details",
      "Registry Details",
      "Your Listening",
      "TrackReleaseTracklist",
      "TrackListeningSignalPanel",
      "TrackMomentSummary",
      "TrackChartSparkline",
      "ChartKpiGrid",
      "TrackLyricsSection",
      "TrackRelatedTracks",
      "ConnectedArtists",
      "ContributionBadges",
      "CommunitySection",
      "AddToPlaylistButton",
      "lyricsContributionPath",
    ]) {
      expect(trackPage).toContain(capability);
    }
  });
});
