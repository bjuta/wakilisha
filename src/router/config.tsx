import type { RouteObject } from "react-router-dom";
import { ResponsiveAppLayout } from "@/components/mobile/ResponsiveAppLayout";
import { ResponsivePage } from "@/components/mobile/ResponsivePage";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
import AdminDesignSystem from "../pages/admin/design-system/page";

// Charts
import ChartsDirectory from "../pages/charts/directory/page";
import ChartEdition from "../pages/charts/edition/page";

// Artists
import Artists from "../pages/artists/page";
import ArtistDetail from "../pages/artists/detail/page";

// Other entity pages
import Releases from "../pages/releases/page";
import Genres from "../pages/genres/page";
import Labels from "../pages/labels/page";
import Magazine from "../pages/magazine/page";
import ArticlePage from "../pages/magazine/article/page";
import TrackDetail from "../pages/tracks/detail/page";

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
import MobileFullPlayer from "../pages/mobile/player/page";
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

      // Genres
      { path: "/genres", element: <ResponsivePage mobile={<MobileGenres />} desktop={<Genres />} /> },

      // Labels
      { path: "/labels", element: <ResponsivePage mobile={<MobileLabels />} desktop={<Labels />} /> },

      // Magazine
      { path: "/magazine", element: <ResponsivePage mobile={<MobileMagazine />} desktop={<Magazine />} /> },
      { path: "/magazine/:slug", element: <ResponsivePage mobile={<MobileArticlePage />} desktop={<ArticlePage />} /> },

      // Search
      { path: "/search", element: <ResponsivePage mobile={<MobileSearch />} desktop={<Search />} /> },

      // Player / account
      { path: "/player", element: <ResponsivePage mobile={<MobileFullPlayer />} desktop={<MobileFullPlayer />} /> },
      { path: "/auth", element: <ResponsivePage mobile={<MobileAuth />} desktop={<MobileAuth />} /> },
      { path: "/profile", element: <ResponsivePage mobile={<MobileProfile />} desktop={<MobileProfile />} /> },
    ],
  },
  {
    path: "/admin/design-system",
    element: <AdminDesignSystem />,
  },
  {
    path: "*",
    element: <ResponsivePage mobile={<MobileNotFound />} desktop={<NotFound />} />,
  },
];

export default routes;
