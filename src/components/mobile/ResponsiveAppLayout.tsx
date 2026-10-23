import { lazy, Suspense, useLayoutEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MobileAppLayout } from "@/components/mobile/MobileAppLayout";
import {
  PlayerCompactSurface,
} from "@/components/design-system/player/PlayerCompactSurface";
import { usePlayer } from "@/context/PlayerContext";
import { useMobileDetect } from "@/hooks/useMobileDetect";
import { RegistryOnboardingGate } from "@/components/auth/RegistryOnboardingGate";

const LazyPlayerFullSurface = lazy(async () => {
  const module = await import(
    "@/components/design-system/player/PlayerFullSurface"
  );

  return {
    default: module.PlayerFullSurface,
  };
});

/**
 * Keep the active route mounted while Now Playing expands or collapses.
 * The old conditional baseLayout/full-player tree destroyed the entire
 * route on every toggle. This presentation overlay changes no media engine,
 * route, user session, or queue authority.
 */
export function ResponsiveAppLayout() {
  const isMobile = useMobileDetect();
  const { isFullPlayerOpen } = usePlayer();
  const [sidebarWidth, setSidebarWidth] = useState(256);

  useLayoutEffect(() => {
    if (isMobile || !isFullPlayerOpen) return;
    const sidebar = document.querySelector<HTMLElement>(
      ".wk-music-app-shell > aside",
    );
    if (!sidebar) {
      setSidebarWidth(0);
      return;
    }
    const measure = () => setSidebarWidth(sidebar.getBoundingClientRect().width);
    measure();
    // Follow the accepted 80px rail / 256px sidebar, including user collapse.
    const observer = new ResizeObserver(measure);
    observer.observe(sidebar);
    return () => observer.disconnect();
  }, [isMobile, isFullPlayerOpen]);

  return (
    <RegistryOnboardingGate>
      <div
        data-wk-player-underlay
        inert={isMobile && isFullPlayerOpen}
        aria-hidden={isMobile && isFullPlayerOpen ? true : undefined}
      >
        {isMobile ? (
          <>
            <MobileAppLayout />
            <PlayerCompactSurface mode="mobile" />
          </>
        ) : (
          <AppLayout />
        )}
      </div>
      {isFullPlayerOpen ? (
        <div
          data-wk-player-overlay
          className="fixed inset-y-0 right-0 z-[110] overflow-y-auto overscroll-contain bg-[var(--wk-bg)]"
          style={{ left: isMobile ? 0 : sidebarWidth }}
        >
          <Suspense fallback={null}>
            <LazyPlayerFullSurface mode={isMobile ? "mobile" : "desktop"} />
          </Suspense>
        </div>
      ) : null}
    </RegistryOnboardingGate>
  );
}
