import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const router =
  readFileSync(
    "src/router/config.tsx",
    "utf8",
  );

const lazyPublic =
  readFileSync(
    "src/router/lazyPublic.tsx",
    "utf8",
  );

const service =
  readFileSync(
    "src/services/people/personPublicService.ts",
    "utf8",
  );

const personPage =
  readFileSync(
    "src/pages/people/detail/page.tsx",
    "utf8",
  );

const authorPage =
  readFileSync(
    "src/pages/authors/detail/page.tsx",
    "utf8",
  );

const publicAccountPage =
  readFileSync(
    "src/pages/profile/public/page.tsx",
    "utf8",
  );

const ownerProfilePage =
  readFileSync(
    "src/pages/profile/page.tsx",
    "utf8",
  );

const mobileOwnerProfilePage =
  readFileSync(
    "src/pages/mobile/profile/page.tsx",
    "utf8",
  );

const followingPresentation =
  readFileSync(
    "src/services/community/followingPresentation.ts",
    "utf8",
  );

const communityService =
  readFileSync(
    "src/services/community/service.ts",
    "utf8",
  );

const communityTypes =
  readFileSync(
    "src/services/community/types.ts",
    "utf8",
  );

const followingFeedService =
  readFileSync(
    "src/services/community/followingFeed.ts",
    "utf8",
  );

const followingFeedPage =
  readFileSync(
    "src/pages/following/page.tsx",
    "utf8",
  );

const shareInfrastructure =
  readFileSync(
    "src/components/design-system/share/ShareSheet.tsx",
    "utf8",
  );

const appTopBar =
  readFileSync(
    "src/components/layout/AppTopBar.tsx",
    "utf8",
  );

const mobileAppLayout =
  readFileSync(
    "src/components/mobile/MobileAppLayout.tsx",
    "utf8",
  );

const mobileChromeCss =
  readFileSync(
    "src/styles/wakilisha-mobile-ch53-75.css",
    "utf8",
  );

const desktopMagazine =
  readFileSync(
    "src/pages/magazine/page.tsx",
    "utf8",
  );

const mobileMagazine =
  readFileSync(
    "src/pages/mobile/magazine/page.tsx",
    "utf8",
  );

const magazineCard =
  readFileSync(
    "src/pages/magazine/components/MagazineCard.tsx",
    "utf8",
  );

const chartsDirectory =
  readFileSync(
    "src/pages/charts/directory/page.tsx",
    "utf8",
  );

const chartHighlights =
  readFileSync(
    "src/pages/charts/directory/components/ChartHighlights.tsx",
    "utf8",
  );

const chartEdition =
  readFileSync(
    "src/pages/charts/edition/page.tsx",
    "utf8",
  );

const chartRow =
  readFileSync(
    "src/components/design-system/music/ChartRow.tsx",
    "utf8",
  );

const artistRolodex =
  readFileSync(
    "src/pages/charts/directory/components/ArtistRolodex.tsx",
    "utf8",
  );

const mobileChartEdition =
  readFileSync(
    "src/pages/mobile/charts/edition/page.tsx",
    "utf8",
  );

const artistsPage =
  readFileSync(
    "src/pages/artists/components/ArtistsPageContent.tsx",
    "utf8",
  );

const artistChartList =
  readFileSync(
    "src/pages/artists/components/ChartList.tsx",
    "utf8",
  );

const artistCoverStories =
  readFileSync(
    "src/pages/artists/components/CoverStories.tsx",
    "utf8",
  );

const publicContentRead =
  readFileSync(
    "supabase/functions/public-content-read/index.ts",
    "utf8",
  );

const profileCss =
  readFileSync(
    "src/styles/wakilisha-profile-48.css",
    "utf8",
  );

