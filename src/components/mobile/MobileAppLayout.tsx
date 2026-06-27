import { useEffect, useRef, useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { useAuthUser } from "@/hooks/useAuthUser";
import { WkIcon } from "@/components/design-system/Icon";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { Portal } from "@/components/base/Portal";
import { MobileFullPlayer } from "./MobileFullPlayer";
import { NotificationBell } from "@/components/feature/community/NotificationBell";
import { usePendingCommunityActionReplay } from "@/hooks/usePendingCommunityActionReplay";
import {
  connectAppleMusicForPlayback,
  getApplePlaybackPrefsSnapshot,
} from "@/services/appleMusicConnection";

const PRIMARY_NAV = [
  { label: "Home", to: "/", icon: "Home" },
  { label: "Charts", to: "/charts", icon: "BarChart3", pip: true },
  { label: "Search", to: "/search", icon: "Search" },
  { label: "Artists", to: "/artists", icon: "Mic2" },
];

function MobileMiniPlayer() {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    next,
    openFullPlayer,
    progress,
    playbackSourceLabel,
    playbackBackend,
    playTrack,
    queue,
  } = usePlayer();
  const location = useLocation();
  const navVisible = useScrollDirection();

  const [appleConnected, setAppleConnected] = useState(() => getApplePlaybackPrefsSnapshot().appleMusicConnected);
  const [appleConnecting, setAppleConnecting] = useState(false);

  useEffect(() => {
    const syncAppleState = () => {
      setAppleConnected(getApplePlaybackPrefsSnapshot().appleMusicConnected);
    };

    syncAppleState();
    window.addEventListener("wk-playback-changed", syncAppleState);
    window.addEventListener("wk-apple-music-connected", syncAppleState);

    return () => {
      window.removeEventListener("wk-playback-changed", syncAppleState);
      window.removeEventListener("wk-apple-music-connected", syncAppleState);
    };
  }, [currentTrack?.id]);

  if (!currentTrack) return null;
  if (location.pathname === "/auth") return null;

  const activeSourceLabel = playbackSourceLabel || currentTrack.source || null;
  const hasAppleCatalog = Boolean(currentTrack.appleMusicCatalogId || currentTrack.appleMusicId);
  const showUnlockFullTrack = hasAppleCatalog && playbackBackend !== "apple" && !appleConnected;
  const isPlayable = currentTrack.isPlayable !== false;

  const handleUnlockFullTrack = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (appleConnecting) return;

    setAppleConnecting(true);

    try {
      await connectAppleMusicForPlayback();
      setAppleConnected(true);

      const nextQueue = queue.length ? queue : [currentTrack];
      playTrack(currentTrack, nextQueue, {
        pageType: "player",
        entityType: "track",
        entitySlug: currentTrack.trackSlug || currentTrack.id,
        sourceSection: "mini_player_full_track_cta",
      });
    } catch (err) {
      console.error("Could not connect Apple Music from mini player", err);
      openFullPlayer();
    } finally {
      setAppleConnecting(false);
    }
  };

  return (
    <div
      className="phn-miniplayer"
      style={{
        visibility: navVisible ? "visible" : "hidden",
        opacity: navVisible ? 1 : 0,
        transform: navVisible ? "translateY(0) translateZ(0)" : "translateY(16px) translateZ(0)",
        transition: "opacity 0.28s cubic-bezier(.16,1,.3,1), transform 0.28s cubic-bezier(.16,1,.3,1), visibility 0.28s",
      }}
    >
      <div className="phn-mp-progress"><span style={{ transform: `scaleX(${progress})` }} /></div>
      <button onClick={() => openFullPlayer()} className="phn-mp-art">
        {currentTrack.artworkUrl ? <img src={currentTrack.artworkUrl} alt={currentTrack.title} /> : <WkIcon name="Music2" size={18} />}
      </button>
      <div className="phn-mp-info" onClick={() => openFullPlayer()}>
        <div className="phn-mp-title">{currentTrack.title}</div>
        <div className="phn-mp-sub">{currentTrack.artist}{activeSourceLabel ? ` · ${activeSourceLabel}` : ""}</div>
      </div>
      {showUnlockFullTrack && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={handleUnlockFullTrack}
          className="phn-mp-unlock"
          aria-label="Connect Apple Music to play the full track"
        >
          <WkIcon name={appleConnecting ? "Loader2" : "Music2"} size={13} />
          <span>{appleConnecting ? "..." : "Full"}</span>
        </button>
      )}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
        disabled={!isPlayable}
        className="phn-mp-btn phn-mp-play"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        <WkIcon name={isPlaying ? "Pause" : "Play"} size={16} />
      </button>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); next(); }}
        className="phn-mp-btn"
        aria-label="Next track"
      >
        <WkIcon name="SkipForward" size={16} />
      </button>
    </div>
  );
}

function MobileBottomNav() {
  const location = useLocation();
  const authUser = useAuthUser();
  const navRef = useRef<HTMLElement | null>(null);
  const { theme, toggle } = useTheme();
  const isLoggedIn = !authUser.loading && authUser.id.length > 0;
  const navVisible = useScrollDirection();
  const isActive = (path: string) => path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  useEffect(() => {
    const activeTab = navRef.current?.querySelector<HTMLElement>(".phn-nav-tab.on");
    activeTab?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [location.pathname, isLoggedIn]);

  if (location.pathname === "/auth") return null;

  return (
    <nav
      ref={navRef}
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
      <button
        type="button"
        onClick={toggle}
        className="phn-nav-tab"
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        <WkIcon name={theme === "dark" ? "Sun" : "Moon"} size={16} />
        <span className="pnl">{theme === "dark" ? "Light" : "Dark"}</span>
      </button>
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
  const authUser = useAuthUser();
  const showMobileChrome = !isFullPlayerOpen && location.pathname !== "/auth";
  const showMiniPlayer = !!currentTrack && showMobileChrome;

  useScrollLock(isFullPlayerOpen);
  usePendingCommunityActionReplay(
    !authUser.loading ? authUser.id : undefined,
    !authUser.loading && authUser.isEmailVerified
  );

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
        paddingBottom: isFullPlayerOpen
          ? "0px"
          : showMiniPlayer
            ? "calc(52px + max(env(safe-area-inset-bottom), 8px) + 12px + 60px + 12px)"
            : "calc(52px + max(env(safe-area-inset-bottom), 8px) + 12px)",
      }}
    >
      <main className="flex-1">
        <Outlet />
      </main>
      {isFullPlayerOpen && (
        <Portal>
          <div
            data-scroll-lock="container"
            className="fixed inset-0 z-[90] h-[100dvh] overflow-y-auto overscroll-contain bg-[var(--wk-bg)]"
            style={{
              height: "100dvh",
              maxHeight: "100dvh",
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-y",
              animation: "slideUp 0.35s cubic-bezier(.16,1,.3,1)",
            }}
          >
            <MobileFullPlayer />
          </div>
        </Portal>
      )}
      {showMobileChrome && (
        <Portal>
          {showMiniPlayer && <MobileMiniPlayer />}
          <MobileBottomNav />
        </Portal>
      )}
    </div>
  );
}
