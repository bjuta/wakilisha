import type { RouteObject } from "react-router-dom";
import { ResponsiveAppLayout } from "@/components/mobile/ResponsiveAppLayout";
import { ResponsivePage } from "@/components/mobile/ResponsivePage";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
import AdminDesignSystem from "../pages/admin/design-system/page";
import Charts from "../pages/charts/page";
import Artists from "../pages/artists/page";
import ArtistDetail from "../pages/artists/detail/page";
import Releases from "../pages/releases/page";
import Genres from "../pages/genres/page";
import Labels from "../pages/labels/page";
import Magazine from "../pages/magazine/page";
import ArticlePage from "../pages/magazine/article/page";
import TrackDetail from "../pages/tracks/detail/page";

// Mobile pages
import MobileHome from "../pages/mobile/home/page";
import MobileCharts from "../pages/mobile/charts/page";
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

const routes: RouteObject[] = [
  {
    element: <ResponsiveAppLayout />,
    children: [
      { path: "/", element: <ResponsivePage mobile={<MobileHome />} desktop={<Home />} /> },
      { path: "/charts", element: <ResponsivePage mobile={<MobileCharts />} desktop={<Charts />} /> },
      { path: "/artists", element: <ResponsivePage mobile={<MobileArtists />} desktop={<Artists />} /> },
      { path: "/artists/:slug", element: <ResponsivePage mobile={<MobileArtistDetail />} desktop={<ArtistDetail />} /> },
      { path: "/tracks/:slug", element: <ResponsivePage mobile={<MobileTrackDetail />} desktop={<TrackDetail />} /> },
      { path: "/releases", element: <ResponsivePage mobile={<MobileReleases />} desktop={<Releases />} /> },
      { path: "/genres", element: <ResponsivePage mobile={<MobileGenres />} desktop={<Genres />} /> },
      { path: "/labels", element: <ResponsivePage mobile={<MobileLabels />} desktop={<Labels />} /> },
      { path: "/magazine", element: <ResponsivePage mobile={<MobileMagazine />} desktop={<Magazine />} /> },
      { path: "/magazine/:slug", element: <ResponsivePage mobile={<MobileArticlePage />} desktop={<ArticlePage />} /> },
      { path: "/search", element: <MobileSearch /> },
      { path: "/player", element: <ResponsivePage mobile={<MobileFullPlayer />} desktop={<MobileFullPlayer />} /> },
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