import { useNavigate, type NavigateFunction } from "react-router-dom";
import { useRoutes } from "react-router-dom";
import { createElement, useEffect } from "react";
import { AdminShell } from "../pages/admin/AdminShell";
import AdminInquiryInterfacePage from "../pages/admin/lab/inquiry-interface/page";
import routes from "./config";

const labRoute = {
  path: "/admin",
  element: createElement(AdminShell),
  children: [
    { path: "lab/inquiry-interface", element: createElement(AdminInquiryInterfacePage) },
  ],
};

let navigateResolver: (navigate: ReturnType<typeof useNavigate>) => void;

declare global {
  interface Window {
    REACT_APP_NAVIGATE: ReturnType<typeof useNavigate>;
  }
}

export const navigatePromise = new Promise<NavigateFunction>((resolve) => {
  navigateResolver = resolve;
});

export function AppRoutes() {
  const element = useRoutes([labRoute, ...routes]);
  const navigate = useNavigate();
  useEffect(() => {
    window.REACT_APP_NAVIGATE = navigate;
    navigateResolver(window.REACT_APP_NAVIGATE);
  });
  return element;
}
