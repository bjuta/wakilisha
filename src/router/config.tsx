import type { RouteObject } from "react-router-dom";
import { Navigate, useParams } from "react-router-dom";
import {
  AdminAnalyticsPage,
  AdminApiDocsPage,
  AdminArticleDetailPage,
  AdminArticlesPage,
  AdminAudioPage,
  AdminAudioDetailPage,
  AdminPlaylistsPage,
  AdminNewPlaylistPage,
  AdminPlaylistDetailPage,
  AdminArtistAliasesPage,
  AdminArtistDecouplePage,
  AdminArtistDetailPage,
  AdminArtistIntakePage,
  AdminArtistsPage,
  AdminAuthorDetailPage,
  AdminAuthorsPage,
  AdminBrokenLinksPage,
  AdminCategoriesPage,
  AdminChartsArtistResolution,
  AdminChartsBackfillPlanner,
  AdminChartsCanonGaps,
  AdminChartsDashboard,
  AdminChartsEditionDetail,
  AdminChartsEditions,
  AdminChartsFamilies,
  AdminChartsIngest,
  AdminChartsIngestDetail,
  AdminChartsIngestHealth,
  AdminChartsIngestRunDetail,
  AdminChartsIngestRuns,
  AdminChartsIntegrationMap,
  AdminChartsLayout,
  AdminChartsNoMatch,
  AdminChartsPublicApiQa,
  AdminChartsReviewQueue,
  AdminChartsScoringRuns,
  AdminChartsSnapshots,
  AdminCommunityPage,
  AdminArtistClaimsPage,
  AdminContentArchivePage,
  AdminContentLayout,
  AdminDashboardPage,
  AdminDuplicateMergePage,
  AdminFeaturedArtistsPage,
  AdminFeaturedGuidesPage,
  AdminGenreDetailPage,
  AdminGenresPage,
  AdminGuideDetailPage,
  AdminGuidesPage,
  AdminInquiryInterfacePage,
  AdminLabelDetailPage,
  AdminLabelsPage,
  AdminLoginPage,
  AdminLyricsPage,
  AdminMediaLayout,
  AdminMediaLibraryPage,
  AdminMissingImagesPage,
  AdminNewArticlePage,
  AdminPagesPage,
  AdminPublishingDashboardPage,
  AdminRegistryLayout,
  AdminRegistryOverview,
  AdminRelationshipViewerPage,
  AdminRelationshipsLayout,
  AdminReleaseDetailPage,
  AdminReleasesPage,
  AdminReviewLayout,
  AdminReviewQueuePage,
  AdminSettingsAirplay,
  AdminSettingsAudience,
  AdminSettingsAudit,
  AdminSettingsChartDefaults,
  AdminSettingsChartDefaultsMarketScopes,
  AdminSettingsDesignSystem,
  AdminSettingsEmailBriefings,
  AdminSettingsFrontendAppearance,
  AdminSettingsGscData,
  AdminSettingsHub,
  AdminSettingsIntegrations,
  AdminSettingsLayout,
  AdminSettingsMaintenance,
  AdminSettingsOnboarding,
  AdminSettingsNavigation,
  AdminSettingsPlayerPlayback,
  AdminSettingsRegistry,
  AdminSettingsSeo,
  AdminSettingsSiteIdentity,
  AdminShell,
  AdminTagsPage,
  AdminTrackDetailPage,
  AdminTrackIntakePage,
  AdminTracksPage,
  AdminTrashPage,
  AdminUsersLayout,
  AdminUsersPage,
} from "./lazyAdmin";
import {
  NotFound,
  ResetPasswordPage,
  LegacyAuthorPersonRedirect,
  PersonDetailPage,
  OrganizationDetailPage,
  LegacyArticleRedirect,
  PublicApiDocsPage,
  PublicProfilePage,
  PublicBriefingsPage,
  BriefingConfirmPage,
  BriefingUnsubscribePage,
  BriefingPreferencesPage,
  BriefingIssuePage,
  ChartsDirectory,
  ChartEdition,
  PublicPlaylistsPage,
  PublicPlaylistDetailPage,
  PublicAudioPage,
  PublicAudioDetailPage,
  PublicShowPage,
  PublicShowEpisodePage,
  PersonPlaylistsPage,
  PersonPlaylistDetailPage,
  Artists,
  ArtistDetail,
  ArtistManagePage,
  ArtistUpdatePage,
  Releases,
  ReleaseDetail,
  MobileReleaseDetail,
  Genres,
  GenreDetail,
  Labels,
  LabelDetail,
  ArticlePage,
  PreviewPage,
  TrackDetail,
  LyricContribution,
  ProfilePage,
  FollowingPage,
  NotificationsPage,
  MusicPage,
  PostDetailPage,
  RegistryOnboardingPage,
  MobileProfilePage,
  SettingsPage,
  MobileSettingsPage,
  Search,
  GuidesPage,
  GuideDetailPage,
  VeniceFieldGuidePage,
  MobileChartEdition,
  MobileGenres,
  MobileLabels,
  MobileArticlePage,
  AuthPage,
  CategoriesIndex,
  CategoryDetail,
  TagsIndex,
  TagDetail,
  AboutPage,
  ContactPage,
  FaqsPage,
  PrivacyPage,
  TermsPage,
  MobileFullPlayer,
} from "./lazyPublic";
import { ResponsiveAppLayout } from "@/components/mobile/ResponsiveAppLayout";
import { ResponsivePage } from "@/components/mobile/ResponsivePage";
import { useAuthUser } from "@/hooks/useAuthUser";

