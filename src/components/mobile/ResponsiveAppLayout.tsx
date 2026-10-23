import { Component, lazy, Suspense, useLayoutEffect, useState, type ReactNode } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MobileAppLayout } from "@/components/mobile/MobileAppLayout";
import {
  PlayerCompactSurface,
} from "@/components/design-system/player/PlayerCompactSurface";
import { usePlayer } from "@/context/PlayerContext";
import { useMobileDetect } from "@/hooks/useMobileDetect";
import { RegistryOnboardingGate } from "@/components/auth/RegistryOnboardingGate";

class PlayerPresentationBoundary extends Component<
  { children: ReactNode; onClose: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) {
    console.error("WAKILISHA Now Playing presentation could not render", error);
  }
  render() {
    if (this.state.failed) {
      return <div role="alert" className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 p-6 text-center text-[var(--wk-text)]">
        <p>Now Playing could not be opened. Your current page and playback remain available.</p>
        <button type="button" onClick={this.props.onClose}
          className="min-h-11 rounded-full border border-[var(--wk-border)] px-6 font-semibold">Close player</button>
      </div>;
    }
    return this.props.children;
  }
}

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
  const { isFullPlayerOpen, closeFullPlayer } = usePlayer();
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
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
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
          className="fixed inset-y-0 right-0 z-[110] h-[100dvh] touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain bg-[var(--wk-bg)]"
          style={{ left: isMobile ? 0 : sidebarWidth }}
        >
          <PlayerPresentationBoundary onClose={closeFullPlayer}>
            <Suspense fallback={
              <div role="status" aria-label="Opening Now Playing" className="flex min-h-[100dvh] flex-col bg-[var(--wk-bg)] px-5 py-5 text-[var(--wk-text)]">
                <div className="flex min-h-11 items-center justify-between">
                  <button type="button" onClick={closeFullPlayer}
                    className="min-h-11 rounded-full px-3 text-sm font-semibold">Close player</button>
                  <span className="text-xs font-semibold text-[var(--wk-text-muted)]">Now Playing</span>
                </div>
                <div className="mx-auto mt-12 aspect-square w-[min(76vw,360px)] animate-pulse rounded-2xl bg-[var(--wk-surface-raised)]" />
                <p className="mt-6 text-center text-sm text-[var(--wk-text-muted)]">Opening Now Playing…</p>
              </div>
            }>
              <LazyPlayerFullSurface mode={isMobile ? "mobile" : "desktop"} />
            </Suspense>
          </PlayerPresentationBoundary>
        </div>
      ) : null}
    </RegistryOnboardingGate>
  );
}
