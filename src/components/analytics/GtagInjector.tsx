import { useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";

const STORAGE_KEY = "wk_ga_measurement_id";
const INJECTED_ATTR = "data-wk-gtag-injected";

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}

function getConfiguredMeasurementId(): string {
  const envId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();

  if (envId) {
    return envId;
  }

  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function isValidMeasurementId(id: string): boolean {
  return /^G-[A-Z0-9]+$/i.test(id);
}

export default function GtagInjector() {
  const location = useLocation();
  const injectedRef = useRef<string | null>(null);
  const measurementId = useMemo(() => getConfiguredMeasurementId(), []);

  useEffect(() => {
    if (window.location.pathname.startsWith("/admin")) {
      return;
    }

    if (!measurementId || !isValidMeasurementId(measurementId)) {
      return;
    }

    if (injectedRef.current === measurementId) {
      return;
    }

    window.dataLayer = window.dataLayer || [];
    window.gtag = (...args: unknown[]) => {
      window.dataLayer?.push(args);
    };

    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
      send_page_view: false,
    });

    const script = document.createElement("script");
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.async = true;
    script.setAttribute(INJECTED_ATTR, "true");

    document.head.appendChild(script);
    injectedRef.current = measurementId;

    return () => {
      document.querySelectorAll(`[${INJECTED_ATTR}]`).forEach((node) => node.remove());
      injectedRef.current = null;
    };
  }, [measurementId]);

  useEffect(() => {
    if (!measurementId || !isValidMeasurementId(measurementId)) {
      return;
    }

    if (location.pathname.startsWith("/admin")) {
      return;
    }

    window.gtag?.("event", "page_view", {
      page_title: document.title,
      page_location: window.location.href,
      page_path: `${location.pathname}${location.search}`,
    });
  }, [location.pathname, location.search, measurementId]);

  return null;
}
