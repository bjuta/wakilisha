import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { MobileTopBar } from "@/components/mobile/MobileTopBar";
import { shouldReserveWakilishaHeaderSpace } from "@/components/navigation/wakilishaHeaderSpace";

const MUSIC_APP_PREFIXES = [
  "/music",
  "/following",
  "/charts",
  "/playlists",
  "/artists",
  "/releases",
  "/tracks",
  "/genres",
  "/labels",
  "/magazine",
  "/artist-studio",
  "/search",
] as const;

export function isMusicAppPath(pathname: string): boolean {
  if (
    pathname.includes("/manage") ||
    pathname.includes("/lyrics/contribute")
  ) {
    return false;
  }

  return MUSIC_APP_PREFIXES.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(`${prefix}/`),
  );
}

/**
 * All public viewport classes now use the same WAKILISHA top-left Menu,
 * right-edge Search and start-edge drawer. No permanent desktop/tablet
 * sidebar or icon rail reserves horizontal page space.
 *
 * The real route stays mounted under the drawer, including playback,
 * article drafts and other client-side state.
 */
export function MusicDesktopShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const reserveHeaderSpace = shouldReserveWakilishaHeaderSpace(location.pathname);

  return (
    <div
      className="wk-music-app-shell relative min-h-[100dvh] bg-[var(--wk-bg)] text-[var(--wk-text)]"
      data-wk-unified-public-shell="topbar-drawer"
    >
      <MobileTopBar />
      <main
        className="min-w-0 pb-24"
        data-wk-desktop-content-offset={reserveHeaderSpace ? "text-first" : "hero-or-owned"}
        style={{
          paddingTop: reserveHeaderSpace
            ? "calc(56px + env(safe-area-inset-top))"
            : undefined,
        }}
      >
        {children}
      </main>
    </div>
  );
}