describe(
  "public Person surface",
  () => {
    it(
      "keeps /u and /people as concurrent first-class routes",
      () => {
        expect(router)
          .toContain(
            'path: "/u/:username"',
          );

        expect(router)
          .toContain(
            'path: "/people/:slug"',
          );

        expect(router)
          .toContain(
            "PublicProfilePage",
          );

        expect(router)
          .toContain(
            "PersonDetailPage",
          );

        expect(lazyPublic)
          .toContain(
            "PersonDetailPage",
          );

        expect(lazyPublic)
          .toContain(
            "../pages/people/detail/page",
          );
      },
    );

    it(
      "keeps the owner Profile route behind authentication",
      () => {
        expect(router)
          .toContain(
            "function AuthenticatedProfileRoute",
          );

        expect(router)
          .toContain(
            "const authUser = useAuthUser();",
          );

        expect(router)
          .toContain(
            'return <Navigate to="/auth" replace />;',
          );

        expect(router)
          .toContain(
            'path: "/profile", element: <AuthenticatedProfileRoute />',
          );
      },
    );

    it(
      "keeps Person identity and work membership on governed RPCs",
      () => {
        expect(service)
          .toContain(
            '"get_public_person"',
          );

        expect(service)
          .toContain(
            '"list_public_person_work"',
          );

        expect(service)
          .toContain(
            '"get_public_person_social_summary"',
          );

        expect(service)
          .toContain(
            "followingCount",
          );

        expect(service)
          .toContain(
            '"following_count"',
          );

        expect(service)
          .toContain(
            '"community_get_person_follow_state"',
          );

        expect(service)
          .not.toContain(
            '.from("registry_authors")',
          );

        expect(service)
          .not.toContain(
            '.from("community_follows")',
          );

        expect(personPage)
          .not.toContain(
            "registry_authors",
          );

        expect(personPage)
          .not.toContain(
            "getArticlesByAuthor",
          );

        expect(personPage)
          .not.toContain(
            "resolveAuthorMeta",
          );
      },
    );

    it(
      "uses public Magazine data only to enrich already-governed Article work",
      () => {
        expect(personPage)
          .toContain(
            "listAllPublicPersonWork",
          );

        expect(personPage)
          .toContain(
            "listMagazineArticles",
          );

        expect(personPage)
          .toContain(
            "governedArticleSlugs",
          );

        expect(personPage)
          .toContain(
            "articleBySlug",
          );

        expect(personPage)
          .toContain(
            "loadedWork.map",
          );
      },
    );

    it(
      "follows stable Person Resource identity from both public profile routes",
      () => {
        expect(personPage)
          .toContain(
            "useEntityActions",
          );

        expect(personPage)
          .toContain(
            '"person"',
          );

        expect(personPage)
          .toContain(
            "person.personId",
          );

        expect(publicAccountPage)
          .toContain(
            "useEntityActions",
          );

        expect(publicAccountPage)
          .toContain(
            "person.personId",
          );

        expect(publicAccountPage)
          .toContain(
            "getPersonFollowState",
          );

        expect(communityTypes)
          .toContain(
            "| 'person'",
          );

        expect(personPage)
          .not.toContain(
            "community_follows",
          );

        expect(publicAccountPage)
          .not.toContain(
            "community_follows",
          );
      },
    );

    it(
      "supports merged Person redirects and the complete current-public work feed",
      () => {
        expect(personPage)
          .toContain(
            "loadedPerson.redirectTo",
          );

        expect(personPage)
          .toContain(
            "replace: true",
          );

        expect(personPage)
          .toContain(
            "MAX_WORK_PAGES",
          );

        expect(personPage)
          .toContain(
            "WORK_PAGE_SIZE",
          );

        expect(personPage)
          .toContain(
            'id: "articles"',
          );

        expect(personPage)
          .toContain(
            'id: "playlists"',
          );

        expect(personPage)
          .not.toContain(
            "Body of Work",
          );
      },
    );

    it(
      "keeps follower identities private while surfacing follower count",
      () => {
        expect(service)
          .toContain(
            "followerCount",
          );

        expect(personPage)
          .toContain(
            "followerCount",
          );

        expect(publicAccountPage)
          .toContain(
            "followerCount",
          );

        expect(service)
          .not.toContain(
            "follower_ids",
          );

        expect(service)
          .not.toContain(
            "followers:",
          );

        expect(personPage)
          .not.toContain(
            "getUserFollows",
          );

        expect(publicAccountPage)
          .not.toContain(
            "getUserFollows",
          );
      },
    );

    it(
      "uses the universal account profile shell for Person identity",
      () => {
        for (
          const token of [
            "profile-dt-shell",
            "profile-dt-cover",
            "profile-dt-header",
            "profile-dt-avatar",
            "profile-dt-name",
            "profile-dt-handle",
            "profile-dt-stats",
            "profile-dt-tabbar",
          ]
        ) {
          expect(publicAccountPage)
            .toContain(
              token,
            );

          expect(ownerProfilePage)
            .toContain(
              token,
            );

          expect(personPage)
            .toContain(
              token,
            );
        }

        expect(personPage)
          .not.toContain(
            'className="author-profile-shell"',
          );

        expect(personPage)
          .toContain(
            'to={`/u/${person.username}`}',
          );
      },
    );

    it(
      "uses contribution tabs while keeping the rich Article and Playlist presentation",
      () => {
        for (
          const token of [
            "author-profile-featured-hero",
            "author-profile-carousel-track",
            "author-profile-filter-bar",
            "author-profile-sort-wrap",
            "author-profile-sentinel",
          ]
        ) {
          expect(authorPage)
            .toContain(
              token,
            );

          expect(personPage)
            .toContain(
              token,
            );
        }

        expect(personPage)
          .toContain(
            "Featured Story",
          );

        expect(personPage)
          .toContain(
            "More from",
          );

        expect(personPage)
          .toContain(
            "Areas of Focus",
          );

        expect(personPage)
          .toContain(
            "three-up",
          );

        expect(personPage)
          .toContain(
            "full-bleed",
          );

        expect(personPage)
          .toContain(
            'label: "Articles"',
          );

        expect(personPage)
          .toContain(
            '"playlists"',
          );

        expect(personPage)
          .not.toContain(
            'label: "Work"',
          );

        expect(personPage)
          .toContain(
            "gap-6 sm:gap-8 lg:gap-10",
          );
      },
    );

    it(
      "preserves square Playlist artwork inside the contribution grammar",
      () => {
        expect(personPage)
          .toContain(
            "item.isPlaylist",
          );

        expect(personPage)
          .toContain(
            "aspect-square",
          );

        expect(personPage)
          .toContain(
            "object-contain",
          );

        expect(personPage)
          .toContain(
            "Playlists",
          );
      },
    );

    it(
      "uses a narrow public Person projection for comments and replies",
      () => {
        expect(communityService)
          .toContain(
            "'list_public_person_community_activity'",
          );

        expect(personPage)
          .toContain(
            "getPublicPersonCommunityActivity",
          );

        expect(publicAccountPage)
          .toContain(
            "getPublicPersonCommunityActivity",
          );

        expect(personPage)
          .toContain(
            '"comment"',
          );

        expect(personPage)
          .toContain(
            '"reply"',
          );

        expect(publicAccountPage)
          .not.toContain(
            "getUserComments",
          );

        expect(publicAccountPage)
          .not.toContain(
            "getUserReplies",
          );

        expect(personPage)
          .toContain(
            "getUserSaves",
          );

        expect(personPage)
          .toContain(
            'activeProfileTab !==\n          "saves"',
          );

        expect(personPage)
          .toContain(
            "communityProfile.userId !==",
          );

        expect(publicAccountPage)
          .not.toContain(
            "getUserSaves",
          );
      },
    );

    it(
      "keeps private owner capabilities out of the public Person data plane",
      () => {
        expect(personPage)
          .toContain(
            'to="/settings"',
          );

        expect(personPage)
          .toContain(
            'to="/profile"',
          );

        expect(publicAccountPage)
          .toContain(
            'to="/settings"',
          );

        expect(publicAccountPage)
          .toContain(
            'to="/profile"',
          );

        expect(personPage)
          .not.toContain(
            "community_get_user_saves",
          );

        expect(personPage)
          .not.toContain(
            "community_get_user_follows",
          );


        expect(personPage)
          .toContain(
            'id: "saves"',
          );

        expect(personPage)
          .toContain(
            'label: "Bookmarks"',
          );
      },
    );

    it(
      "keeps the Person hero social and leaves contribution counts to tabs",
      () => {
        expect(personPage)
          .toContain(
            "followingCount",
          );

        expect(personPage)
          .toContain(
            "followerCount",
          );

        expect(personPage)
          .not.toContain(
            '<div className="profile-dt-stat-lbl">\n                      Articles',
          );

        expect(personPage)
          .not.toContain(
            '<div className="profile-dt-stat-lbl">\n                      Comments',
          );

        expect(personPage)
          .toContain(
            'label: "Articles"',
          );

        expect(personPage)
          .toContain(
            'id: "playlists"',
          );
      },
    );

    it(
      "uses a compact mobile profile flow without leaving an avatar gutter",
      () => {
        expect(profileCss)
          .toContain(
            "People/Profile mobile compact profile override",
          );

        expect(profileCss)
          .toContain(
            ".profile-dt-header {\n    display: block;",
          );

        expect(profileCss)
          .toContain(
            ".profile-dt-header-actions {\n    position: absolute;",
          );

        expect(profileCss)
          .toContain(
            ".profile-dt-tabbar {\n    margin: 0 -16px 24px;",
          );

        expect(personPage)
          .toContain(
            "person-article-filter-bar",
          );

        expect(personPage)
          .toContain(
            "person-article-filter-pills",
          );

        expect(profileCss)
          .toContain(
            "People mobile article filter rail",
          );
      },
    );


    it(
      "uses one canonical signed-in Following presentation model for every M1 target type",
      () => {
        for (
          const targetType of [
            "person",
            "artist",
            "genre",
            "label",
            "chart_program",
          ]
        ) {
          expect(followingPresentation)
            .toContain(
              `"${targetType}"`,
            );
        }

        expect(communityService)
          .toContain(
            "mapCommunityFollowRows",
          );

        expect(communityService)
          .toContain(
            "hydrateFollowingPresentation",
          );

        expect(communityService)
          .toContain(
            "getUserFollowing",
          );

        expect(ownerProfilePage)
          .toContain(
            "getUserFollowing",
          );

        expect(mobileOwnerProfilePage)
          .toContain(
            "getUserFollowing",
          );

        expect(mobileOwnerProfilePage)
          .not.toContain(
            "enrichFollowEntities",
          );

        expect(followingPresentation)
          .toContain(
            "getPublicPerson",
          );

        expect(followingPresentation)
          .toContain(
            '.from("registry_artists")',
          );

        expect(followingPresentation)
          .toContain(
            '.from("registry_genres")',
          );

        expect(followingPresentation)
          .toContain(
            '.from("registry_labels")',
          );

        expect(followingPresentation)
          .toContain(
            '.from("wk_chart_programs_v2")',
          );

        for (
          const route of [
            "/people/",
            "/artists/",
            "/genres/",
            "/labels/",
            "getCanonicalChartPathFromSlugs",
          ]
        ) {
          expect(followingPresentation)
            .toContain(
              route,
            );
        }
      },
    );

    it(
      "gives signed-in Following a first-class feed destination separate from the relationship list",
      () => {
        expect(router)
          .toContain(
            'path: "/following"',
          );

        expect(router)
          .toContain(
            "FollowingPage",
          );

        expect(lazyPublic)
          .toContain(
            "../pages/following/page",
          );

        expect(followingFeedService)
          .toContain(
            '"community_get_social_feed"',
          );

        expect(followingFeedService)
          .toContain(
            '| "person"',
          );

        expect(followingFeedService)
          .toContain(
            '| "artist"',
          );

        expect(followingFeedService)
          .not.toContain(
            "p_user_id",
          );

        expect(followingFeedPage)
          .toContain(
            "getFollowingFeed",
          );

        expect(followingFeedPage)
          .toContain(
            "getUserFollowing",
          );

        expect(followingFeedPage)
          .toContain(
            "<GuestFollowingPicker />",
          );

        expect(appTopBar)
          .toContain(
            'to="/following"',
          );

        expect(mobileAppLayout)
          .toContain(
            '{ label: "Following", to: "/following", icon: "UserPlus" }',
          );
      },
    );

    it(
      "makes Following an actor-led visual activity stream without pretending anyone posted",
      () => {
        expect(followingFeedService)
          .toContain(
            'mode: "current_interest"',
          );

        expect(followingFeedService)
          .toContain(
            "recentWindowDays !== 180",
          );

        expect(followingFeedService)
          .toContain(
            "perSubjectRecentLimit !== 3",
          );

        expect(followingFeedPage)
          .toContain(
            "data-following-activity",
          );

        expect(followingFeedPage)
          .toContain(
            "ActivitySubjectAvatar",
          );

        expect(followingFeedPage)
          .toContain(
            "ActivityMedia",
          );

        expect(followingFeedPage)
          .toContain(
            "WAKILISHA Article",
          );

        expect(followingFeedPage)
          .toContain(
            "WAKILISHA Playlist",
          );

        expect(followingFeedPage)
          .toContain(
            'return "Release";',
          );

        expect(followingFeedPage)
          .toContain(
            "What’s moving through your circle.",
          );

        expect(followingFeedPage)
          .not.toContain(
            "newest first",
          );

        expect(followingFeedPage)
          .not.toContain(
            "posted",
          );

        expect(followingFeedPage)
          .not.toContain(
            "reposted",
          );

        expect(followingFeedPage)
          .not.toContain(
            "CommunityDigest",
          );

        expect(followingFeedPage)
          .not.toContain(
            "grid-cols-[104px_minmax",
          );

        expect(followingFeedPage)
          .toContain(
            "getUserSaves",
          );

        expect(followingFeedPage)
          .toContain(
            "setSavedState",
          );

        expect(followingFeedPage)
          .toContain(
            "SharePopover",
          );

        expect(followingFeedPage)
          .toContain(
            "ShareSheet",
          );

        expect(followingFeedPage)
          .not.toContain(
            "navigator.share",
          );

        expect(followingFeedPage)
          .not.toContain(
            "navigator.clipboard.writeText",
          );

        expect(followingFeedPage)
          .toContain(
            'data-following-reaction-slot="live"',
          );

        expect(followingFeedPage)
          .toContain(
            "CommunityReactionPicker",
          );

        expect(followingFeedService)
          .not.toContain(
            '"genre"',
          );

        expect(followingFeedService)
          .not.toContain(
            '"label"',
          );

        expect(followingFeedService)
          .not.toContain(
            '"chart_program"',
          );

        expect(ownerProfilePage)
          .not.toContain(
            "Follow people, artists, genres, labels, and charts",
          );

        expect(mobileOwnerProfilePage)
          .not.toContain(
            "People, artists, genres, labels, and charts",
          );

        expect(ownerProfilePage)
          .toContain(
            'to="/following"',
          );

        expect(mobileOwnerProfilePage)
          .toContain(
            'to="/following"',
          );
      },
    );

    it(
      "keeps the shared desktop share popover portaled and inside the viewport",
      () => {
        expect(shareInfrastructure)
          .toContain(
            "useLayoutEffect",
          );

        expect(shareInfrastructure)
          .toContain(
            "panelRef.current.getBoundingClientRect()",
          );

        expect(shareInfrastructure)
          .toContain(
            "const viewportPadding = 16;",
          );

        expect(shareInfrastructure)
          .toContain(
            "const fitsBelow =",
          );

        expect(shareInfrastructure)
          .toContain(
            "const fitsAbove =",
          );

        expect(shareInfrastructure)
          .toContain(
            "new ResizeObserver(",
          );

        expect(shareInfrastructure)
          .toContain(
            "return (\n    <Portal>\n      <>",
          );

        expect(shareInfrastructure)
          .toContain(
            'max-h-[calc(100vh-32px)]',
          );

        expect(shareInfrastructure)
          .not.toContain(
            "top + 520",
          );

        expect(shareInfrastructure)
          .not.toContain(
            "trigger.top - 520",
          );
      },
    );

    it(
      "uses the unified WAKILISHA share infrastructure on Following",
      () => {
        expect(followingFeedPage)
          .toContain(
            '@/components/design-system/share/ShareSheet',
          );

        expect(followingFeedPage)
          .toContain(
            "FollowingShareAction",
          );

        expect(followingFeedPage)
          .toContain(
            "SharePopover",
          );

        expect(followingFeedPage)
          .toContain(
            "ShareSheet",
          );

        expect(followingFeedPage)
          .toContain(
            "PUBLIC_ORIGIN",
          );

        expect(followingFeedPage)
          .not.toContain(
            "navigator.share",
          );

        expect(followingFeedPage)
          .not.toContain(
            "navigator.clipboard.writeText",
          );
      },
    );

    it(
      "hydrates and toggles Following reactions through the dedicated self-only state reader",
      () => {
        expect(communityService)
          .toContain(
            "'community_get_reaction_state_for_public_targets'",
          );

        expect(communityService)
          .toContain(
            "getReactionStateForPublicTargets",
          );

        expect(communityService)
          .toContain(
            "offset += 100",
          );

        expect(followingFeedPage)
          .toContain(
            "getReactionStateForPublicTargets",
          );

        expect(followingFeedPage)
          .toContain(
            "reactToTarget",
          );

        expect(followingFeedPage)
          .toContain(
            "CommunityReactionPicker",
          );

        expect(followingFeedPage)
          .toContain(
            "getReactionGlyph",
          );

        expect(followingFeedPage)
          .toContain(
            "viewerReacted",
          );

        expect(followingFeedPage)
          .toContain(
            "reactionCount",
          );

        expect(followingFeedPage)
          .toContain(
            'data-following-reaction-slot="live"',
          );

        expect(followingFeedPage)
          .not.toContain(
            "getUserReactions",
          );

        expect(followingFeedPage)
          .not.toContain(
            "community_get_user_reactions",
          );
      },
    );

    it(
      "uses current feed contributors as Activity Anchors instead of a decorative hero",
      () => {
        expect(followingFeedPage)
          .toContain(
            "data-following-activity-anchors",
          );

        expect(followingFeedPage)
          .toContain(
            "ActivityAnchorAvatar",
          );

        expect(followingFeedPage)
          .toContain(
            "activityAnchors",
          );

        expect(followingFeedPage)
          .toContain(
            "scrollToAnchor",
          );

        expect(followingFeedPage)
          .toContain(
            "IntersectionObserver",
          );

        expect(followingFeedPage)
          .toContain(
            "data-following-subjects",
          );

        expect(followingFeedPage)
          .toContain(
            "aria-current",
          );

        expect(followingFeedPage)
          .not.toContain(
            "Your WAKILISHA",
          );

        expect(followingFeedPage)
          .not.toContain(
            "What’s happening around the people and artists you follow.",
          );

        expect(followingFeedPage)
          .not.toContain(
            "story ring",
          );

        expect(followingFeedPage)
          .not.toContain(
            "unread",
          );
      },
    );

    it(
      "renders feed output from canonical backend paths without rebuilding content identity in the client",
      () => {
        expect(followingFeedPage)
          .toContain(
            "item.canonicalPath",
          );

        expect(followingFeedPage)
          .toContain(
            "PlaylistCoverPresentation",
          );

        expect(followingFeedPage)
          .toContain(
            'item.itemType === "playlist"',
          );

        expect(followingFeedPage)
          .toContain(
            "matchedFollows",
          );

        expect(followingFeedPage)
          .toContain(
            "presentation.canonicalPath",
          );

        expect(followingFeedPage)
          .not.toContain(
            "releaseUrl(",
          );

        expect(followingFeedPage)
          .not.toContain(
            "getCommunityDigest",
          );
      },
    );

    it(
      "keeps secondary public destinations globally reachable on mobile",
      () => {
        expect(mobileAppLayout)
          .toContain(
            "const MORE_LINKS",
          );

        for (
          const route of [
            "/genres",
            "/labels",
            "/guides",
            "/about",
            "/contact",
            "/faqs",
            "/privacy",
            "/terms",
          ]
        ) {
          expect(mobileAppLayout)
            .toContain(
              `to: "${route}"`,
            );
        }

        expect(mobileAppLayout)
          .toContain(
            'aria-label="More"',
          );

        expect(mobileAppLayout)
          .toContain(
            "useScrollLock(moreOpen)",
          );

        expect(mobileAppLayout)
          .toContain(
            "Appearance",
          );

        expect(mobileAppLayout)
          .toContain(
            "SIGNED_IN_NAV",
          );

        expect(mobileAppLayout)
          .toContain(
            "SIGNED_OUT_NAV",
          );

        expect(mobileAppLayout)
          .toContain(
            "prominent: true",
          );

        expect(mobileAppLayout)
          .toContain(
            'className="phn-nav phn-nav--compact"',
          );

        expect(mobileAppLayout)
          .toContain(
            "NotificationBell",
          );

        expect(mobileChromeCss)
          .toContain(
            "compact five-slot mobile nav",
          );

        expect(mobileChromeCss)
          .toContain(
            ".phn-nav-primary-core",
          );
      },
    );

    it(
      "keeps homepage story pools distinct and category blocks substantial",
      () => {
        expect(mobileMagazine)
          .toContain(
            "const latest = stories.slice(4, 10);",
          );

        expect(mobileMagazine)
          .toContain(
            "const sectionBlockStories = stories.slice(10);",
          );

        expect(mobileMagazine)
          .toContain(
            "filteredLatest",
          );

        expect(mobileMagazine)
          .toContain(
            "Filter Stories",
          );

        expect(mobileMagazine)
          .toContain(
            "MIN_HOMEPAGE_SECTION_STORIES = 3",
          );

        expect(desktopMagazine)
          .toContain(
            "MIN_HOMEPAGE_SECTION_STORIES = 3",
          );

        expect(mobileMagazine)
          .not.toContain(
            "African creative life, starting with music",
          );

        expect(desktopMagazine)
          .not.toContain(
            "African creative life, starting with music",
          );

        expect(magazineCard)
          .toContain(
            'className="line-clamp-3 text-[14px] font-bold',
          );

        expect(magazineCard)
          .toContain(
            'className="line-clamp-3 text-[15px] font-black',
          );
      },
    );

    it(
      "keeps public chart recency claims edition-scoped",
      () => {
        const chartCopy = [
          chartsDirectory,
          chartHighlights,
          chartEdition,
          mobileChartEdition,
          artistRolodex,
        ].join("\n");

        expect(chartCopy)
          .not.toMatch(
            /\b(?:this week|in one week)\b/i,
          );

        expect(chartsDirectory)
          .toContain(
            "Latest Edition",
          );

        expect(chartsDirectory)
          .toContain(
            "New in This Edition",
          );

        expect(chartHighlights)
          .toContain(
            "New in the Latest Editions",
          );

        expect(mobileChartEdition)
          .toContain(
            "Edition #1",
          );

        expect(chartEdition)
          .toContain(
            "Top 3 in This Edition",
          );

        expect(chartEdition)
          .toContain(
            "Biggest Movers in This Edition",
          );
      },
    );

    it(
      "uses real chart positions on Artists and never fabricates rank 99",
      () => {
        expect(publicContentRead)
          .toContain(
            '.select("artist_slug, rank")',
          );

        expect(publicContentRead)
          .toContain(
            "topChartPositionByArtistSlug",
          );

        expect(artistsPage)
          .toContain(
            "hasRealChartPosition",
          );

        expect(artistsPage)
          .not.toContain(
            "topChartPosition || 99",
          );

        expect(artistChartList)
          .toContain(
            "artist.trackCount > 0",
          );

        expect(artistChartList)
          .toContain(
            'artist.trackCount === 1 ? "track" : "tracks"',
          );

        expect(artistCoverStories)
          .toContain(
            "hero.trackCount > 0",
          );

        expect(artistChartList)
          .not.toContain(
            "String(idx + 1)",
          );

        expect(artistChartList)
          .not.toContain(
            "String(index + 4)",
          );

        expect(artistChartList)
          .toContain(
            "Peak #{artist.topChartPosition}",
          );
      },
    );

    it(
      "keeps chart discussion in expanded details and suppresses unknown genre fiction",
      () => {
        expect(chartRow)
          .toContain(
            "onDiscuss?: () => void",
          );

        expect(chartRow)
          .not.toContain(
            'title="Discuss entry"',
          );

        expect(chartEdition)
          .toContain(
            "onDiscuss={() =>",
          );

        expect(chartEdition)
          .not.toContain(
            'entry.genre || "Unknown"',
          );

        expect(chartEdition)
          .toContain(
            "genreBreakdown.length > 0",
          );

        expect(artistRolodex)
          .toContain(
            "artists in this edition",
          );
      },
    );

    it(
      "keeps engineering authority language out of public profile copy",
      () => {
        expect(personPage)
          .not.toContain(
            "Follow the Person, not the role",
          );

        expect(personPage)
          .not.toContain(
            "exact current published Credit authority",
          );

        expect(personPage)
          .not.toContain(
            "—",
          );
      },
    );
  },
);

