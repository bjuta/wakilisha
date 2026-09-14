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
  it("owns exactly one canonical Track grammar", () => {
    expect(
      trackUrl("Legendary", ["Nyashinski"]),
    ).toBe("/tracks/nyashinski/legendary");

    expect(
      canonicalTrackUrl(
        "nyashinski",
        "legendary",
      ),
    ).toBe("/tracks/nyashinski/legendary");
  });

  it("removes Release-scoped Track and compatibility redirect ownership", () => {
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
    const trackUrlSource = readFileSync(
      "src/utils/trackUrl.ts",
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
    const articleTrash = readFileSync(
      "src/pages/admin/content/articles/trash/page.tsx",
      "utf8",
    );

    expect(router).toContain(
      'path: "/tracks/:artistSlug/:trackSlug"',
    );
    expect(router).toContain(
      'path: "/tracks/:artistSlug/:trackSlug/lyrics/contribute"',
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

    for (const legacy of [
      'path: "/artist", element: <NotFound />',
      'path: "/release", element: <NotFound />',
      'path: "/track", element: <NotFound />',
      'path: "/category", element: <NotFound />',
      'path: "/tag", element: <NotFound />',
      'path: "/player", element: <NotFound />',
      'path: "/authors/:slug", element: <NotFound />',
      'path: "/:slug", element: <NotFound />',
    ]) {
      expect(router).toContain(legacy);
    }

    expect(trackUrlSource).not.toContain(
      "releaseTrackUrl",
    );
    expect(trackUrlSource).not.toContain(
      "releaseTrackCount",
    );

    for (const retiredTrackRuntime of [
      "getReleaseTrack",
      "resolveScopedSlugRedirect",
      "releaseTrackUrl",
      "cleanDirtyTrackSlug",
    ]) {
      expect(trackPage).not.toContain(
        retiredTrackRuntime,
      );
    }

    for (const retiredLyricsRuntime of [
      "getReleaseTrack",
      "resolveScopedSlugRedirect",
      "releaseSlug",
      "releaseTrackCount",
      "useNavigate",
    ]) {
      expect(lyricsPage).not.toContain(
        retiredLyricsRuntime,
      );
    }

    expect(releasePage).not.toContain(
      "data.trackCount <= 1",
    );
    expect(releasePage).not.toContain(
      "navigate(",
    );

    expect(articlePage).not.toContain(
      "lookupSlugRedirect",
    );
    expect(articlePage).not.toContain(
      "checkingRedirect",
    );
    expect(articleService).not.toContain(
      "insertSlugRedirect",
    );
    expect(articleService).not.toContain(
      "lookupSlugRedirect",
    );
    expect(articleService).not.toContain(
      "wk_slug_redirects",
    );

    expect(articleTrash).not.toContain(
      "Slug redirects associated with this article",
    );
    expect(articleTrash).toContain(
      "This permanently removes the article and its revisions.",
    );

    for (const retiredModule of [
      "src/services/slugRedirects.ts",
      "src/pages/LegacyArticleRedirect.tsx",
      "src/pages/authors/legacy-redirect/page.tsx",
    ]) {
      expect(existsSync(retiredModule)).toBe(false);
    }
  });

  it("keeps Track capability and Release context without route indirection", () => {
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
    expect(desktopRelease).toContain(
      `canonicalTrackUrl(
              artistSlug,
              track.slug,
            )`,
    );
    expect(desktopRelease).not.toContain(
      `canonicalTrackUrl(
              artistSlug,
              track.slug,
              release.slug,
              release.trackCount,
            )`,
    );
    expect(mobileRelease).toContain(
      `canonicalTrackUrl(
                  artistSlug,
                  track.slug,
                )`,
    );
    expect(mobileRelease).not.toContain(
      `canonicalTrackUrl(
                  artistSlug,
                  track.slug,
                  releaseSlug,
                  release.trackCount,
                )`,
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
