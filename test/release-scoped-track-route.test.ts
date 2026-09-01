import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  canonicalTrackUrl,
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

  it("makes one-track provider packages canonical Tracks", () => {
    expect(
      trackUrl("Valle", ["Matata"]),
    ).toBe("/tracks/matata/valle");

    expect(
      canonicalTrackUrl(
        "bee-thee-artiste",
        "nervous",
        "nervous-single",
        1,
      ),
    ).toBe(
      "/tracks/bee-thee-artiste/nervous",
    );

    expect(
      canonicalTrackUrl(
        "nyashinski",
        "legendary",
        "lucky-you",
        12,
      ),
    ).toBe(
      "/releases/nyashinski/lucky-you/legendary",
    );
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
      "const trackHref = canonicalTrackUrl(",
    );
    expect(desktopRelease).toContain(
      "release.trackCount,",
    );
    expect(desktopRelease).not.toContain(
      "releaseTrackUrl(",
    );
    expect(mobileRelease).toContain(
      "const trackHref = canonicalTrackUrl(",
    );
    expect(mobileRelease).toContain(
      "release.trackCount,",
    );
    expect(mobileRelease).not.toContain(
      "releaseTrackUrl(",
    );
    expect(trackPage).toContain(
      "getReleaseTrack(",
    );
    expect(trackPage).toContain(
      "releaseSlug,",
    );
    expect(trackPage).toContain(
      "trackSlug,",
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
    expect(lyricsPage).toContain(
      "const standaloneLyricsPath =",
    );
    expect(lyricsPage).toContain(
      "canonicalTrackUrl(",
    );
    expect(lyricsPage).toContain(
      "Number(releaseTrackCount || 0) <= 1",
    );
    expect(lyricsPage).not.toContain(
      "releaseTrackUrl(",
    );
    expect(redirectService).toContain(
      "releaseSlug?: string",
    );
    expect(redirectService).toContain(
      "return `/releases/${scopeSlug}/${releaseSlug}/`;",
    );
    expect(redirectService).toContain(
      "expectedPrefixes.push(",
    );
    expect(redirectService).toContain(
      "`/tracks/${scopeSlug}/`",
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
      "directReleaseTracks",
    );
    expect(publicGateway).toContain(
      '.eq("release_id", String(scopedRelease.id))',
    );
    expect(publicGateway).toContain(
      '.select("release_id, track_id, track_number, disc_number")',
    );
  });
  it("uses the Release design grammar without dropping Track capability", () => {
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
    expect(trackPage).toContain(
      "}, [user.id, user.loading, track?.id]);",
    );
    expect(trackPage).not.toContain(
      "track.artists.length > 0 && <ConnectedArtists",
    );
    expect(trackPage).toContain("registryTrackId={vm.id}");
    expect(trackPage).toContain("trackHref={trackActionsHref}");
    expect(trackPage).not.toContain("trackHref={location.pathname}");
    expect(trackPage).not.toContain('name="ChevronRight"');
    expect(trackPage).not.toContain("const trackPosition =");
    expect(trackPage).not.toContain("const releaseDate =");
    expect(trackPage).not.toContain("const meta =");
    expect(trackPage).toContain('gridTemplateColumns: "44px minmax(0, 1fr) auto 40px"');
    expect(trackPage).not.toContain("grid-cols-[88px_minmax(0,1fr)]");

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

  it("makes only multi-track Releases own release-scoped canonical URLs", () => {
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
      "nextTrack.albumTotalTracks > 1",
    );
    expect(trackPage).toContain(
      "const standalonePath = trackUrl(",
    );
    expect(trackPage).toContain(
      "const scopedPath = releaseTrackUrl(",
    );
    expect(trackPage).toContain(
      "const canonicalPath = canonicalTrackUrl(",
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
      '.from("registry_release_tracks")',
    );
    expect(sitemapFunction).toContain(
      "releaseTrackCountByReleaseId",
    );
    expect(sitemapFunction).toContain(
      "path: `/releases/${releaseArtistSlug}/${releaseSlug}/${row.slug}`",
    );
    expect(sitemapFunction).toContain(
      "if (scopedItems.length)",
    );
    expect(sitemapFunction).toContain(
      "releaseTrackCountByReleaseId.get(membership.releaseId)",
    );
    expect(sitemapFunction).toContain(
      'action === "xml_live"',
    );
    expect(sitemapFunction).toContain(
      '"registry_artists",',
    );
    expect(sitemapFunction).toContain(
      '"registry_releases",',
    );
    expect(sitemapFunction).toContain(
      '"registry_tracks",',
    );
    expect(sitemapFunction).toContain(
      '"registry_release_tracks",',
    );
    expect(sitemapFunction).toContain(
      '"registry_release_artists",',
    );
    expect(sitemapFunction).toContain(
      '"registry_track_artists",',
    );
    expect(sitemapFunction).toContain(
      '.order("id", { ascending: true })',
    );
    expect(sitemapFunction).toContain(
      ".range(from, to)",
    );
    expect(prerender).toContain(
      "PRERENDER_FETCH_TIMEOUT_MS",
    );
    expect(prerender).toContain(
      "PRERENDER_MANIFEST_TIMEOUT_MS",
    );
    expect(prerender).toContain(
      "SEO_PRERENDER_MANIFEST_TIMEOUT_MS",
    );
    expect(prerender).toContain(
      "fetchWithTimeout(",
    );
    expect(prerender).toContain(
      '"Track metadata"',
    );
    expect(prerender).toContain(
      'clean === "/sitemap.html"',
    );
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

  it("converges the legacy public API on canonical Release membership", () => {
    const legacyApi = readFileSync(
      "supabase/functions/wakilisha-public-api/index.ts",
      "utf8",
    );

    expect(legacyApi).toContain(
      'from("registry_release_tracks")',
    );
    expect(legacyApi).toContain(
      "if (trackCount <= 1) continue;",
    );
    expect(legacyApi).toContain(
      "const publicReleases = (releases ?? []).filter",
    );
    expect(legacyApi).toContain(
      "(trackCountByRelease.get(String(release.id)) || 0) > 1",
    );
    expect(legacyApi).toContain(
      "if (releaseTrackCount > 1) releaseCountByArtist.set",
    );
    expect(legacyApi).toContain(
      "let releaseMembership: { release_id: string; track_number?: number; disc_number?: number } | null = null;",
    );
    expect(legacyApi).toContain(
      "const releaseIdFromMembership = releaseMembership?.release_id",
    );
    expect(legacyApi).toContain(
      "if (!releaseMembership && track.release_id)",
    );
    expect(legacyApi).toContain(
      'kind: "track"',
    );
    expect(legacyApi).toContain(
      "const canonicalTrackSlug = cleanPublicMusicSlug(",
    );
    expect(legacyApi).toContain(
      "canonicalArtistSlug && canonicalTrackSlug",
    );
    expect(legacyApi).toContain(
      "`/tracks/${canonicalArtistSlug}/${canonicalTrackSlug}`",
    );
    expect(legacyApi).not.toContain(
      '.from("registry_tracks").select("id, release_id, title, slug").in("release_id", releaseIds)',
    );
  });
});
