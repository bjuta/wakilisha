import type { RouteObject } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
import AdminDesignSystem from "../pages/admin/design-system/page";
import Charts from "../pages/charts/page";
import Artists from "../pages/artists/page";
import Releases from "../pages/releases/page";
import Genres from "../pages/genres/page";
import Labels from "../pages/labels/page";
import Magazine from "../pages/magazine/page";

const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/charts", element: <Charts /> },
      { path: "/artists", element: <Artists /> },
      { path: "/releases", element: <Releases /> },
      { path: "/genres", element: <Genres /> },
      { path: "/labels", element: <Labels /> },
      { path: "/magazine", element: <Magazine /> },
    ],
  },
  {
    path: "/admin/design-system",
    element: <AdminDesignSystem />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;