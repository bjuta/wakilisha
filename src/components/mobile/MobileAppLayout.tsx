import { useState, useRef, useEffect } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useAuthUser } from "@/hooks/useAuthUser";
import { WkIcon } from "@/components/design-system/Icon";
import { MobileFullPlayer } from "./MobileFullPlayer";
import { NotificationBell } from "@/components/feature/community/NotificationBell";

const PRIMARY_NAV = [
  { label: "Home", to: "/", icon: "Home" },
  { label: "Charts", to: "/charts", icon: "BarChart3", pip: true },
  { label: "Search", to: "/search", icon: "Search" },
  { label: "Artists", to: "/artists", icon: "Mic2" },
  { label: "Profile", to: "/profile", icon: "User" },
];

function MobileMiniPlayer() {
  const { currentTrack, isPlaying, togglePlay, next, openFullPlayer, progress } = usePlayer();
  const location = useLocation();

  if (!currentTrack) return null;
  if (location.pathname === "/auth") return null;
  const isPlayable = currentTrack.isPlayable !== false;

  return (
    <div className="phn-miniplayer" onTouchStart={() => openFullPlayer()}>
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
  const { theme, toggle } = useTheme();
  const authUser = useAuthUser();
  const isLoggedIn = !authUser.loading && authUser.id.length > 0;
  const isActive = (path: string) => path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
  if (location.pathname === "/auth") return null;

  return (
    <nav className="phn-nav" style={{ overflow: 'visible' }} aria-label="Primary mobile navigation">
      {PRIMARY_NAV.map((item) => {
        const active = isActive(item.to);
        return (
          <Link key={item.to} to={item.to} className={`phn-nav-tab ${active ? "on" : ""} ${item.pip ? "has-pip" : ""}`}>
            <WkIcon name={item.icon as any} size={18} />
            <span className="pnl">{item.label}</span>
          </Link>
        );
      })}
      {isLoggedIn && (
        <NotificationBell userId={authUser.id} className="phn-nav-tab" />
      )}
      <button
        className="phn-nav-tab phn-nav-theme"
        onClick={toggle}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        <WkIcon name={theme === "dark" ? "Sun" : "Moon"} size={18} />
        <span className="pnl">{theme === "dark" ? "Light" : "Dark"}</span>
      </button>
    </nav>
  );
}

export function MobileAppLayout() {
  const location = useLocation();
  const { currentTrack, isFullPlayerOpen } = usePlayer();
  const showMiniPlayer = !!currentTrack && location.pathname !== "/auth";
  // Base nav height 52px + safe-area (approximated as 34px max for iPhone notch models)
  // With miniplayer: add another 60px (60px player + 4px gap)
  const bottomPadding = showMiniPlayer
    ? "calc(52px + max(env(safe-area-inset-bottom), 6px) + 60px + 16px)"
    : "calc(52px + max(env(safe-area-inset-bottom), 6px) + 8px)";

  useScrollLock(isFullPlayerOpen);

  return (
    <div className="wk-app-shell min-h-screen flex flex-col">
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ paddingBottom: bottomPadding }}
      >
        <Outlet />
      </main>
      <MobileMiniPlayer />
      <MobileBottomNav />
      {isFullPlayerOpen && (
        <div
          data-scroll-lock="container"
          className="fixed inset-0 z-[90] overflow-y-auto bg-[var(--wk-bg)]"
          style={{ minHeight: "100dvh", animation: "slideUp 0.35s cubic-bezier(.16,1,.3,1)" }}
        >
          <MobileFullPlayer />
        </div>
      )}
    </div>
  );
}