import type { RouteObject } from "react-router-dom";
import { ResponsiveAppLayout } from "@/components/mobile/ResponsiveAppLayout";
import { ResponsivePage } from "@/components/mobile/ResponsivePage";
import { MobileFullPlayer } from "@/components/mobile/MobileFullPlayer";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
import AdminDesignSystem from "../pages/admin/design-system/page";

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
import Labels from "../pages/labels/page";
import Magazine from "../pages/magazine/page";
import ArticlePage from "../pages/magazine/article/page";
import TrackDetail from "../pages/tracks/detail/page";
import ProfilePage from "../pages/profile/page";
import SettingsPage from "../pages/settings/page";

// Search
import Search from "../pages/search/page";

// Mobile pages
import MobileHome from "../pages/mobile/home/page";
import MobileChartsDirectory from "../pages/mobile/charts/directory/page";
import MobileChartEdition from "../pages/mobile/charts/edition/page";
import MobileArtists from "../pages/mobile/artists/page";
import MobileArtistDetail from "../pages/mobile/artists/detail/page";
import MobileReleases from "../pages/mobile/releases/page";
import MobileGenres from "../pages/mobile/genres/page";
import MobileLabels from "../pages/mobile/labels/page";
import MobileMagazine from "../pages/mobile/magazine/page";
import MobileArticlePage from "../pages/mobile/magazine/article/page";
import MobileSearch from "../pages/mobile/search/page";
import MobileNotFound from "../pages/mobile/NotFound";
import MobileTrackDetail from "../pages/mobile/tracks/detail/page";
import MobileAuth from "../pages/mobile/auth/page";
import MobileProfile from "../pages/mobile/profile/page";

const routes: RouteObject[] = [
  {
    element: <ResponsiveAppLayout />,
    children: [
      { path: "/", element: <ResponsivePage mobile={<MobileHome />} desktop={<Home />} /> },

      // Charts: directory at /charts, edition at /charts/:series/:edition
      { path: "/charts", element: <ResponsivePage mobile={<MobileChartsDirectory />} desktop={<ChartsDirectory />} /> },
      { path: "/charts/:series", element: <ResponsivePage mobile={<MobileChartEdition />} desktop={<ChartEdition />} /> },
      { path: "/charts/:series/:edition", element: <ResponsivePage mobile={<MobileChartEdition />} desktop={<ChartEdition />} /> },

      // Artists
      { path: "/artists", element: <ResponsivePage mobile={<MobileArtists />} desktop={<Artists />} /> },
      { path: "/artists/:slug", element: <ResponsivePage mobile={<MobileArtistDetail />} desktop={<ArtistDetail />} /> },

      // Tracks
      { path: "/tracks/:slug", element: <ResponsivePage mobile={<MobileTrackDetail />} desktop={<TrackDetail />} /> },

      // Releases
      { path: "/releases", element: <ResponsivePage mobile={<MobileReleases />} desktop={<Releases />} /> },
      { path: "/releases/:slug", element: <ResponsivePage mobile={<MobileReleases />} desktop={<ReleaseDetail />} /> },

      // Genres
      { path: "/genres", element: <ResponsivePage mobile={<MobileGenres />} desktop={<Genres />} /> },

      // Labels
      { path: "/labels", element: <ResponsivePage mobile={<MobileLabels />} desktop={<Labels />} /> },

      // Magazine
      { path: "/magazine", element: <ResponsivePage mobile={<MobileMagazine />} desktop={<Magazine />} /> },
      { path: "/magazine/:slug", element: <ResponsivePage mobile={<MobileArticlePage />} desktop={<ArticlePage />} /> },

      // Search
      { path: "/search", element: <ResponsivePage mobile={<MobileSearch />} desktop={<Search />} /> },

      // Player — desktop only page, mobile uses overlay state
      { path: "/player", element: <ResponsivePage mobile={<MobileHome />} desktop={<MobileFullPlayer />} /> },
      { path: "/auth", element: <ResponsivePage mobile={<MobileAuth />} desktop={<MobileAuth />} /> },
      { path: "/profile", element: <ResponsivePage mobile={<MobileProfile />} desktop={<ProfilePage />} /> },
      { path: "/settings", element: <ResponsivePage mobile={<SettingsPage />} desktop={<SettingsPage />} /> },
    ],
  },
  {
    path: "/admin/design-system",
    element: <AdminDesignSystem />,
  },
  // Admin Charts Ingestion Studio
  {
    path: "/admin/charts",
    element: <AdminChartsLayout />,
    children: [
      { path: "dashboard", element: <AdminChartsDashboard /> },
      { path: "families", element: <AdminChartsFamilies /> },
      { path: "ingest", element: <AdminChartsIngest /> },
      { path: "ingest/:jobId", element: <AdminChartsIngestDetail /> },
      { path: "editions", element: <AdminChartsEditions /> },
      { path: "snapshots", element: <AdminChartsSnapshots /> },
      { path: "integration-map", element: <AdminChartsIntegrationMap /> },
      { path: "public-api-qa", element: <AdminChartsPublicApiQa /> },
    ],
  },
  {
    path: "*",
    element: <ResponsivePage mobile={<MobileNotFound />} desktop={<NotFound />} />,
  },
];

export default routes;