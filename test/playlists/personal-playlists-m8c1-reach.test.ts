import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const addButton = read("src/components/playlists/AddToPlaylistButton.tsx");
const trackActionsMenu = read("src/components/tracks/TrackActionsMenu.tsx");
const playableArtwork = read("src/components/design-system/music/PlayableArtwork.tsx");
const chartRow = read("src/components/design-system/music/ChartRow.tsx");
const chartDirectory = read("src/pages/charts/directory/page.tsx");
const releaseTracklist = read("src/pages/releases/detail/components/ReleaseTracklist.tsx");
const siblingReleaseTracklist = read("src/pages/tracks/detail/components/TrackReleaseTracklist.tsx");
const articleTrackEmbeds = read("src/pages/magazine/article/components/ArticleTrackEmbeds.tsx");
const mobileReleasePage = read("src/pages/mobile/releases/detail/page.tsx");
const musicPage = read("src/pages/music/page.tsx");
const player = read("src/context/PlayerContext.tsx");
const playerDock = read("src/components/design-system/music/PlayerDock.tsx");
const mobilePlayer = read("src/components/mobile/MobileFullPlayer.tsx");
const releaseHero = read("src/pages/releases/detail/components/ReleaseDetailHero.tsx");
const mobileRelease = read("src/pages/mobile/releases/detail/page.tsx");
const siblingTracks = read("src/pages/tracks/detail/components/TrackReleaseTracklist.tsx");
const artistTopSongs = read("src/pages/artists/detail/components/ArtistTopSongs.tsx");
const artistAuthorityPanel = read("src/pages/artists/detail/components/ArtistAuthorityPanel.tsx");
const musicDesktopShell = read("src/components/music/MusicDesktopShell.tsx");
const trackSearch = read("src/hooks/useTrackSearchData.ts");
const chartSearch = read("src/hooks/useChartSearchData.ts");
const searchPage = read("src/pages/search/page.tsx");
const articleTracks = read("src/pages/magazine/article/components/ArticleTrackEmbeds.tsx");
const chartEdge = read("supabase/functions/public-content-read/index.ts");
const chartTypes = read("src/services/chartsPublic/types.ts");
const chartAdapter = read("src/services/chartsPublic/v2Adapter.ts");
const chartViewModels = read("src/services/chartsPublic/viewModels.ts");
const chartExpanded = read("src/components/design-system/music/ChartRowExpandedPanel.tsx");
const chartDesktop = read("src/pages/charts/edition/page.tsx");
const chartMobile = read("src/pages/mobile/charts/edition/page.tsx");
const posts = read("src/services/community/posts.ts");
const personalPlaylistService = read("src/services/playlists/personalPlaylistService.ts");
const releaseSaveButton = read("src/components/releases/ReleaseSaveButton.tsx");
const duplicateConfirmationMigration = read("supabase/migrations/20260816185425_personal_playlist_duplicate_track_confirmation.sql");

