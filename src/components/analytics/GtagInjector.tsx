import { useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  getGa4MeasurementId,
  isGa4RuntimeAllowed,
  isValidGa4MeasurementId,
} from "@/lib/analytics/ga4Bootstrap";

const SENSITIVE_QUERY_PARAMETERS = new Set([
  "access_token",
  "auth_token",
  "code",
  "email",
  "invite",
  "name",
  "password",
  "phone",
  "preview_token",
  "refresh_token",
  "reset_token",
  "token",
]);

function sanitizedPageLocation(
  pathname: string,
  search: string,
): {
  pageLocation: string;
  pagePath: string;
} {
  const url = new URL(
    `${pathname}${search}`,
    window.location.origin,
  );

  for (const key of [...url.searchParams.keys()]) {
    if (
      SENSITIVE_QUERY_PARAMETERS.has(key.toLowerCase())
    ) {
      url.searchParams.delete(key);
    }
  }

  url.hash = "";

  return {
    pageLocation: url.toString(),
    pagePath: `${url.pathname}${url.search}`,
  };
}

function sanitizedReferrer(value: string): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    for (const key of [...url.searchParams.keys()]) {
      if (
        SENSITIVE_QUERY_PARAMETERS.has(
          key.toLowerCase(),
        )
      ) {
        url.searchParams.delete(key);
      }
    }

    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export default function GtagInjector() {
  const location = useLocation();
  const lastTrackedPath = useRef<string | null>(null);

  const previousPageLocation = useRef<string | null>(
    typeof document !== "undefined"
      ? sanitizedReferrer(document.referrer)
      : null,
  );

  const measurementId = useMemo(
    () => getGa4MeasurementId(),
    [],
  );

  useEffect(() => {
    if (
      !measurementId ||
      !isValidGa4MeasurementId(measurementId)
    ) {
      return;
    }

    if (!isGa4RuntimeAllowed()) {
      return;
    }

    if (location.pathname.startsWith("/admin")) {
      return;
    }

    window.__WAKILISHA_LOAD_GA4__?.();

    if (typeof window.gtag !== "function") {
      return;
    }

    const { pageLocation, pagePath } =
      sanitizedPageLocation(
        location.pathname,
        location.search,
      );

    if (lastTrackedPath.current === pagePath) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (lastTrackedPath.current === pagePath) {
        return;
      }

      const eventParameters: Record<string, unknown> = {
        send_to: measurementId,
        page_title: document.title,
        page_location: pageLocation,
        page_path: pagePath,
      };

      if (previousPageLocation.current) {
        eventParameters.page_referrer =
          previousPageLocation.current;
      }

      window.gtag?.(
        "event",
        "page_view",
        eventParameters,
      );

      lastTrackedPath.current = pagePath;
      previousPageLocation.current = pageLocation;
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    location.pathname,
    location.search,
    measurementId,
  ]);

  return null;
}
