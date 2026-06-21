import { useEffect, useRef } from "react";

const STORAGE_KEY = "wk_ga_measurement_id";
const INJECTED_ATTR = "data-wk-gtag-injected";

/**
 * Reads the GA4 Measurement ID from localStorage (set via the integrations
 * page at /admin/settings/integrations) and dynamically injects the gtag.js
 * script into the document head. No ID configured? No script — zero overhead.
 *
 * This runs once per app mount and watches for localStorage changes so the
 * script is injected immediately after a user saves a new ID in another tab
 * or after the current tab comes back from the integrations page.
 */
export default function GtagInjector() {
  const injectedRef = useRef<string | null>(null);

  useEffect(() => {
    function inject(id: string) {
      // Skip if already injected for this exact ID
      if (injectedRef.current === id) return;

      // Remove any previous injection
      const prev = document.querySelector(`[${INJECTED_ATTR}]`);
      if (prev) prev.remove();
      const prevInline = document.querySelector(`script[${INJECTED_ATTR}]`);
      if (prevInline) prevInline.remove();

      // Inject gtag async script
      const script = document.createElement("script");
      script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
      script.async = true;
      script.setAttribute(INJECTED_ATTR, "true");
      document.head.appendChild(script);

      // Inject inline config
      const inline = document.createElement("script");
      inline.setAttribute(INJECTED_ATTR, "true");
      inline.textContent = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${id}', { send_page_view: false });
      `;
      document.head.appendChild(inline);

      injectedRef.current = id;
    }

    function checkAndInject() {
      const id = localStorage.getItem(STORAGE_KEY);
      if (id && id.trim()) {
        inject(id.trim());
      } else {
        // No ID configured — clean up any stale injection
        if (injectedRef.current) {
          const prev = document.querySelector(`[${INJECTED_ATTR}]`);
          if (prev) prev.remove();
          const prevInline = document.querySelector(`script[${INJECTED_ATTR}]`);
          if (prevInline) prevInline.remove();
          injectedRef.current = null;
          // Also remove window.gtag if we were the ones who set it
          // (leave it if analytics tracking already existed)
        }
      }
    }

    // Initial check
    checkAndInject();

    // Watch for storage changes (e.g. user saves ID in integrations tab)
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) checkAndInject();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return null;
}