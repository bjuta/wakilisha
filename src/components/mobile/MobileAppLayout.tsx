import { Link, useLocation, Outlet } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { useAuthUser } from "@/hooks/useAuthUser";
import { WkIcon } from "@/components/design-system/Icon";
import { Portal } from "@/components/base/Portal";
import { MobileFullPlayer } from "./MobileFullPlayer";
import { NotificationBell } from "@/components/feature/community/NotificationBell";

const PRIMARY_NAV = [
  { label: "Home", to: "/", icon: "Home" },
  { label: "Charts", to: "/charts", icon: "BarChart3", pip: true },
  { label: "Search", to: "/search", icon: "Search" },
  { label: "Artists", to: "/artists", icon: "Mic2" },
];

function MobileMiniPlayer() {
  const { currentTrack, isPlaying, togglePlay, next, openFullPlayer, progress } = usePlayer();
  const location = useLocation();
  const navVisible = useScrollDirection();

  if (!currentTrack) return null;
  if (location.pathname === "/auth") return null;
  const isPlayable = currentTrack.isPlayable !== false;

  return (
    <div
      className="phn-miniplayer"
      style={{
        visibility: navVisible ? "visible" : "hidden",
        opacity: navVisible ? 1 : 0,
        transform: navVisible ? "translateY(0) translateZ(0)" : "translateY(16px) translateZ(0)",
        transition: "opacity 0.28s cubic-bezier(.16,1,.3,1), transform 0.28s cubic-bezier(.16,1,.3,1), visibility 0.28s",
      }}
      onTouchStart={() => openFullPlayer()}
    >
      <div className="phn-mp-progress"><span style={{ transform: `scaleX(${progress})` }} /></div>
      <button onClick={() => openFullPlayer()} className="phn-mp-art">
        {currentTrack.artworkUrl ? <img src={currentTrack.artworkUrl} alt={currentTrack.title} /> : <WkIcon name="Music2" size={18} />}
      </button>
      <div className="phn-mp-info" onClick={() => openFullPlayer()}>
        <div className="phn-mp-title">{currentTrack.title}</div>
        <div className="phn-mp-sub">{currentTrack.artist}{currentTrack.source ? ` · ${currentTrack.source}` : ""}</div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} disabled={!isPlayable} className="phn-mp-btn phn-mp-play" aria-label={isPlaying ? "Pause" : "Play"}>
        <WkIcon name={isPlaying ? "Pause" : "Play"} size={16} />
      </button>
      <button onClick={(e) => { e.stopPropagation(); next(); }} className="phn-mp-btn" aria-label="Next track"><WkIcon name="SkipForward" size={16} /></button>
    </div>
  );
}

function MobileBottomNav() {
  const location = useLocation();
  const authUser = useAuthUser();
  const isLoggedIn = !authUser.loading && authUser.id.length > 0;
  const navVisible = useScrollDirection();
  const isActive = (path: string) => path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  if (location.pathname === "/auth") return null;

  return (
    <nav
      className="phn-nav"
      aria-label="Primary mobile navigation"
      style={{
        visibility: navVisible ? "visible" : "hidden",
        opacity: navVisible ? 1 : 0,
        transform: navVisible ? "translateY(0) translateZ(0)" : "translateY(16px) translateZ(0)",
        transition: "opacity 0.28s cubic-bezier(.16,1,.3,1), transform 0.28s cubic-bezier(.16,1,.3,1), visibility 0.28s",
      }}
    >
      {PRIMARY_NAV.map((item) => {
        const active = isActive(item.to);
        return (
          <Link key={item.to} to={item.to} className={`phn-nav-tab ${active ? "on" : ""} ${item.pip ? "has-pip" : ""}`}>
            <WkIcon name={item.icon as any} size={16} />
            <span className="pnl">{item.label}</span>
          </Link>
        );
      })}
      {isLoggedIn && (
        <NotificationBell
          userId={authUser.id}
          className="phn-nav-tab"
          placement="bottom"
        />
      )}
      <Link
        to={isLoggedIn ? "/profile" : "/auth"}
        className={`phn-nav-tab ${isActive("/profile") ? "on" : ""}`}
      >
        {authUser.avatarUrl ? (
          <img src={authUser.avatarUrl} alt="Profile" className="w-5 h-5 rounded-full object-cover" />
        ) : (
          <WkIcon name="User" size={16} />
        )}
        <span className="pnl">{isLoggedIn ? "Profile" : "Sign In"}</span>
      </Link>
    </nav>
  );
}

export function MobileAppLayout() {
  const location = useLocation();
  const { currentTrack, isFullPlayerOpen } = usePlayer();
  const showMiniPlayer = !!currentTrack && location.pathname !== "/auth";

  useScrollLock(isFullPlayerOpen);

  if (location.pathname === "/auth") {
    return (
      <div className="wk-app-shell min-h-[100dvh] flex flex-col">
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div
      className="wk-app-shell min-h-[100dvh] flex flex-col relative"
      style={{
        paddingBottom: showMiniPlayer
          ? "calc(52px + max(env(safe-area-inset-bottom), 8px) + 12px + 60px + 12px)"
          : "calc(52px + max(env(safe-area-inset-bottom), 8px) + 12px)",
      }}
    >
      <main className="flex-1">
        <Outlet />
      </main>
      {isFullPlayerOpen && (
        <div
          data-scroll-lock="container"
          className="fixed inset-0 z-[90] overflow-y-auto bg-[var(--wk-bg)]"
          style={{ minHeight: "100dvh", animation: "slideUp 0.35s cubic-bezier(.16,1,.3,1)" }}
        >
          <MobileFullPlayer />
        </div>
      )}
      <Portal>
        {showMiniPlayer && <MobileMiniPlayer />}
        <MobileBottomNav />
      </Portal>
    </div>
  );
}