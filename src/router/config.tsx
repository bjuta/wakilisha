import type { RouteObject } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { ResponsiveAppLayout } from "@/components/mobile/ResponsiveAppLayout";
import { ResponsivePage } from "@/components/mobile/ResponsivePage";
import { MobileFullPlayer } from "@/components/mobile/MobileFullPlayer";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
import AdminDesignSystem from "../pages/admin/design-system/page";
import AdminLoginPage from "../pages/admin/login/page";
import ResetPasswordPage from "../pages/auth/reset-password/page";

// Author profiles
import AuthorProfilePage from "../pages/authors/detail/page";

// Admin Shell — WordPress-like production engine
import { AdminShell } from "../pages/admin/AdminShell";
import AdminDashboardPage from "../pages/admin/dashboard/page";
import AdminArticlesPage from "../pages/admin/content/articles/page";
import AdminGuidesPage from "../pages/admin/content/guides/page";
import AdminPagesPage from "../pages/admin/content/pages/page";
import AdminArtistsPage from "../pages/admin/registry/artists/page";
import AdminTracksPage from "../pages/admin/registry/tracks/page";
import AdminReleasesPage from "../pages/admin/registry/releases/page";
import AdminLabelsPage from "../pages/admin/registry/labels/page";
import AdminGenresPage from "../pages/admin/registry/genres/page";
import AdminMediaLibraryPage from "../pages/admin/media/library/page";
import AdminMissingImagesPage from "../pages/admin/media/missing/page";
import AdminBrokenLinksPage from "../pages/admin/media/broken/page";
import AdminReviewQueuePage from "../pages/admin/review/queue/page";
import AdminImportsPage from "../pages/admin/imports/page";
import AdminImportsJobsPage from "../pages/admin/imports/jobs/page";
import AdminImportsJobDetailPage from "../pages/admin/imports/jobs/detail/page";
import AdminImportReviewArtifactsPage from "../pages/admin/imports/review-artifacts/page";
import AdminArticleDetailPage from "../pages/admin/content/articles/detail/page";
import AdminArtistDetailPage from "../pages/admin/registry/artists/detail/page";
import AdminTrackDetailPage from "../pages/admin/registry/tracks/detail/page";
import AdminReleaseDetailPage from "../pages/admin/registry/releases/detail/page";
import AdminLabelDetailPage from "../pages/admin/registry/labels/detail/page";
import AdminGenreDetailPage from "../pages/admin/registry/genres/detail/page";
import AdminRelationshipViewerPage from "../pages/admin/relationships/viewer/page";
import AdminDuplicateMergePage from "../pages/admin/relationships/duplicates/page";
import AdminPublishingDashboardPage from "../pages/admin/content/publishing/page";
import AdminContentArchivePage from "../pages/admin/content/archive/page";
import AdminMediaMigrationPage from "../pages/admin/content/migration/page";
import AdminLyricsPage from "../pages/admin/content/lyrics/page";
import AdminUsersPage from "../pages/admin/users/page";
import AdminMagazineVisualsPage from "../pages/admin/magazine/visuals/page";

// Admin Charts Ingestion Studio
import { AdminChartsLayout } from "../pages/admin/charts/AdminChartsLayout";
import AdminChartsDashboard from "../pages/admin/charts/dashboard/page";
import AdminChartsFamilies from "../pages/admin/charts/families/page";
import AdminChartsIngest from "../pages/admin/charts/ingest/page";
import AdminChartsIngestDetail from "../pages/admin/charts/ingest/detail/page";
import AdminChartsEditions from "../pages/admin/charts/editions/page";
import AdminChartsSnapshots from "../pages/admin/charts/snapshots/page";
import AdminChartsIntegrationMap from "../pages/admin/charts/integration-map/page";
import AdminChartsPublicApiQa from "../pages/admin/charts/public-api-qa/page";
import AdminChartsReviewQueue from "../pages/admin/charts/review-queue/page";
import AdminChartsNoMatch from "../pages/admin/charts/no-match/page";
import AdminChartsReleaseShells from "../pages/admin/charts/release-shells/page";
import AdminChartsCanonGaps from "../pages/admin/charts/canon-gaps/page";
import AdminChartsIngestRuns from "../pages/admin/charts/ingest-runs/page";
import AdminChartsIngestRunDetail from "../pages/admin/charts/ingest-run-detail/page";
import AdminChartsLegacyIngestJobs from "../pages/admin/charts/ingest-jobs/page";
import AdminChartsIngestHealth from "../pages/admin/charts/ingest-health/page";