describe("public discovery final refinement regressions", () => {
  const desktopChartEdition =
    readFileSync(
      "src/pages/charts/edition/page.tsx",
      "utf8",
    );

  const mobileChartEdition =
    readFileSync(
      "src/pages/mobile/charts/edition/page.tsx",
      "utf8",
    );

  const mobileAppLayoutFinal =
    readFileSync(
      "src/components/mobile/MobileAppLayout.tsx",
      "utf8",
    );

  const chartRowFinal =
    readFileSync(
      "src/components/design-system/music/ChartRow.tsx",
      "utf8",
    );

  const chartRowExpandedPanel =
    readFileSync(
      "src/components/design-system/music/ChartRowExpandedPanel.tsx",
      "utf8",
    );

  it(
    "keeps failed desktop chart loads out of the Apple playback TDZ",
    () => {
      const capabilityIndex =
        desktopChartEdition.indexOf(
          "const hasApplePlaybackTracks",
        );

      const errorIndex =
        desktopChartEdition.indexOf(
          'if (state.status === "error")',
        );

      expect(capabilityIndex)
        .toBeGreaterThanOrEqual(0);

      expect(errorIndex)
        .toBeGreaterThanOrEqual(0);

      expect(capabilityIndex)
        .toBeLessThan(
          errorIndex,
        );
    },
  );

  it(
    "does not manufacture Unknown genre coverage on mobile",
    () => {
      expect(mobileChartEdition)
        .not.toContain(
          'e.genre || "Unknown"',
        );

      expect(mobileChartEdition)
        .toContain(
          "genreBreakdownTotal",
        );
    },
  );

  it(
    "keeps chart discussion out of collapsed rows and prominent when expanded",
    () => {
      expect(chartRowFinal)
        .not.toContain(
          'title="Discuss entry"',
        );

      expect(chartRowFinal)
        .toContain(
          "onDiscuss={onDiscuss}",
        );

      expect(chartRowExpandedPanel)
        .toContain(
          "Add context, reactions, or perspective to this chart position.",
        );

      expect(chartRowExpandedPanel)
        .toContain(
          "Discuss Entry",
        );

      expect(mobileChartEdition)
        .toContain(
          "ContextAnchorCommentDrawer",
        );
    },
  );

  it(
    "keeps Home central while reusing the existing WAKILISHA thunderbolt",
    () => {
      const followingIndex =
        mobileAppLayoutFinal.indexOf(
          '{ label: "Following", to: "/following", icon: "UserPlus" }',
        );

      const chartsIndex =
        mobileAppLayoutFinal.indexOf(
          '{ label: "Charts", to: "/charts", icon: "BarChart3" }',
        );

      const homeIndex =
        mobileAppLayoutFinal.indexOf(
          '{ label: "Home", to: "/", icon: "Home", prominent: true }',
        );

      const artistsIndex =
        mobileAppLayoutFinal.indexOf(
          '{ label: "Artists", to: "/artists", icon: "Mic2" }',
        );

      expect(followingIndex)
        .toBeGreaterThanOrEqual(0);

      expect(followingIndex)
        .toBeLessThan(
          chartsIndex,
        );

      expect(chartsIndex)
        .toBeLessThan(
          homeIndex,
        );

      expect(homeIndex)
        .toBeLessThan(
          artistsIndex,
        );

      expect(mobileAppLayoutFinal)
        .toContain(
          "wakilisha-thunderbolt.png",
        );
    },
  );
});