// Author profiles

// Admin Studio production engine

// Section-level admin guards

// Admin Charts Ingestion Studio

// Admin Share Analytics (redirected to main analytics)

// Admin Settings

// Admin API Docs

// Admin Community Moderation

// Admin Institute

// Public API Docs


// Briefing public pages

// Charts

// Artists

// Other entity pages
import Magazine from "../pages/magazine/page";

// Search

// Guides


// Mobile pages
import MobileMagazine from "../pages/mobile/magazine/page";

// Public taxonomy archive pages

// Housekeeping pages

function LegacyTaxonomyRedirect({ base }: { base: "/categories" | "/tags" }) {
  const { slug } = useParams<{ slug?: string }>();
  return <Navigate to={slug ? `${base}/${slug}` : base} replace />;
}

function LegacyEntityRedirect({ base }: { base: "/artists" | "/releases" | "/tracks" }) {
  const params = useParams<Record<string, string | undefined>>();

  if (base === "/artists") {
    return <Navigate to={params.slug ? `/artists/${params.slug}` : "/artists"} replace />;
  }

  if (base === "/releases") {
    if (params.artistSlug && params.releaseSlug) {
      return <Navigate to={`/releases/${params.artistSlug}/${params.releaseSlug}`} replace />;
    }
    return <Navigate to="/releases" replace />;
  }

  if (params.artistSlug && params.trackSlug) {
    return <Navigate to={`/tracks/${params.artistSlug}/${params.trackSlug}`} replace />;
  }

  return <Navigate to="/tracks" replace />;
}

function AuthenticatedProfileRoute() {
  const authUser = useAuthUser();

  if (authUser.loading) {
    return (
      <div
        className="min-h-[40vh]"
        aria-busy="true"
        aria-label="Loading Profile"
      />
    );
  }

  if (!authUser.id) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <ResponsivePage
      mobile={<MobileProfilePage />}
      desktop={<ProfilePage />}
    />
  );
}

