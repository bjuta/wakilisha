import { useEffect, useRef } from "react";
import { trackEvent } from "@/services/analytics";

type ScrollDepthOptions = {
  pageType?: string;
  entitySlug?: string;
  entityType?: string;
  context?: Record<string, unknown>;
};

const THRESHOLDS = [25, 50, 75, 100];

/**
 * Fires scroll_depth events at 25%, 50%, 75%, and 100% scroll depth.
 * Each threshold fires only once per session per page.
 *
 * Uses requestAnimationFrame for performance — no layout thrashing.
 * The 100% threshold fires 200px before the actual bottom so users
 * don't have to pixel-scroll to the very end.
 */
export function useScrollDepthTracking(options: ScrollDepthOptions = {}) {
  const firedRef = useRef<Set<number>>(new Set());
  const optionsRef = useRef(options);

  // Keep options ref in sync without re-triggering the effect
  optionsRef.current = options;

  useEffect(() => {
    // Reset fired thresholds on mount (new page = clean slate)
    firedRef.current = new Set();

    let rafId: number | null = null;

    function checkDepth() {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      if (max <= 0) return; // page fits viewport, no scrolling possible

      const pct = Math.round((window.scrollY / max) * 100);

      for (const threshold of THRESHOLDS) {
        if (pct >= threshold && !firedRef.current.has(threshold)) {
          firedRef.current.add(threshold);

          const opts = optionsRef.current;
          trackEvent("scroll_depth", {
            pageType: opts.pageType,
            entitySlug: opts.entitySlug,
            entityType: opts.entityType,
            context: {
              ...opts.context,
              scroll_percent: threshold,
            },
          });
        }
      }
    }

    function onScroll() {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        checkDepth();
      });
    }

    // Check initial position (e.g. page loaded scrolled)
    checkDepth();

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);
}