describe("public charts empty-program discovery regression", () => {
  const publicChartsV2Adapter =
    readFileSync(
      "src/services/chartsPublic/v2Adapter.ts",
      "utf8",
    );

  it(
    "does not probe latest editions for chart program shells with no public edition",
    () => {
      expect(publicChartsV2Adapter)
        .toContain(
          "function hasPublicEdition(program: V2Program): boolean",
        );

      expect(publicChartsV2Adapter)
        .toContain(
          "Boolean(program.latestEdition)",
        );

      expect(publicChartsV2Adapter)
        .toContain(
          "(program.archive?.length ?? 0) > 0",
        );

      expect(publicChartsV2Adapter)
        .toContain(
          "(data.programs ?? []).filter(hasPublicEdition)",
        );
    },
  );
});

describe("chart edition row information density regression", () => {
  const chartRowInformationDensity =
    readFileSync(
      "src/components/design-system/music/ChartRow.tsx",
      "utf8",
    );

  it(
    "uses mobile width for chart identity while artwork owns playback",
    () => {
      expect(chartRowInformationDensity)
        .toContain(
          "line-clamp-2 text-[14px]",
        );

      expect(chartRowInformationDensity)
        .toContain(
          "line-clamp-2 text-[12px]",
        );

      expect(chartRowInformationDensity)
        .toContain(
          'import { PlayableArtwork } from "@/components/design-system/music/PlayableArtwork";',
        );

      expect(chartRowInformationDensity)
        .toContain(
          "<PlayableArtwork",
        );

      expect(chartRowInformationDensity)
        .not.toContain(
          "bg-black/70 text-white shadow-sm",
        );

      expect(chartRowInformationDensity)
        .not.toContain(
          "active:scale-95 md:hidden",
        );

      expect(chartRowInformationDensity)
        .not.toContain(
          "hidden h-9 w-9",
        );
    },
  );
});

