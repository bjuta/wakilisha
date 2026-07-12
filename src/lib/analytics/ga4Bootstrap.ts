declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __WAKILISHA_GA4_ID__?: string;
    __WAKILISHA_GA4_READY__?: boolean;
    __WAKILISHA_GA4_BOOTSTRAPPED__?: boolean;
    __WAKILISHA_LOAD_GA4__?: () => void;
  }
}

const PRODUCTION_ANALYTICS_HOSTS = new Set([
  "wakilisha.africa",
  "www.wakilisha.africa",
]);

const GA4_LOADER_SELECTOR =
  'script[data-wakilisha-ga4-loader="true"]';

export function isValidGa4MeasurementId(id: string): boolean {
  return /^G-[A-Z0-9]+$/i.test(id);
}

export function getGa4MeasurementId(): string {
  const envId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();

  if (envId) {
    return envId;
  }

  if (
    typeof window !== "undefined" &&
    window.__WAKILISHA_GA4_ID__
  ) {
    return window.__WAKILISHA_GA4_ID__;
  }

  return "";
}

export function isGa4RuntimeAllowed(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return PRODUCTION_ANALYTICS_HOSTS.has(
    window.location.hostname,
  );
}

export function initializeGa4Bootstrap(): void {
  if (typeof window === "undefined") {
    return;
  }

  const measurementId = getGa4MeasurementId();

  if (
    !measurementId ||
    !isValidGa4MeasurementId(measurementId) ||
    !isGa4RuntimeAllowed()
  ) {
    window.__WAKILISHA_GA4_READY__ = false;
    return;
  }

  if (window.__WAKILISHA_GA4_BOOTSTRAPPED__) {
    window.__WAKILISHA_LOAD_GA4__?.();
    return;
  }

  window.__WAKILISHA_GA4_BOOTSTRAPPED__ = true;
  window.__WAKILISHA_GA4_ID__ = measurementId;
  window.__WAKILISHA_GA4_READY__ = false;
  window.dataLayer = window.dataLayer || [];

  window.gtag =
    window.gtag ||
    function gtag(..._args: unknown[]) {
      window.dataLayer?.push(arguments);
    };

  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    send_page_view: false,
  });

  let loading = false;

  const loadGa4 = () => {
    if (window.location.pathname.startsWith("/admin")) {
      return;
    }

    if (
      loading ||
      document.querySelector(GA4_LOADER_SELECTOR)
    ) {
      return;
    }

    loading = true;

    const loader = document.createElement("script");
    loader.async = true;
    loader.setAttribute(
      "data-wakilisha-ga4-loader",
      "true",
    );
    loader.src =
      "https://www.googletagmanager.com/gtag/js?id=" +
      encodeURIComponent(measurementId);

    loader.onload = () => {
      loading = false;
      window.__WAKILISHA_GA4_READY__ = true;
    };

    loader.onerror = () => {
      loading = false;
      window.__WAKILISHA_GA4_READY__ = false;
      loader.remove();
    };

    document.head.appendChild(loader);
  };

  window.__WAKILISHA_LOAD_GA4__ = loadGa4;
  loadGa4();
}
