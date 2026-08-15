import {
  useEffect,
} from "react";
import {
  Outlet,
  useLocation,
} from "react-router-dom";
import {
  PlayerDock,
} from "@/components/design-system/music/PlayerDock";
import {
  MusicDesktopShell,
} from "@/components/music/MusicDesktopShell";
import {
  usePlayer,
} from "@/context/PlayerContext";
import {
  useAuthUser,
} from "@/hooks/useAuthUser";
import {
  usePendingCommunityActionReplay,
} from "@/hooks/usePendingCommunityActionReplay";
import DesktopPlayerPage from "@/pages/player/page";

function isShelllessDesktopPath(
  pathname: string,
): boolean {
  return (
    pathname === "/auth" ||
    pathname.startsWith("/preview/") ||
    pathname.includes(
      "/lyrics/contribute",
    )
  );
}

export function AppLayout() {
  const {
    isFullPlayerOpen,
  } = usePlayer();

  const location =
    useLocation();

  const authUser =
    useAuthUser();

  const shellless =
    isShelllessDesktopPath(
      location.pathname,
    );

  usePendingCommunityActionReplay(
    !authUser.loading
      ? authUser.id
      : undefined,
    !authUser.loading &&
      authUser.isEmailVerified,
  );

  useEffect(
    () => {
      if (!isFullPlayerOpen) {
        return;
      }

      const previousBodyOverflow =
        document.body.style.overflow;

      const previousHtmlOverflow =
        document.documentElement.style
          .overflow;

      const previousOverscrollBehavior =
        document.body.style
          .overscrollBehavior;

      document.body.style.overflow =
        "hidden";

      document.documentElement.style
        .overflow = "hidden";

      document.body.style
        .overscrollBehavior =
        "none";

      return () => {
        document.body.style.overflow =
          previousBodyOverflow;

        document.documentElement.style
          .overflow =
          previousHtmlOverflow;

        document.body.style
          .overscrollBehavior =
          previousOverscrollBehavior;
      };
    },
    [isFullPlayerOpen],
  );

  return (
    <div
      className={`wk-app-shell flex flex-col ${
        isFullPlayerOpen
          ? "h-screen overflow-hidden"
          : "min-h-screen"
      }`}
    >
      <main
        className={
          isFullPlayerOpen
            ? "hidden"
            : "flex-1"
        }
      >
        {shellless ? (
          <Outlet />
        ) : (
          <MusicDesktopShell>
            <Outlet />
          </MusicDesktopShell>
        )}
      </main>

      {!isFullPlayerOpen &&
        !shellless && (
          <PlayerDock />
        )}

      {isFullPlayerOpen && (
        <div
          role="dialog"
          aria-label="Now playing"
          className="fixed inset-0 z-[90] h-screen overflow-hidden bg-[var(--wk-bg)]"
        >
          <DesktopPlayerPage />
        </div>
      )}
    </div>
  );
}