describe("chart edition collapsed-versus-expanded hierarchy regression", () => {
  const collapsedChartRow =
    readFileSync(
      "src/components/design-system/music/ChartRow.tsx",
      "utf8",
    );

  const expandedChartRow =
    readFileSync(
      "src/components/design-system/music/ChartRowExpandedPanel.tsx",
      "utf8",
    );

  it(
    "keeps collapsed rows focused on music identity and playback",
    () => {
      expect(collapsedChartRow)
        .not.toContain(
          'title="Discuss entry"',
        );

      expect(collapsedChartRow)
        .not.toContain(
          "ri-chat-1-line",
        );

      expect(collapsedChartRow)
        .not.toContain(
          ">PEAK<",
        );

      expect(collapsedChartRow)
        .not.toContain(
          "Peak #{peakPosition}",
        );

      expect(collapsedChartRow)
        .not.toContain(
          "WkTag",
        );

      expect(collapsedChartRow)
        .toContain(
          "onDiscuss={onDiscuss}",
        );
    },
  );

  it(
    "moves chart performance and Community into expanded details",
    () => {
      expect(expandedChartRow)
        .toContain(
          "Chart Performance",
        );

      expect(expandedChartRow)
        .toContain(
          "Current Position",
        );

      expect(expandedChartRow)
        .toContain(
          "Best Position",
        );

      expect(expandedChartRow)
        .toContain(
          "Highest position reached on this chart.",
        );

      expect(expandedChartRow)
        .toContain(
          "Weeks On Chart",
        );

      expect(expandedChartRow)
        .toContain(
          "Previous Position",
        );

      expect(expandedChartRow)
        .toContain(
          "Community",
        );

      expect(expandedChartRow)
        .toContain(
          "Discuss Entry",
        );
    },
  );
});