// Admin Settings
import { AdminSettingsLayout } from "../pages/admin/settings/AdminSettingsLayout";
import AdminSettingsHub from "../pages/admin/settings/page";
import AdminSettingsChartDefaults from "../pages/admin/settings/chart-defaults/page";
import AdminSettingsChartDefaultsMarketScopes from "../pages/admin/settings/chart-defaults/market-scopes/page";
import AdminSettingsIntegrations from "../pages/admin/settings/integrations/page";
import AdminSettingsGscData from "../pages/admin/settings/gsc-data/page";
import AdminSettingsFrontendAppearance from "../pages/admin/settings/frontend-appearance/page";
import AdminSettingsPlayerPlayback from "../pages/admin/settings/player-playback/page";
import AdminSettingsRegistry from "../pages/admin/settings/registry/page";
import AdminSettingsAirplay from "../pages/admin/settings/airplay/page";
import AdminSettingsAudience from "../pages/admin/settings/audience/page";
import AdminSettingsEmailBriefings from "../pages/admin/settings/email-briefings/page";
import AdminSettingsMaintenance from "../pages/admin/settings/maintenance/page";
import AdminSettingsNavigation from "../pages/admin/settings/navigation/page";
import AdminSettingsAudit from "../pages/admin/settings/audit/page";
import AdminSettingsSiteIdentity from "../pages/admin/settings/site-identity/page";

// Charts
import ChartsDirectory from "../pages/charts/directory/page";
import ChartEdition from "../pages/charts/edition/page";

// Artists
import Artists from "../pages/artists/page";
import ArtistDetail from "../pages/artists/detail/page";

// Other entity pages
import Releases from "../pages/releases/page";
import ReleaseDetail from "../pages/releases/detail/page";
import Genres from "../pages/genres/page";
import GenreDetail from "../pages/genres/detail/page";
import Labels from "../pages/labels/page";
import LabelDetail from "../pages/labels/detail/page";
import Magazine from "../pages/magazine/page";
import ArticlePage from "../pages/magazine/article/page";
import MagazineIssuePage from "../pages/magazine/issue/page";
import AllIssuesPage from "../pages/magazine/issues/page";
import TrackDetail from "../pages/tracks/detail/page";
import LyricContribution from "../pages/tracks/lyrics/contribute/page";
import ProfilePage from "../pages/profile/page";
import SettingsPage from "../pages/settings/page";

// Search
import Search from "../pages/search/page";

// Guides
import GuidesPage from "../pages/guides/page";
import MobileGuides from "../pages/mobile/guides/page";

// Vertical pages
import FilmPage from "../pages/film/page";
import FashionPage from "../pages/fashion/page";
import FoodPage from "../pages/food/page";
import LanguagePage from "../pages/language/page";
import PlacesPage from "../pages/places/page";
import { MobileFilm, MobileFashion, MobileFood, MobileLanguage, MobilePlaces } from "../pages/mobile/verticals/page";

// Desktop player
import DesktopPlayerPage from "../pages/player/page";

// Mobile pages
import MobileHome from "../pages/mobile/home/page";
import MobileChartsDirectory from "../pages/mobile/charts/directory/page";
import MobileChartEdition from "../pages/mobile/charts/edition/page";
import MobileArtists from "../pages/mobile/artists/page";
import MobileArtistDetail from "../pages/mobile/artists/detail/page";
import MobileGenres from "../pages/mobile/genres/page";
import MobileGenreDetail from "../pages/mobile/genres/detail/page";
import MobileLabels from "../pages/mobile/labels/page";
import MobileLabelDetail from "../pages/mobile/labels/detail/page";
import MobileMagazine from "../pages/mobile/magazine/page";
import MobileArticlePage from "../pages/mobile/magazine/article/page";
import MobileMagazineIssuePage from "../pages/magazine/issue/page";
import MobileAllIssuesPage from "../pages/mobile/magazine/issues/page";
import MobileSearch from "../pages/mobile/search/page";
import MobileNotFound from "../pages/mobile/NotFound";
import MobileTrackDetail from "../pages/mobile/tracks/detail/page";
import MobileLyricContribution from "../pages/mobile/tracks/lyrics/contribute/page";
import MobileAuth from "../pages/mobile/auth/page";
import MobileProfile from "../pages/mobile/profile/page";
import MobileAuthorProfile from "../pages/mobile/authors/detail/page";
import AuthPage from "../pages/auth/page";

