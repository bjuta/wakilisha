import {
  Outlet,
  useLocation,
} from "react-router-dom";
import {
  PlayerCompactSurface,
} from "@/components/design-system/player/PlayerCompactSurface";
import {
  MusicDesktopShell,
} from "@/components/music/MusicDesktopShell";
import {
  useAuthUser,
} from "@/hooks/useAuthUser";
import {
  usePendingCommunityActionReplay,
} from "@/hooks/usePendingCommunityActionReplay";

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

  return (
    <div className="wk-app-shell flex min-h-screen flex-col">
      <main className="flex-1">
        {shellless ? (
          <Outlet />
        ) : (
          <MusicDesktopShell>
            <Outlet />
          </MusicDesktopShell>
        )}
      </main>

      {!shellless ? (
        <PlayerCompactSurface
          mode="desktop"
        />
      ) : null}
    </div>
  );
}
