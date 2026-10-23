import { Outlet, useLocation } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { useAuthUser } from "@/hooks/useAuthUser";
import { usePendingCommunityActionReplay } from "@/hooks/usePendingCommunityActionReplay";
import { MobileTopBar } from "./MobileTopBar";

/**
 * Workbook v4: one start-edge sidebar sheet; no bottom navigation,
 * floating More menu, imitation browser toolbar, or bottom chrome.
 * Only the real compact player reserves a bottom safe area.
 */
export function MobileAppLayout() {
  const location = useLocation();
  const { currentTrack } = usePlayer();
  const authUser = useAuthUser();
  const shellless = location.pathname === "/auth";
  // Full-bleed hero surfaces begin behind the one transparent mobile bar.
  // Text-first routes reserve its height exactly once; social pages already
  // reserve it in their own P6-P8 layout, and open DMs own their thread chrome.
  const heroRoute = location.pathname === "/"
    || ["/magazine", "/music", "/video", "/audio", "/shows", "/charts"].includes(location.pathname)
    || /^\/magazine\/[^/]+\/?$/.test(location.pathname)
    || /^\/artists\/[^/]+\/?$/.test(location.pathname)
    || /^\/video\/[^/]+\/?$/.test(location.pathname)
    || /^\/shows\/[^/]+(?:\/[^/]+)?\/?$/.test(location.pathname)
    || /^\/charts\/[^/]+/.test(location.pathname);
  const socialRoute = ["/following", "/messages", "/notifications"].includes(location.pathname);
  const reserveHeaderSpace = !shellless && !heroRoute && !socialRoute;
  usePendingCommunityActionReplay(
    !authUser.loading ? authUser.id : undefined,
    !authUser.loading && authUser.isEmailVerified,
  );

  return (
    <div
      className="wk-app-shell relative flex min-h-[100dvh] flex-col"
      data-wk-workbook-mobile-shell="v4"
      style={{
        paddingBottom: !shellless && currentTrack
          ? "calc(84px + env(safe-area-inset-bottom))"
          : undefined,
      }}
    >
      {!shellless && <MobileTopBar />}
      <main className="min-w-0 flex-1" data-wk-mobile-content-offset={reserveHeaderSpace ? "text-first" : "hero-or-owned"} style={{ paddingTop: reserveHeaderSpace ? "calc(56px + env(safe-area-inset-top))" : undefined }}>
        <Outlet />
      </main>
    </div>
  );
}
