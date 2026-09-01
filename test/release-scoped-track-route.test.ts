import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  canonicalTrackUrl,
  isRegistryTrackId,
  releaseTrackUrl,
  trackUrl,
} from "../src/utils/trackUrl";

const NERVOUS_TRACK_ID =
  "f44a42c8-2a91-49f4-8582-8955365823f7";

describe("Registry ID Track route authority", () => {
  it("anchors canonical Track identity on the Registry Track ID", () => {
    expect(isRegistryTrackId(NERVOUS_TRACK_ID)).toBe(true);

    expect(
      canonicalTrackUrl(
        NERVOUS_TRACK_ID,
        "Nervous",
      ),
    ).toBe(
      `/tracks/${NERVOUS_TRACK_ID}/nervous`,
    );

    expect(
      trackUrl("Nervous", ["Bee Thee Artiste"]),
    ).toBe(
      "/tracks/bee-thee-artiste/nervous",
    );

    expect(
      releaseTrackUrl(
        "Ywaya Tajiri",
        "Nervous Single",
        "Nervous",
      ),
    ).toBe(
      "/releases/ywaya-tajiri/nervous-single/nervous",
    );
  });

  it("keeps Artist and Release Track paths as compatibility aliases only", () => {
    const routeAuthority = readFileSync(
      "shared/registry/public-track-route.ts",
      "utf8",
    );
    const trackUrlSource = readFileSync(
      "src/utils/trackUrl.ts",
      "utf8",
    );
    const router = readFileSync(
      "src/router/config.tsx",
      "utf8",
    );

    expect(routeAuthority).toContain(
      "registryTrackUrl(",
    );
    expect(routeAuthority).toContain(
      "legacyArtistTrackUrl(",
    );
    expect(routeAuthority).toContain(
      "legacyReleaseTrackUrl(",
    );
    expect(routeAuthority).toContain(
      'kind: "registry_track_id"',
    );

    expect(trackUrlSource).toContain(
      "canonicalTrackUrl(",
    );
    expect(trackUrlSource).toContain(
      "return registryTrackUrl(",
    );
    expect(trackUrlSource).not.toContain(
      "releaseTrackCount",
    );

    expect(router).toContain(
      "/tracks/:artistSlug/:trackSlug",
    );
    expect(router).toContain(
      "/releases/:artistSlug/:releaseSlug/:trackSlug",
    );
  });

  it("makes every Release Track link use the Registry Track identity", () => {
    const desktopRelease = readFileSync(
      "src/pages/releases/detail/components/ReleaseTracklist.tsx",
      "utf8",
    );
    const desktopReleasePage = readFileSync(
      "src/pages/releases/detail/page.tsx",
      "utf8",
    );
    const mobileRelease = readFileSync(
      "src/pages/mobile/releases/detail/page.tsx",
      "utf8",
    );

    for (const source of [
      desktopRelease,
      desktopReleasePage,
      mobileRelease,
    ]) {
      expect(source).toContain(
        "canonicalTrackUrl(",
      );
    }

    expect(desktopRelease).toContain(
      "track.id,",
    );
    expect(desktopRelease).not.toContain(
      "release.trackCount,",
    );

    expect(desktopReleasePage).toContain(
      "data.tracks[0].id,",
    );
    expect(mobileRelease).toContain(
      "data.tracks[0].id,",
    );
    expect(mobileRelease).toContain(
      "track.id,",
    );
    expect(mobileRelease).not.toContain(
      "release.trackCount,",
    );
  });

  it("resolves legacy aliases before rendering canonical Track detail", () => {
    const trackPage = readFileSync(
      "src/pages/tracks/detail/page.tsx",
      "utf8",
    );
    const aliasSurface = readFileSync(
      "src/pages/tracks/detail/components/TrackAliasDisambiguation.tsx",
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

    expect(trackPage).toContain(
      "resolveTrackAlias(",
    );
    expect(trackPage).toContain(
      "isRegistryTrackId(artistSlug)",
    );
    expect(trackPage).toContain(
      "resolution.kind === \"ambiguous\"",
    );
    expect(trackPage).toContain(
      "<TrackAliasDisambiguation",
    );
    expect(trackPage).toContain(
      "String(scopedTrack.track.id)",
    );
    expect(trackPage).toContain(
      "canonicalTrackUrl(",
    );
    expect(trackPage).toContain(
      "nextTrack.id,",
    );
    expect(trackPage).not.toContain(
      "const hasPublicRelease =",
    );
    expect(trackPage).not.toContain(
      "const scopedPath = releaseTrackUrl(",
    );

    expect(aliasSurface).toContain(
      "More than one Track matches this old link.",
    );
    expect(aliasSurface).toContain(
      "candidate.canonicalPath",
    );
    expect(aliasSurface).toContain(
      "candidate.isrc",
    );

    expect(publicClient).toContain(
      "/track-aliases/",
    );
    expect(publicGateway).toContain(
      'path.startsWith("/track-aliases/")',
    );
    expect(publicGateway).toContain(
      'kind: "ambiguous"',
    );
    expect(publicGateway).toContain(
      "routeRegistryTrackId",
    );
    expect(publicGateway).toContain(
      '.eq("id", routeRegistryTrackId)',
    );
    expect(publicGateway).toContain(
      "registryTrackUrl(",
    );
  });

  it("makes lyrics contribution inherit the same Track identity", () => {
    const lyricsPage = readFileSync(
      "src/pages/tracks/lyrics/contribute/page.tsx",
      "utf8",
    );

    expect(lyricsPage).toContain(
      "resolveTrackAlias(",
    );
    expect(lyricsPage).toContain(
      "isRegistryTrackId(artistSlug)",
    );
    expect(lyricsPage).toContain(
      "registryTrackId,",
    );
    expect(lyricsPage).toContain(
      "canonicalTrackUrl(",
    );
    expect(lyricsPage).toContain(
      "/lyrics/contribute",
    );
    expect(lyricsPage).not.toContain(
      "Number(releaseTrackCount || 0) <= 1",
    );
  });

  it("keeps legacy Track aliases out of canonical SEO and sitemap output", () => {
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
    const sitemapHtml = readFileSync(
      "scripts/seo/build-public-sitemap-html.mjs",
      "utf8",
    );

    expect(pageTitle).toContain(
      "isRegistryTrackId(parts[1] || \"\")",
    );
    expect(pageTitle).toContain(
      '? "index, follow"',
    );
    expect(pageTitle).toContain(
      ': "noindex, follow"',
    );
    expect(pageTitle).toContain(
      'section === "releases" && parts.length >= 4',
    );

    expect(prerender).toContain(
      "REGISTRY_TRACK_ID_PATTERN",
    );
    expect(prerender).toContain(
      'parts[0] === "releases" && parts.length >= 4',
    );
    expect(prerender).toContain(
      "entry.canonicalTrackId && entry.trackSlug",
    );

    expect(sitemapFunction).toContain(
      "const canonicalPath = registryTrackUrl(",
    );
    expect(sitemapFunction).not.toContain(
      "path: `/releases/${releaseArtistSlug}/${releaseSlug}/${row.slug}`",
    );
    expect(sitemapFunction).not.toContain(
      "? `/tracks/${artistSlug}/${row.slug}`",
    );

    expect(sitemapHtml).toContain(
      "REGISTRY_TRACK_ID_PATTERN",
    );
    expect(sitemapHtml).toContain(
      'parts[0] === "releases" && parts.length >= 4',
    );
  });

  it("keeps Track product capability while changing route authority", () => {
    const trackPage = readFileSync(
      "src/pages/tracks/detail/page.tsx",
      "utf8",
    );

    expect(trackPage).toContain("From This Release");
    expect(trackPage).not.toContain("Back to Release");
    expect(trackPage).not.toContain("View release");
    expect(trackPage).not.toContain("Track profile");
    expect(trackPage).toContain("Track Details");
    expect(trackPage).toContain("Registry Details");
    expect(trackPage).toContain("Your Listening");
    expect(trackPage).toContain("<ShareSheet");
    expect(trackPage).toContain("reactionStyle");
    expect(trackPage).toContain('import { PlayableArtwork }');
    expect(trackPage).toContain("<PlayableArtwork");
    expect(trackPage).toContain("if (hasPlayableSource) handlePlay();");
    expect(trackPage).toContain('import { TrackActionsMenu }');
    expect((trackPage.match(/<TrackActionsMenu/g) || []).length).toBe(1);
    expect(trackPage).toContain("const artistNames =");
    expect(trackPage).toContain("{vm.title}");
    expect(trackPage).toContain("{artistNames}");
    expect(trackPage).toContain("formatDuration(vm.duration)");
    expect(trackPage).toContain("if (canPlay) onPlay();");
    expect(trackPage).toContain("isPlaying={isPlaying}");
    expect(trackPage).toContain("onPlay={handlePlay}");
    expect(trackPage).toContain("isPlaying={isTrackPlaying}");
    expect(trackPage).toContain("canPlay={hasPlayableSource}");
    expect(trackPage).toContain(
      "track.artists.length > 1 && <ConnectedArtists",
    );
    expect(trackPage).toContain("entityId: track.id,");
    expect(trackPage).toContain("entitySlug: track.slug,");
    expect(trackPage).not.toContain("entityId: track.slug,");
    expect(trackPage).toContain("getUserSaves(user.id)");
    expect(trackPage).toContain('saved.entity_type === "track"');
    expect(trackPage).toContain("saved.entity_id === track.id");
    expect(trackPage).toContain("registryTrackId={vm.id}");
    expect(trackPage).toContain("trackHref={trackActionsHref}");
    expect(trackPage).not.toContain("trackHref={location.pathname}");

    for (const capability of [
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
      "handlePlay",
      "handleSaveTrack",
      "AddToPlaylistButton",
      "lyricsContributionPath",
    ]) {
      expect(trackPage).toContain(capability);
    }
  });
});

describe("public Release boundary", () => {
  it("keeps one-track packages off the Release shelf", () => {
    const service = readFileSync(
      "src/services/publicContent/client.ts",
      "utf8",
    );
    const releasePage = readFileSync(
      "src/pages/releases/page.tsx",
      "utf8",
    );
    const gateway = readFileSync(
      "supabase/functions/public-content-read/index.ts",
      "utf8",
    );

    expect(service).toContain(
      "return (trackCountByRelease.get(id) || 0) > 1;",
    );
    expect(releasePage).not.toContain(
      '"All", "Album", "EP", "Single"',
    );
    expect(releasePage).not.toContain(
      "Albums, EPs & singles",
    );
    expect(gateway).toContain(
      "(trackCountByRelease.get(String(release.id)) || 0) > 1",
    );
    expect(gateway).toContain(
      "releaseScopedMembership ?? null",
    );
  });

  it("makes the legacy API advertise Registry Track identity", () => {
    const legacyApi = readFileSync(
      "supabase/functions/wakilisha-public-api/index.ts",
      "utf8",
    );

    expect(legacyApi).toContain(
      'from("registry_release_tracks")',
    );
    expect(legacyApi).toContain(
      "registryTrackUrl(",
    );
    expect(legacyApi).toContain(
      "routeRegistryTrackId",
    );
    expect(legacyApi).toContain(
      "ambiguous_legacy_track_alias",
    );
    expect(legacyApi).toContain(
      'publicIdentity: { kind: "track", canonicalPath: registryTrackUrl',
    );
    expect(legacyApi).not.toContain(
      "`/tracks/${canonicalArtistSlug}/${canonicalTrackSlug}`",
    );
  });
});