describe("M8C.1 Track curation reach", () => {
  it("keeps Add to Playlist bound to canonical Registry Track identity", () => {
    expect(addButton).toContain("trackId: string | null | undefined");
    expect(addButton).toContain("addPersonalPlaylistTrack");
    expect(addButton).toContain("iconOnly?: boolean");
    expect(player).toContain("registryTrackId?: string | null");
  });

  it("covers Release discovery without treating a multi-track Release as one Track", () => {
    expect(releaseTracklist).toContain("registryTrackId={track.id}");
    expect(releaseTracklist).toContain("<TrackActionsMenu");
    expect(releaseTracklist).toContain("trackHref={releaseTrackUrl(artistSlug, release.slug, track.slug)}");
    expect(releaseTracklist).not.toContain("Personal Playlist curation");
    expect(releaseTracklist).not.toContain("Chevron to detail page");
    expect(mobileRelease).toContain("registryTrackId={track.id}");
    expect(mobileRelease).toContain("<TrackActionsMenu");
    expect(mobileRelease).toContain("trackHref={releaseTrackUrl(artistSlug, releaseSlug, track.slug)}");
    expect(mobileRelease).toContain("trackId={release.tracks[0].id}");
    expect(siblingTracks).toContain("trackId={track.id}");
    expect(releaseHero).toContain("tracks.length === 1");
    expect(releaseHero).toContain("trackId={tracks[0].id}");
    expect(mobileRelease).toContain("release.tracks.length === 1");
  });

  it("covers Artist, Search, Article, and Player discovery", () => {
    expect(artistTopSongs).toContain("registryTrackId={song.id}");
    expect(artistTopSongs).toContain("<TrackActionsMenu");
    expect(artistTopSongs).toContain("registryTrackId: song.id");
    expect(trackSearch).toContain("id: track.id");
    expect(trackSearch).toContain("previewUrl");
    expect(searchPage).toContain("registryTrackId={track.id}");
    expect(searchPage).toContain("<TrackActionsMenu");
    expect(searchPage).toContain("previewUrl: track.previewUrl ?? undefined");
    expect(articleTracks).toContain("id: row.id");
    expect(articleTracks).toContain("trackId={track.id}");
    expect(playerDock).toContain("currentTrack.registryTrackId");
    expect(mobilePlayer).toContain("currentTrack.registryTrackId");
  });

  it("threads canonical Chart Track ids from Edge authority into Chart curation", () => {
    expect(chartEdge).toContain("canonicalTrackId: e.canonical_track_id");
    expect(chartTypes).toContain("canonicalTrackId?: string | null");
    expect(chartAdapter).toContain("canonicalTrackId: entry.canonicalTrackId ?? null");
    expect(chartViewModels).toContain("registryTrackId: entry.canonicalTrackId ?? null");
    expect(chartRow).toContain("trackId={registryTrackId}");
    expect(chartExpanded).toContain("trackId={registryTrackId}");
    expect(chartDesktop).toContain("trackId={topTrack.registryTrackId}");
    expect(chartDesktop).toContain("registryTrackId={entry.registryTrackId}");
    expect(chartMobile).toContain("trackId={topTrack.registryTrackId}");
    expect(chartDirectory).toContain("trackId={entry.registryTrackId}");
    expect(musicPage).toContain("trackId={entry.canonicalTrackId}");
    expect(chartSearch).toContain("canonicalTrackId: e.canonical_track_id || null");
    expect(searchPage).toContain("registryTrackId={entry.canonicalTrackId}");
  });

  it("keeps the Playlist chooser viewport-bound and Single heroes compact", () => {
    expect(addButton).toContain('import {\n  Portal,\n} from "@/components/base/Portal";');
    expect(addButton).toContain("useScrollLock(open)");
    expect(addButton).toContain("<Portal>");
    expect(addButton).toContain("reactionStyle?: boolean");
    expect(releaseHero).toContain("const isSingleTrack = tracks.length === 1");
    expect(releaseHero).toContain("reactionStyle");
    expect(releaseHero).toContain("open={shareOpen}");
    expect(mobileRelease).toContain("release.tracks.length === 1 ? (");
    expect(mobileRelease).toContain("reactionStyle");
    expect(mobileRelease).toContain("onClick={handleShuffleRelease}");
  });

  it("guides duplicate Playlist membership and allows only explicit duplicate adds", () => {
    expect(addButton).toContain("Already added");
    expect(addButton).toContain("Add another copy?");
    expect(addButton).toContain("Add again");
    expect(addButton).toContain("duplicateConfirmPlaylistId");
    expect(addButton).not.toContain("window.confirm");
    expect(personalPlaylistService).toContain("allowDuplicate?: boolean");
    expect(personalPlaylistService).toContain("p_allow_duplicate: options.allowDuplicate ?? false");
    expect(duplicateConfirmationMigration).toContain("p_allow_duplicate boolean default false");
    expect(duplicateConfirmationMigration).toContain("not coalesce(p_allow_duplicate, false)");
  });

  it("gives desktop and mobile Release Save real authority and mobile action parity", () => {
    expect(releaseSaveButton).toContain("getUserSaves");
    expect(releaseSaveButton).toContain("setSaved");
    expect(releaseSaveButton).toContain('entityType: "release"');
    expect(releaseHero).toContain("<ReleaseSaveButton");
    expect(mobileRelease).toContain("<ReleaseSaveButton");
    expect(mobileRelease).toContain("<MobileShareButton");
  });

  it("lets listeners create a Playlist in the chooser and immediately add the current Track", () => {
    expect(addButton).toContain("createPersonalPlaylist");
    expect(addButton).toContain("Create new Playlist");
    expect(addButton).toContain("Start a new vibe");
    expect(addButton).toContain("Create and add");
    expect(addButton).toContain('visibility: "private"');
    expect(addButton).toContain("created.authorityRevision");
    expect(addButton).toContain("created.playlistId");
    expect(addButton).not.toContain("/playlists?create=1");
  });

  it("makes Search query URLs shareable and immediately actionable", () => {
    expect(searchPage).toContain("useSearchParams");
    expect(searchPage).toContain('searchParams.get("q") ?? ""');
    expect(searchPage).toContain("useState(urlQuery)");
    expect(searchPage).toContain('nextParams.set("q", nextQuery)');
    expect(searchPage).toContain('nextParams.delete("q")');
    expect(searchPage).toContain("setSearchParams(nextParams, { replace: true })");
    expect(searchPage).toContain("updateQuery(event.target.value)");
  });

  it("keeps public Artist ownership affordance quiet", () => {
    expect(artistAuthorityPanel).toContain("Claim this Artist");
    expect(artistAuthorityPanel).toContain("ri-user-add-line");
    expect(artistAuthorityPanel).not.toContain("WAKILISHA Registry");
    expect(artistAuthorityPanel).not.toContain("Official Artist");
    expect(artistAuthorityPanel).not.toContain("Built from WAKILISHA's reviewed music records.");
    expect(artistAuthorityPanel).not.toContain("Managed by the Artist or their team.");
    expect(artistAuthorityPanel).not.toContain("ri-check-line");
    expect(artistAuthorityPanel).not.toContain(">Reviewed<");
  });

  it("makes Search a real sidebar control without advertising a false Mac-only shortcut", () => {
    expect(musicDesktopShell).toContain('to="/search"');
    expect(musicDesktopShell).toContain('role="search"');
    expect(musicDesktopShell).toContain('placeholder="Search WAKILISHA"');
    expect(musicDesktopShell).toContain("submitSearch");
    expect(musicDesktopShell).not.toContain("⌘ K");
  });

  it("keeps Artist Top Songs readable, quiet, and free of a reserved Play slot", () => {
    expect(artistTopSongs).toContain("sm:w-10");
    expect(artistTopSongs).toContain("sm:text-[20px]");
    expect(artistTopSongs).toContain("sm:text-[14px]");
    expect(artistTopSongs).toContain("registryTrackId={song.id}");
    expect(artistTopSongs).toContain("<TrackActionsMenu");
    expect(artistTopSongs).toContain("<PlayableArtwork");
    expect(artistTopSongs).not.toContain("whitespace-nowrap sm:flex");
    expect(artistTopSongs).not.toContain("Reviewed connection");
    expect(artistTopSongs).not.toContain("Reviewed by WAKILISHA");
    expect(artistTopSongs).not.toContain("ri-check-line");
    expect(artistTopSongs).not.toContain(">Reviewed<");
  });

  it("uses one shared Track actions menu instead of permanent Playlist chrome on Search and Artist rows", () => {
    expect(trackActionsMenu).toContain("AddToPlaylistButton");
    expect(trackActionsMenu).toContain("Save Track");
    expect(trackActionsMenu).toContain("Follow Artist");
    expect(trackActionsMenu).toContain("Share");
    expect(trackActionsMenu).toContain("View Track");
    expect(trackActionsMenu).toContain("Go to Artist");
    expect(trackActionsMenu).toContain("Suggest a Correction");
    expect(trackActionsMenu).toContain("trackHref?: string | null");
    expect(trackActionsMenu).toContain("onDiscuss?: (() => void) | null");
    expect(trackActionsMenu).toContain("Discuss Track");
    expect(trackActionsMenu).toContain("ri-more-2-fill");
    expect(trackActionsMenu).not.toContain("Report");
    expect(addButton).toContain("menuRow?: boolean");
    expect(searchPage).toContain("registryTrackId={entry.canonicalTrackId}");
    expect(searchPage).not.toContain("<AddToPlaylistButton");
    expect(artistTopSongs).not.toContain("<AddToPlaylistButton");
  });

  it("makes artwork the Play surface instead of reserving standalone row controls", () => {
    expect(playableArtwork).toContain("group/playable-art");
    expect(playableArtwork).toContain("group-hover/playable-art");
    expect(playableArtwork).toContain("group-focus-visible/playable-art");
    expect(playableArtwork).toContain("group-active/playable-art");
    expect(searchPage).toContain("<PlayableArtwork");
    expect(searchPage).not.toContain("group-hover:opacity-100 disabled:opacity-0");
    expect(chartRow).toContain("<PlayableArtwork");
    expect(chartRow).not.toContain("{/* Play button */}");
    expect(chartDirectory).toContain("<PlayableArtwork");
    expect(chartDirectory).not.toContain("{/* Play button */}");
    expect(releaseTracklist).toContain("<PlayableArtwork");
    expect(releaseTracklist).not.toContain("Track number / play button");
    expect(siblingReleaseTracklist).toContain("<PlayableArtwork");
    expect(siblingReleaseTracklist).not.toContain("Track number / play button / current indicator");
    expect(articleTrackEmbeds).toContain("<PlayableArtwork");
    expect(articleTrackEmbeds).not.toContain("Play button + link");
    expect(mobileReleasePage).toContain("<PlayableArtwork");
    expect(musicPage).toContain("<PlayableArtwork");
  });

  it("lets Post Track attachments use canonical Registry Track identity", () => {
    expect(posts).toContain("registryTrackId");
    expect(posts).toContain("p_registry_track_id");
    expect(posts).not.toContain("canonicalTrackId");
  });
});
