import { lazy } from "react";

/* Admin Studio modules stay outside the public application entry. */

export const AdminAnalyticsPage = lazy(() =>
  import("../pages/admin/analytics/page"),
);

export const AdminApiDocsPage = lazy(() =>
  import("../pages/admin/api-docs/page"),
);

export const AdminArticleDetailPage = lazy(() =>
  import("../pages/admin/content/articles/detail/page"),
);

export const AdminArticlesPage = lazy(() =>
  import("../pages/admin/content/articles/page"),
);

export const AdminPlaylistsPage = lazy(() =>
  import("../pages/admin/content/playlists/page"),
);

export const AdminNewPlaylistPage = lazy(() =>
  import("../pages/admin/content/playlists/new/page"),
);

export const AdminPlaylistDetailPage = lazy(() =>
  import("../pages/admin/content/playlists/detail/page"),
);

export const AdminArtistAliasesPage = lazy(() =>
  import("../pages/admin/registry/artist-aliases/page"),
);

export const AdminArtistDecouplePage = lazy(() =>
  import("../pages/admin/registry/artist-aliases/decouple/page"),
);

export const AdminArtistDetailPage = lazy(() =>
  import("../pages/admin/registry/artists/detail/page"),
);

export const AdminArtistIntakePage = lazy(() =>
  import("../pages/admin/registry/artists/intake/page"),
);

export const AdminArtistsPage = lazy(() =>
  import("../pages/admin/registry/artists/page"),
);

export const AdminAuthorDetailPage = lazy(() =>
  import("../pages/admin/registry/authors/detail/page"),
);

export const AdminAuthorsPage = lazy(() =>
  import("../pages/admin/registry/authors/page"),
);

export const AdminBrokenLinksPage = lazy(() =>
  import("../pages/admin/media/broken/page"),
);

export const AdminCategoriesPage = lazy(() =>
  import("../pages/admin/content/categories/page"),
);

export const AdminChartsArtistResolution = lazy(() =>
  import("../pages/admin/charts/artist-resolution/page"),
);

export const AdminChartsBackfillPlanner = lazy(() =>
  import("../pages/admin/charts/backfill/page"),
);

export const AdminChartsCanonGaps = lazy(() =>
  import("../pages/admin/charts/canon-gaps/page"),
);

export const AdminChartsDashboard = lazy(() =>
  import("../pages/admin/charts/dashboard/page"),
);

export const AdminChartsEditionDetail = lazy(() =>
  import("../pages/admin/charts/edition-detail/page"),
);

export const AdminChartsEditions = lazy(() =>
  import("../pages/admin/charts/editions/page"),
);

export const AdminChartsFamilies = lazy(() =>
  import("../pages/admin/charts/families/page"),
);

export const AdminChartsIngest = lazy(() =>
  import("../pages/admin/charts/ingest/page"),
);

export const AdminChartsIngestDetail = lazy(() =>
  import("../pages/admin/charts/ingest/detail/page"),
);

export const AdminChartsIngestHealth = lazy(() =>
  import("../pages/admin/charts/ingest-health/page"),
);

export const AdminChartsIngestRunDetail = lazy(() =>
  import("../pages/admin/charts/ingest-run-detail/page"),
);

export const AdminChartsIngestRuns = lazy(() =>
  import("../pages/admin/charts/ingest-runs/page"),
);

export const AdminChartsIntegrationMap = lazy(() =>
  import("../pages/admin/charts/integration-map/page"),
);

export const AdminChartsLayout = lazy(() =>
  import("../pages/admin/charts/AdminChartsLayout").then((module) => ({
    default: module.AdminChartsLayout,
  })),
);

export const AdminChartsNoMatch = lazy(() =>
  import("../pages/admin/charts/no-match/page"),
);

export const AdminChartsPublicApiQa = lazy(() =>
  import("../pages/admin/charts/public-api-qa/page"),
);

export const AdminChartsReviewQueue = lazy(() =>
  import("../pages/admin/charts/review-queue/page"),
);

export const AdminChartsScoringRuns = lazy(() =>
  import("../pages/admin/charts/scoring-runs/page"),
);

export const AdminChartsSnapshots = lazy(() =>
  import("../pages/admin/charts/snapshots/page"),
);

export const AdminCommunityPage = lazy(() =>
  import("../pages/admin/community/page"),
);

export const AdminContentArchivePage = lazy(() =>
  import("../pages/admin/content/archive/page"),
);

export const AdminContentLayout = lazy(() =>
  import("@/components/admin/AdminSectionLayouts").then((module) => ({
    default: module.AdminContentLayout,
  })),
);

export const AdminDashboardPage = lazy(() =>
  import("../pages/admin/dashboard/page"),
);

export const AdminDuplicateMergePage = lazy(() =>
  import("../pages/admin/relationships/duplicates/page"),
);

export const AdminFeaturedArtistsPage = lazy(() =>
  import("../pages/admin/magazine/featured-artists/page"),
);

export const AdminFeaturedGuidesPage = lazy(() =>
  import("../pages/admin/magazine/featured-guides/page"),
);

export const AdminGenreDetailPage = lazy(() =>
  import("../pages/admin/registry/genres/detail/page"),
);

export const AdminGenresPage = lazy(() =>
  import("../pages/admin/registry/genres/page"),
);

export const AdminGuideDetailPage = lazy(() =>
  import("../pages/admin/content/guides/detail/page"),
);

export const AdminGuidesPage = lazy(() =>
  import("../pages/admin/content/guides/page"),
);