const routes: RouteObject[] = [
    { path: "/admin/login", element: <AdminLoginPage /> },
  { path: "/auth/reset-password", element: <ResetPasswordPage /> },
  { path: "/start", element: <RegistryOnboardingPage /> },
  {
    element: <ResponsiveAppLayout />,
    children: [
      { path: "/", element: <ResponsivePage mobile={<MobileMagazine />} desktop={<Magazine />} /> },
      { path: "/magazine", element: <ResponsivePage mobile={<MobileMagazine />} desktop={<Magazine />} /> },
      { path: "/magazine/:slug", element: <ResponsivePage mobile={<MobileArticlePage />} desktop={<ArticlePage />} /> },
      { path: "/charts", element: <ResponsivePage mobile={<ChartsDirectory />} desktop={<ChartsDirectory />} /> },
      { path: "/playlists", element: <ResponsivePage mobile={<PublicPlaylistsPage />} desktop={<PublicPlaylistsPage />} /> },
      { path: "/playlists/:slug", element: <ResponsivePage mobile={<PublicPlaylistDetailPage />} desktop={<PublicPlaylistDetailPage />} /> },
      { path: "/shows/:showSlug/:episodeSlug", element: <ResponsivePage mobile={<PublicShowEpisodePage />} desktop={<PublicShowEpisodePage />} /> },
      { path: "/shows/:showSlug", element: <ResponsivePage mobile={<PublicShowPage />} desktop={<PublicShowPage />} /> },
      { path: "/audio", element: <ResponsivePage mobile={<PublicAudioPage />} desktop={<PublicAudioPage />} /> },
      { path: "/audio/:slug", element: <ResponsivePage mobile={<PublicAudioDetailPage />} desktop={<PublicAudioDetailPage />} /> },
      { path: "/charts/:series/:market/:edition", element: <ResponsivePage mobile={<MobileChartEdition />} desktop={<ChartEdition />} /> },
      { path: "/charts/:series/:edition", element: <ResponsivePage mobile={<MobileChartEdition />} desktop={<ChartEdition />} /> },
      { path: "/charts/:series", element: <ResponsivePage mobile={<MobileChartEdition />} desktop={<ChartEdition />} /> },
      { path: "/artist", element: <LegacyEntityRedirect base="/artists" /> },
      { path: "/artist/:slug", element: <LegacyEntityRedirect base="/artists" /> },
      { path: "/release", element: <LegacyEntityRedirect base="/releases" /> },
      { path: "/release/:artistSlug/:releaseSlug", element: <LegacyEntityRedirect base="/releases" /> },
      { path: "/track", element: <LegacyEntityRedirect base="/tracks" /> },
      { path: "/track/:artistSlug/:trackSlug", element: <LegacyEntityRedirect base="/tracks" /> },
      { path: "/artists", element: <ResponsivePage mobile={<Artists />} desktop={<Artists />} /> },
      { path: "/artists/:slug", element: <ResponsivePage mobile={<ArtistDetail />} desktop={<ArtistDetail />} /> },
      { path: "/artists/:slug/manage", element: <ResponsivePage mobile={<ArtistManagePage />} desktop={<ArtistManagePage />} /> },
      { path: "/artists/:slug/updates/:updateId", element: <ResponsivePage mobile={<ArtistUpdatePage />} desktop={<ArtistUpdatePage />} /> },
      { path: "/tracks/:artistSlug/:trackSlug", element: <ResponsivePage mobile={<TrackDetail />} desktop={<TrackDetail />} /> },
      { path: "/tracks/:artistSlug/:trackSlug/lyrics/contribute", element: <LyricContribution /> },
      { path: "/releases", element: <ResponsivePage mobile={<Releases />} desktop={<Releases />} /> },
      { path: "/releases/:artistSlug/:releaseSlug/:trackSlug/lyrics/contribute", element: <LyricContribution /> },
      { path: "/releases/:artistSlug/:releaseSlug/:trackSlug", element: <ResponsivePage mobile={<TrackDetail />} desktop={<TrackDetail />} /> },
      { path: "/releases/:artistSlug/:releaseSlug", element: <ResponsivePage mobile={<MobileReleaseDetail />} desktop={<ReleaseDetail />} /> },
      { path: "/genres/:slug", element: <ResponsivePage mobile={<GenreDetail />} desktop={<GenreDetail />} /> },
      { path: "/genres", element: <ResponsivePage mobile={<MobileGenres />} desktop={<Genres />} /> },
      { path: "/labels/:slug", element: <ResponsivePage mobile={<LabelDetail />} desktop={<LabelDetail />} /> },
      { path: "/labels", element: <ResponsivePage mobile={<MobileLabels />} desktop={<Labels />} /> },
      { path: "/preview/:nonce", element: <PreviewPage /> },
      { path: "/category", element: <LegacyTaxonomyRedirect base="/categories" /> },
      { path: "/category/:slug", element: <LegacyTaxonomyRedirect base="/categories" /> },
      { path: "/tag", element: <LegacyTaxonomyRedirect base="/tags" /> },
      { path: "/tag/:slug", element: <LegacyTaxonomyRedirect base="/tags" /> },
      { path: "/categories", element: <ResponsivePage mobile={<CategoriesIndex />} desktop={<CategoriesIndex />} /> },
      { path: "/categories/:slug", element: <ResponsivePage mobile={<CategoryDetail />} desktop={<CategoryDetail />} /> },
      { path: "/tags", element: <ResponsivePage mobile={<TagsIndex />} desktop={<TagsIndex />} /> },
      { path: "/tags/:slug", element: <ResponsivePage mobile={<TagDetail />} desktop={<TagDetail />} /> },
      { path: "/guides/:slug", element: <ResponsivePage mobile={<GuideDetailPage />} desktop={<GuideDetailPage />} /> },
      { path: "/guides/:slug/field-guide", element: <ResponsivePage mobile={<VeniceFieldGuidePage />} desktop={<VeniceFieldGuidePage />} /> },
      { path: "/guides", element: <ResponsivePage mobile={<GuidesPage />} desktop={<GuidesPage />} /> },
      { path: "/search", element: <ResponsivePage mobile={<Search />} desktop={<Search />} /> },
      { path: "/player", element: <Navigate to="/" replace /> },
      { path: "/auth", element: <ResponsivePage mobile={<AuthPage />} desktop={<AuthPage />} /> },
      { path: "/profile", element: <AuthenticatedProfileRoute /> },
      { path: "/music", element: <ResponsivePage mobile={<MusicPage />} desktop={<MusicPage />} /> },
      { path: "/following", element: <ResponsivePage mobile={<FollowingPage />} desktop={<FollowingPage />} /> },
      { path: "/notifications", element: <ResponsivePage mobile={<NotificationsPage />} desktop={<NotificationsPage />} /> },
      { path: "/u/:username/playlists/:playlistSlug", element: <ResponsivePage mobile={<PersonPlaylistDetailPage />} desktop={<PersonPlaylistDetailPage />} /> },
      { path: "/u/:username/playlists", element: <ResponsivePage mobile={<PersonPlaylistsPage />} desktop={<PersonPlaylistsPage />} /> },
      { path: "/u/:username", element: <ResponsivePage mobile={<PublicProfilePage />} desktop={<PublicProfilePage />} /> },
      { path: "/authors/:slug", element: <LegacyAuthorPersonRedirect /> },
      { path: "/people/:slug/posts/:postId", element: <ResponsivePage mobile={<PostDetailPage />} desktop={<PostDetailPage />} /> },
      { path: "/people/:slug", element: <ResponsivePage mobile={<PersonDetailPage />} desktop={<PersonDetailPage />} /> },
      { path: "/organizations/:slug", element: <ResponsivePage mobile={<OrganizationDetailPage />} desktop={<OrganizationDetailPage />} /> },
      { path: "/settings", element: <ResponsivePage mobile={<MobileSettingsPage />} desktop={<SettingsPage />} /> },
      { path: "/about", element: <ResponsivePage mobile={<AboutPage />} desktop={<AboutPage />} /> },
      { path: "/contact", element: <ResponsivePage mobile={<ContactPage />} desktop={<ContactPage />} /> },
      { path: "/faqs", element: <ResponsivePage mobile={<FaqsPage />} desktop={<FaqsPage />} /> },
      { path: "/privacy", element: <ResponsivePage mobile={<PrivacyPage />} desktop={<PrivacyPage />} /> },
      { path: "/terms", element: <ResponsivePage mobile={<TermsPage />} desktop={<TermsPage />} /> },
      { path: "/briefings", element: <ResponsivePage mobile={<PublicBriefingsPage />} desktop={<PublicBriefingsPage />} /> },
      { path: "/briefing/confirm", element: <ResponsivePage mobile={<BriefingConfirmPage />} desktop={<BriefingConfirmPage />} /> },
      { path: "/briefing/unsubscribe", element: <ResponsivePage mobile={<BriefingUnsubscribePage />} desktop={<BriefingUnsubscribePage />} /> },
      { path: "/briefing/preferences", element: <ResponsivePage mobile={<BriefingPreferencesPage />} desktop={<BriefingPreferencesPage />} /> },
      { path: "/briefing/issue/:issueId", element: <BriefingIssuePage /> },
      { path: "/:slug", element: <LegacyArticleRedirect /> },
    ],
  },
  {
    path: "/admin",
    element: <AdminShell />,
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: "analytics", element: <AdminAnalyticsPage /> },
      { path: "community", element: <AdminCommunityPage /> },
      { path: "community/artist-claims", element: <AdminArtistClaimsPage /> },
      { path: "institute/inquiry-interface", element: <AdminInquiryInterfacePage /> },
      {
        path: "content",
        element: <AdminContentLayout />,
        children: [
          { path: "articles", element: <AdminArticlesPage /> },
          { path: "articles/new", element: <AdminNewArticlePage /> },
          { path: "articles/:slug", element: <AdminArticleDetailPage /> },
          { path: "audio", element: <AdminAudioPage /> },
          { path: "audio/:publicationId", element: <AdminAudioDetailPage /> },
          { path: "playlists", element: <AdminPlaylistsPage /> },
          { path: "playlists/new", element: <AdminNewPlaylistPage /> },
          { path: "playlists/:playlistId", element: <AdminPlaylistDetailPage /> },
          { path: "articles/trash", element: <AdminTrashPage /> },
          { path: "guides", element: <AdminGuidesPage /> },
          { path: "guides/:slug/edit", element: <AdminGuideDetailPage /> },
          { path: "pages", element: <AdminPagesPage /> },
          { path: "publishing", element: <AdminPublishingDashboardPage /> },
          { path: "archive", element: <AdminContentArchivePage /> },
          { path: "lyrics", element: <AdminLyricsPage /> },
          { path: "categories", element: <AdminCategoriesPage /> },
          { path: "tags", element: <AdminTagsPage /> },
          { path: "magazine/featured-artists", element: <AdminFeaturedArtistsPage /> },
          { path: "magazine/featured-guides", element: <AdminFeaturedGuidesPage /> },
        ],
      },
      {
        path: "users",
        element: <AdminUsersLayout />,
        children: [
          { index: true, element: <AdminUsersPage /> },
        ],
      },
      {
        path: "registry",
        element: <AdminRegistryLayout />,
        children: [
          { index: true, element: <AdminRegistryOverview /> },
          { path: "artists", element: <AdminArtistsPage /> },
          { path: "artists/intake", element: <AdminArtistIntakePage /> },
          { path: "artists/:slug", element: <AdminArtistDetailPage /> },
          { path: "tracks", element: <AdminTracksPage /> },
          { path: "tracks/intake", element: <AdminTrackIntakePage /> },
          { path: "tracks/:slug", element: <AdminTrackDetailPage /> },
          { path: "releases", element: <AdminReleasesPage /> },
          { path: "artist-aliases", element: <AdminArtistAliasesPage /> },
          { path: "artist-aliases/decouple", element: <AdminArtistDecouplePage /> },
          { path: "releases/:slug", element: <AdminReleaseDetailPage /> },
          { path: "labels", element: <AdminLabelsPage /> },
          { path: "labels/:slug", element: <AdminLabelDetailPage /> },
          { path: "genres", element: <AdminGenresPage /> },
          { path: "genres/:slug", element: <AdminGenreDetailPage /> },
          { path: "authors", element: <AdminAuthorsPage /> },
          { path: "authors/:slug", element: <AdminAuthorDetailPage /> },
        ],
      },
      {
        path: "relationships",
        element: <AdminRelationshipsLayout />,
        children: [
          { path: "viewer", element: <AdminRelationshipViewerPage /> },
          { path: "duplicates", element: <AdminDuplicateMergePage /> },
        ],
      },
      {
        path: "media",
        element: <AdminMediaLayout />,
        children: [
          { path: "library", element: <AdminMediaLibraryPage /> },
          { path: "missing", element: <AdminMissingImagesPage /> },
          { path: "broken", element: <AdminBrokenLinksPage /> },
        ],
      },
      {
        path: "review",
        element: <AdminReviewLayout />,
        children: [
          { path: "queue", element: <AdminReviewQueuePage /> },
        ],
      },
      { path: "charts", element: <AdminChartsLayout />, children: [
        { index: true, element: <AdminChartsDashboard /> },
        { path: "dashboard", element: <AdminChartsDashboard /> },
        { path: "families", element: <AdminChartsFamilies /> },
        { path: "ingest", element: <AdminChartsIngest /> },
        { path: "backfill", element: <AdminChartsBackfillPlanner /> },
        { path: "ingest/:jobId", element: <AdminChartsIngestDetail /> },
        { path: "editions", element: <AdminChartsEditions /> },
        { path: "artist-resolution", element: <AdminChartsArtistResolution /> },
        { path: "snapshots", element: <AdminChartsSnapshots /> },
        { path: "integration-map", element: <AdminChartsIntegrationMap /> },
        { path: "public-api-qa", element: <AdminChartsPublicApiQa /> },
        { path: "review-queue", element: <AdminChartsReviewQueue /> },
        { path: "no-match", element: <AdminChartsNoMatch /> },
        { path: "canon-gaps", element: <AdminChartsCanonGaps /> },
        { path: "ingest-runs", element: <AdminChartsIngestRuns /> },
        { path: "ingest-runs/:runId", element: <AdminChartsIngestRunDetail /> },
        { path: "ingest-health", element: <AdminChartsIngestHealth /> },
        { path: "scoring-runs", element: <AdminChartsScoringRuns /> },
        { path: "editions/:editionId", element: <AdminChartsEditionDetail /> },
        { path: "share-analytics", element: <AdminAnalyticsPage /> },
        { path: "analytics", element: <AdminAnalyticsPage /> },
      ] },
      { path: "api-docs", element: <AdminApiDocsPage /> },
      { path: "settings", element: <AdminSettingsLayout />, children: [
        { index: true, element: <AdminSettingsHub /> },
        { path: "chart-defaults", element: <AdminSettingsChartDefaults /> },
        { path: "chart-defaults/market-scopes", element: <AdminSettingsChartDefaultsMarketScopes /> },
        { path: "design-system", element: <AdminSettingsDesignSystem /> },
        { path: "integrations", element: <AdminSettingsIntegrations /> },
        { path: "gsc-data", element: <AdminSettingsGscData /> },
        { path: "frontend-appearance", element: <AdminSettingsFrontendAppearance /> },
        { path: "player-playback", element: <AdminSettingsPlayerPlayback /> },
        { path: "registry", element: <AdminSettingsRegistry /> },
        { path: "airplay", element: <AdminSettingsAirplay /> },
        { path: "audience", element: <AdminSettingsAudience /> },
        { path: "email-briefings", element: <AdminSettingsEmailBriefings /> },
        { path: "maintenance", element: <AdminSettingsMaintenance /> },
        { path: "onboarding", element: <AdminSettingsOnboarding /> },
        { path: "seo", element: <AdminSettingsSeo /> },
        { path: "navigation", element: <AdminSettingsNavigation /> },
        { path: "audit", element: <AdminSettingsAudit /> },
        { path: "site-identity", element: <AdminSettingsSiteIdentity /> },
      ] },
    ],
  },
  { path: "/api-docs", element: <PublicApiDocsPage /> },
  { path: "/player/full", element: <MobileFullPlayer /> },
  { path: "*", element: <NotFound /> },
];

export default routes;