const routes: RouteObject[] = [
  { path: "/admin/login", element: <AdminLoginPage /> },
  { path: "/auth/reset-password", element: <ResetPasswordPage /> },
  {
    element: <ResponsiveAppLayout />,
    children: [
      { path: "/", element: <ResponsivePage mobile={<MobileHome />} desktop={<Home />} /> },
      { path: "/charts", element: <ResponsivePage mobile={<MobileChartsDirectory />} desktop={<ChartsDirectory />} /> },
      { path: "/charts/:family/:market/:series/:edition", element: <ResponsivePage mobile={<MobileChartEdition />} desktop={<ChartEdition />} /> },
      { path: "/charts/:family/:market/:series", element: <ResponsivePage mobile={<MobileChartEdition />} desktop={<ChartEdition />} /> },
      { path: "/charts/:series", element: <ResponsivePage mobile={<MobileChartEdition />} desktop={<ChartEdition />} /> },
      { path: "/charts/:series/:edition", element: <ResponsivePage mobile={<MobileChartEdition />} desktop={<ChartEdition />} /> },
      { path: "/artists", element: <ResponsivePage mobile={<MobileArtists />} desktop={<Artists />} /> },
      { path: "/artists/:slug", element: <ResponsivePage mobile={<MobileArtistDetail />} desktop={<ArtistDetail />} /> },
      { path: "/tracks/:artistSlug/:slug", element: <TrackDetail /> },
      { path: "/tracks/:slug", element: <TrackDetail /> },
      { path: "/tracks/:artistSlug/:slug/lyrics/contribute", element: <LyricContribution /> },
      { path: "/tracks/:slug/lyrics/contribute", element: <LyricContribution /> },
      { path: "/releases", element: <ResponsivePage mobile={<Releases />} desktop={<Releases />} /> },
      { path: "/releases/:artistSlug/:releaseSlug", element: <ResponsivePage mobile={<ReleaseDetail />} desktop={<ReleaseDetail />} /> },
      { path: "/genres/:slug", element: <ResponsivePage mobile={<MobileGenreDetail />} desktop={<GenreDetail />} /> },
      { path: "/genres", element: <ResponsivePage mobile={<MobileGenres />} desktop={<Genres />} /> },
      { path: "/labels/:slug", element: <ResponsivePage mobile={<MobileLabelDetail />} desktop={<LabelDetail />} /> },
      { path: "/labels", element: <ResponsivePage mobile={<MobileLabels />} desktop={<Labels />} /> },
      { path: "/magazine", element: <ResponsivePage mobile={<MobileMagazine />} desktop={<Magazine />} /> },
      { path: "/magazine/issues", element: <ResponsivePage mobile={<MobileAllIssuesPage />} desktop={<AllIssuesPage />} /> },
      { path: "/magazine/issues/:issueKey", element: <ResponsivePage mobile={<MobileMagazineIssuePage />} desktop={<MagazineIssuePage />} /> },
      { path: "/magazine/issue/:issueKey", element: <ResponsivePage mobile={<MobileMagazineIssuePage />} desktop={<MagazineIssuePage />} /> },
      { path: "/magazine/:slug", element: <ResponsivePage mobile={<MobileArticlePage />} desktop={<ArticlePage />} /> },
      { path: "/guides", element: <ResponsivePage mobile={<MobileGuides />} desktop={<GuidesPage />} /> },
      { path: "/film", element: <ResponsivePage mobile={<MobileFilm />} desktop={<FilmPage />} /> },
      { path: "/fashion", element: <ResponsivePage mobile={<MobileFashion />} desktop={<FashionPage />} /> },
      { path: "/food", element: <ResponsivePage mobile={<MobileFood />} desktop={<FoodPage />} /> },
      { path: "/language", element: <ResponsivePage mobile={<MobileLanguage />} desktop={<LanguagePage />} /> },
      { path: "/places", element: <ResponsivePage mobile={<MobilePlaces />} desktop={<PlacesPage />} /> },
      { path: "/search", element: <ResponsivePage mobile={<MobileSearch />} desktop={<Search />} /> },
      { path: "/player", element: <ResponsivePage mobile={<MobileHome />} desktop={<DesktopPlayerPage />} /> },
      { path: "/auth", element: <ResponsivePage mobile={<MobileAuth />} desktop={<AuthPage />} /> },
      { path: "/profile", element: <ResponsivePage mobile={<MobileProfile />} desktop={<ProfilePage />} /> },
      { path: "/authors/:slug", element: <ResponsivePage mobile={<MobileAuthorProfile />} desktop={<AuthorProfilePage />} /> },
      { path: "/settings", element: <ResponsivePage mobile={<SettingsPage />} desktop={<SettingsPage />} /> },
    ],
  },
  {
    path: "/admin",
    element: <AdminShell />,
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: "content/articles", element: <AdminArticlesPage /> },
      { path: "content/articles/:slug", element: <AdminArticleDetailPage /> },
      { path: "content/guides", element: <AdminGuidesPage /> },
      { path: "content/pages", element: <AdminPagesPage /> },
      { path: "content/publishing", element: <AdminPublishingDashboardPage /> },
      { path: "content/archive", element: <AdminContentArchivePage /> },
      { path: "content/migration", element: <AdminMediaMigrationPage /> },
      { path: "content/lyrics", element: <AdminLyricsPage /> },
      { path: "users", element: <AdminUsersPage /> },
      { path: "magazine/visuals", element: <AdminMagazineVisualsPage /> },
      { path: "registry/artists", element: <AdminArtistsPage /> },
      { path: "registry/artists/:slug", element: <AdminArtistDetailPage /> },
      { path: "registry/tracks", element: <AdminTracksPage /> },
      { path: "registry/tracks/:slug", element: <AdminTrackDetailPage /> },
      { path: "registry/releases", element: <AdminReleasesPage /> },
      { path: "registry/releases/:slug", element: <AdminReleaseDetailPage /> },
      { path: "registry/labels", element: <AdminLabelsPage /> },
      { path: "registry/labels/:slug", element: <AdminLabelDetailPage /> },
      { path: "registry/genres", element: <AdminGenresPage /> },
      { path: "registry/genres/:slug", element: <AdminGenreDetailPage /> },
      { path: "relationships/viewer", element: <AdminRelationshipViewerPage /> },
      { path: "relationships/duplicates", element: <AdminDuplicateMergePage /> },
      { path: "media/library", element: <AdminMediaLibraryPage /> },
      { path: "media/missing", element: <AdminMissingImagesPage /> },
      { path: "media/broken", element: <AdminBrokenLinksPage /> },
      { path: "review/queue", element: <AdminReviewQueuePage /> },
      { path: "imports", element: <AdminImportsPage /> },
      { path: "imports/review-artifacts", element: <AdminImportReviewArtifactsPage /> },
      { path: "imports/jobs", element: <AdminImportsJobsPage /> },
      { path: "imports/jobs/:id", element: <AdminImportsJobDetailPage /> },
      { path: "charts", element: <AdminChartsLayout />, children: [
        { index: true, element: <AdminChartsDashboard /> },
        { path: "dashboard", element: <AdminChartsDashboard /> },
        { path: "families", element: <AdminChartsFamilies /> },
        { path: "ingest", element: <AdminChartsIngest /> },
        { path: "ingest/:jobId", element: <AdminChartsIngestDetail /> },
        { path: "editions", element: <AdminChartsEditions /> },
        { path: "snapshots", element: <AdminChartsSnapshots /> },
        { path: "integration-map", element: <AdminChartsIntegrationMap /> },
        { path: "public-api-qa", element: <AdminChartsPublicApiQa /> },
        { path: "review-queue", element: <AdminChartsReviewQueue /> },
        { path: "no-match", element: <AdminChartsNoMatch /> },
        { path: "release-shells", element: <AdminChartsReleaseShells /> },
        { path: "canon-gaps", element: <AdminChartsCanonGaps /> },
        { path: "ingest-runs", element: <AdminChartsIngestRuns /> },
        { path: "ingest-runs/:runId", element: <AdminChartsIngestRunDetail /> },
        { path: "ingest-jobs", element: <AdminChartsLegacyIngestJobs /> },
        { path: "ingest-health", element: <AdminChartsIngestHealth /> },
      ] },
      { path: "settings", element: <AdminSettingsLayout />, children: [
        { index: true, element: <AdminSettingsHub /> },
        { path: "chart-defaults", element: <AdminSettingsChartDefaults /> },
        { path: "chart-defaults/market-scopes", element: <AdminSettingsChartDefaultsMarketScopes /> },
        { path: "integrations", element: <AdminSettingsIntegrations /> },
        { path: "gsc-data", element: <AdminSettingsGscData /> },
        { path: "frontend-appearance", element: <AdminSettingsFrontendAppearance /> },
        { path: "player-playback", element: <AdminSettingsPlayerPlayback /> },
        { path: "registry", element: <AdminSettingsRegistry /> },
        { path: "airplay", element: <AdminSettingsAirplay /> },
        { path: "audience", element: <AdminSettingsAudience /> },
        { path: "email-briefings", element: <AdminSettingsEmailBriefings /> },
        { path: "maintenance", element: <AdminSettingsMaintenance /> },
        { path: "navigation", element: <AdminSettingsNavigation /> },
        { path: "audit", element: <AdminSettingsAudit /> },
        { path: "site-identity", element: <AdminSettingsSiteIdentity /> },
      ] },
    ],
  },
  { path: "/player/full", element: <MobileFullPlayer /> },
  { path: "*", element: <ResponsivePage mobile={<MobileNotFound />} desktop={<NotFound />} /> },
  { path: "/m", element: <Navigate to="/" replace /> },
];

export default routes;