export const AdminInquiryInterfacePage = lazy(() =>
  import("../pages/admin/institute/inquiry-interface/page"),
);

export const AdminLabelDetailPage = lazy(() =>
  import("../pages/admin/registry/labels/detail/page"),
);

export const AdminLabelsPage = lazy(() =>
  import("../pages/admin/registry/labels/page"),
);

export const AdminLoginPage = lazy(() =>
  import("../pages/admin/login/page"),
);

export const AdminLyricsPage = lazy(() =>
  import("../pages/admin/content/lyrics/page"),
);

export const AdminMediaLayout = lazy(() =>
  import("@/components/admin/AdminSectionLayouts").then((module) => ({
    default: module.AdminMediaLayout,
  })),
);

export const AdminMediaLibraryPage = lazy(() =>
  import("../pages/admin/media/library/page"),
);

export const AdminMissingImagesPage = lazy(() =>
  import("../pages/admin/media/missing/page"),
);

export const AdminNewArticlePage = lazy(() =>
  import("../pages/admin/content/articles/new/page"),
);

export const AdminPagesPage = lazy(() =>
  import("../pages/admin/content/pages/page"),
);

export const AdminPublishingDashboardPage = lazy(() =>
  import("../pages/admin/content/publishing/page"),
);

export const AdminRegistryLayout = lazy(() =>
  import("@/components/admin/AdminSectionLayouts").then((module) => ({
    default: module.AdminRegistryLayout,
  })),
);

export const AdminRegistryOverview = lazy(() =>
  import("../pages/admin/registry/page"),
);

export const AdminRelationshipViewerPage = lazy(() =>
  import("../pages/admin/relationships/viewer/page"),
);

export const AdminRelationshipsLayout = lazy(() =>
  import("@/components/admin/AdminSectionLayouts").then((module) => ({
    default: module.AdminRelationshipsLayout,
  })),
);

export const AdminReleaseDetailPage = lazy(() =>
  import("../pages/admin/registry/releases/detail/page"),
);

export const AdminReleasesPage = lazy(() =>
  import("../pages/admin/registry/releases/page"),
);

export const AdminReviewLayout = lazy(() =>
  import("@/components/admin/AdminSectionLayouts").then((module) => ({
    default: module.AdminReviewLayout,
  })),
);

export const AdminReviewQueuePage = lazy(() =>
  import("../pages/admin/review/queue/page"),
);

export const AdminSettingsAirplay = lazy(() =>
  import("../pages/admin/settings/airplay/page"),
);

export const AdminSettingsAudience = lazy(() =>
  import("../pages/admin/settings/audience/page"),
);

export const AdminSettingsAudit = lazy(() =>
  import("../pages/admin/settings/audit/page"),
);

export const AdminSettingsChartDefaults = lazy(() =>
  import("../pages/admin/settings/chart-defaults/page"),
);

export const AdminSettingsChartDefaultsMarketScopes = lazy(() =>
  import("../pages/admin/settings/chart-defaults/market-scopes/page"),
);

export const AdminSettingsDesignSystem = lazy(() =>
  import("../pages/admin/settings/design-system/page"),
);

export const AdminSettingsEmailBriefings = lazy(() =>
  import("../pages/admin/settings/email-briefings/page"),
);

export const AdminSettingsFrontendAppearance = lazy(() =>
  import("../pages/admin/settings/frontend-appearance/page"),
);

export const AdminSettingsGscData = lazy(() =>
  import("../pages/admin/settings/gsc-data/page"),
);

export const AdminSettingsHub = lazy(() =>
  import("../pages/admin/settings/page"),
);

export const AdminSettingsIntegrations = lazy(() =>
  import("../pages/admin/settings/integrations/page"),
);

export const AdminSettingsLayout = lazy(() =>
  import("../pages/admin/settings/AdminSettingsLayout").then((module) => ({
    default: module.AdminSettingsLayout,
  })),
);

export const AdminSettingsMaintenance = lazy(() =>
  import("../pages/admin/settings/maintenance/page"),
);

export const AdminSettingsNavigation = lazy(() =>
  import("../pages/admin/settings/navigation/page"),
);

export const AdminSettingsPlayerPlayback = lazy(() =>
  import("../pages/admin/settings/player-playback/page"),
);

export const AdminSettingsRegistry = lazy(() =>
  import("../pages/admin/settings/registry/page"),
);

export const AdminSettingsSeo = lazy(() =>
  import("../pages/admin/settings/seo/page"),
);

export const AdminSettingsSiteIdentity = lazy(() =>
  import("../pages/admin/settings/site-identity/page"),
);

export const AdminShell = lazy(() =>
  import("../pages/admin/AdminShell").then((module) => ({
    default: module.AdminShell,
  })),
);

export const AdminTagsPage = lazy(() =>
  import("../pages/admin/content/tags/page"),
);

export const AdminTrackDetailPage = lazy(() =>
  import("../pages/admin/registry/tracks/detail/page"),
);

export const AdminTrackIntakePage = lazy(() =>
  import("../pages/admin/registry/tracks/intake/page"),
);

export const AdminTracksPage = lazy(() =>
  import("../pages/admin/registry/tracks/page"),
);

export const AdminTrashPage = lazy(() =>
  import("../pages/admin/content/articles/trash/page"),
);

export const AdminUsersLayout = lazy(() =>
  import("@/components/admin/AdminSectionLayouts").then((module) => ({
    default: module.AdminUsersLayout,
  })),
);

export const AdminUsersPage = lazy(() =>
  import("../pages/admin/users/page"),
);
