import { useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { sendServerGa4PageView } from "@/services/ga4ServerAnalytics";

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
    __WAKILISHA_GA4_ID__?: string;
    __WAKILISHA_GA4_READY__?: boolean;
  }
}

function getMeasurementId(): string {
  const envId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();

  if (envId) {
    return envId;
  }

  if (typeof window !== "undefined" && window.__WAKILISHA_GA4_ID__) {
    return window.__WAKILISHA_GA4_ID__;
  }

  return "";
}

function isValidMeasurementId(id: string): boolean {
  return /^G-[A-Z0-9]+$/i.test(id);
}

function currentPagePath(pathname: string, search: string): string {
  return `${pathname}${search}`;
}

export default function GtagInjector() {
  const location = useLocation();
  const lastTrackedPath = useRef<string | null>(null);
  const measurementId = useMemo(() => getMeasurementId(), []);

  useEffect(() => {
    if (!measurementId || !isValidMeasurementId(measurementId)) {
      return;
    }

    if (location.pathname.startsWith("/admin")) {
      return;
    }

    if (typeof window.gtag !== "function") {
      return;
    }

    const pagePath = currentPagePath(location.pathname, location.search);

    if (lastTrackedPath.current === pagePath) {
      return;
    }

    lastTrackedPath.current = pagePath;

    window.gtag("config", measurementId, {
      page_title: document.title,
      page_location: window.location.href,
      page_path: pagePath,
    });

    void sendServerGa4PageView({
      pagePath,
      pageTitle: document.title,
      pageUrl: window.location.href,
    });
  }, [location.pathname, location.search, measurementId]);

  return null;
}
