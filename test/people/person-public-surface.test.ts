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
            'label: "Saves"',
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
            '"community_get_following_feed"',
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
            'buildCommunityAuthUrl("/following")',
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
            "navigator.share",
          );

        expect(followingFeedPage)
          .toContain(
            'data-following-reaction-slot="reserved"',
          );

        expect(followingFeedPage)
          .not.toContain(
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
