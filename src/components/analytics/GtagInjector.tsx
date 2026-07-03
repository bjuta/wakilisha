import { useEffect, useRef } from "react";

const STORAGE_KEY = "wk_ga_measurement_id";
const INJECTED_ATTR = "data-wk-gtag-injected";

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}

export default function GtagInjector() {
  const injectedRef = useRef<string | null>(null);

  useEffect(() => {
    if (window.location.pathname.startsWith("/admin")) {
      return;
    }

    function cleanup() {
      document.querySelectorAll(`[${INJECTED_ATTR}]`).forEach((node) => node.remove());
      injectedRef.current = null;
    }

    function inject(id: string) {
      if (injectedRef.current === id) return;

      cleanup();

      window.dataLayer = window.dataLayer || [];
      window.gtag = (...args: unknown[]) => {
        window.dataLayer?.push(args);
      };

      const script = document.createElement("script");
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
      script.async = true;
      script.setAttribute(INJECTED_ATTR, "true");
      script.onload = () => {
        window.gtag?.("js", new Date());
        window.gtag?.("config", id, { send_page_view: false });
      };

      document.head.appendChild(script);
      injectedRef.current = id;
    }

    function checkAndInject() {
      const id = localStorage.getItem(STORAGE_KEY)?.trim();

      if (id) {
        inject(id);
      } else {
        cleanup();
      }
    }

    checkAndInject();

    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY) checkAndInject();
    }

    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
