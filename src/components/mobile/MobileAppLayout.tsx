import { useState, useRef, useEffect } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";

const PRIMARY_NAV = [
  { label: "Home", to: "/", icon: "ri-home-5-line", iconActive: "ri-home-5-fill" },
  { label: "Charts", to: "/charts", icon: "ri-bar-chart-line", iconActive: "ri-bar-chart-fill" },
  { label: "Artists", to: "/artists", icon: "ri-user-voice-line", iconActive: "ri-user-voice-fill" },
  { label: "Search", to: "/search", icon: "ri-search-line", iconActive: "ri-search-fill" },
];

function MobileMiniPlayer() {
  const { currentTrack, isPlaying, togglePlay, next, openFullPlayer, progress } = usePlayer();
  const location = useLocation();

  if (!currentTrack) return null;
  if (location.pathname === "/player" || location.pathname === "/auth") return null;
  const isPlayable = currentTrack.isPlayable !== false;

  return (
    <div className="phn-miniplayer">
      <div className="phn-mp-progress"><span style={{ transform: `scaleX(${progress})` }} /></div>
      <Link to="/player" onClick={() => openFullPlayer()} className="phn-mp-art">
        {currentTrack.artworkUrl ? <img src={currentTrack.artworkUrl} alt={currentTrack.title} /> : <i className="ri-music-2-line" />}
      </Link>
      <div className="phn-mp-info">
        <div className="phn-mp-title">{currentTrack.title}</div>
        <div className="phn-mp-sub">{currentTrack.artist}{currentTrack.source ? ` · ${currentTrack.source}` : ""}</div>
      </div>
      <button onClick={togglePlay} disabled={!isPlayable} className="phn-mp-btn phn-mp-play"><i className={isPlaying ? "ri-pause-fill" : "ri-play-fill"} /></button>
      <button onClick={next} className="phn-mp-btn"><i className="ri-skip-forward-line" /></button>
    </div>
  );
}

function MoreMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const dragYRef = useRef(0);
  const { theme, toggle } = useTheme();
  const location = useLocation();

  const open = () => {
    setExiting(false);
    setDragY(0);
    dragYRef.current = 0;
    setIsOpen(true);
  };

  const close = () => {
    setExiting(true);
    setTimeout(() => {
      setIsOpen(false);
      setExiting(false);
      setDragY(0);
      dragYRef.current = 0;
    }, 300);
  };

  const onDragStart = (y: number) => {
    startYRef.current = y;
    dragYRef.current = 0;
    setIsDragging(true);
  };

  const onDragMove = (y: number) => {
    const delta = y - startYRef.current;
    if (delta > 0) {
      dragYRef.current = delta;
      setDragY(delta);
    } else {
      dragYRef.current = 0;
      setDragY(0);
    }
  };

  const onDragEnd = () => {
    setIsDragging(false);
    if (dragYRef.current > 120) {
      close();
    } else {
      setDragY(0);
      dragYRef.current = 0;
    }
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleTouchMove = (e: TouchEvent) => {
      onDragMove(e.touches[0].clientY);
    };
    const handleTouchEnd = () => {
      onDragEnd();
    };
    const handleMouseMove = (e: MouseEvent) => {
      onDragMove(e.clientY);
    };
    const handleMouseUp = () => {
      onDragEnd();
    };
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("touchcancel", handleTouchEnd);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  if (location.pathname === "/player" || location.pathname === "/auth") return null;

  const backdropOpacity = isDragging ? Math.max(0, 0.5 - dragY / 400) : exiting ? 0 : 0.5;
  const sheetTransform = isDragging ? `translateY(${dragY}px)` : exiting ? "translateY(100%)" : "translateY(0)";

  return (
    <>
      <button
        onClick={open}
        className="phn-nav-more"
        aria-label="More"
      >
        <i className="ri-more-fill" />
        <span className="pnl">More</span>
      </button>

      {isOpen && (
        <>
          <div
            className={`phn-more-backdrop ${exiting ? "exiting" : ""}`}
            style={{ opacity: backdropOpacity }}
            onClick={close}
          />
          <div
            className={`phn-more-sheet ${isDragging ? "dragging" : ""} ${exiting ? "exiting" : ""}`}
            style={{ transform: sheetTransform }}
          >
            <div
              className="phn-more-drag-zone"
              onTouchStart={(e) => onDragStart(e.touches[0].clientY)}
              onMouseDown={(e) => onDragStart(e.clientY)}
            >
              <div className="phn-more-handle" />
              <div className="phn-more-title">More</div>
            </div>

            <Link to="/profile" className="phn-more-row" onClick={close}>
              <div className="phn-more-row-avatar">JB</div>
              <div className="phn-more-row-label">Your profile</div>
              <i className="ri-arrow-right-s-line phn-more-row-icon" />
            </Link>

            <button
              onClick={() => {
                toggle();
              }}
              className="phn-more-row"
            >
              <i className={theme === "dark" ? "ri-moon-line" : "ri-sun-line"} />
              <div className="phn-more-row-label">Dark mode</div>
              <div className="phn-more-toggle">{theme === "dark" ? "On" : "Off"}</div>
            </button>

            <Link to="/auth" className="phn-more-row" onClick={close}>
              <i className="ri-login-circle-line" />
              <div className="phn-more-row-label">Sign in</div>
              <i className="ri-arrow-right-s-line phn-more-row-icon" />
            </Link>

            <div className="phn-more-footer">
              <span className="phn-more-footer-text">WAKILISHA v5</span>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function MobileBottomNav() {
  const location = useLocation();
  const isActive = (path: string) => path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
  if (location.pathname === "/player" || location.pathname === "/auth") return null;

  return (
    <nav className="phn-nav">
      {PRIMARY_NAV.map((item) => {
        const active = isActive(item.to);
        return (
          <Link key={item.to} to={item.to} className={`phn-nav-tab ${active ? "on" : ""}`}>
            <i className={active ? item.iconActive : item.icon} />
            <span className="pnl">{item.label}</span>
          </Link>
        );
      })}
      <MoreMenu />
    </nav>
  );
}

export function MobileAppLayout() {
  const location = useLocation();
  const { currentTrack } = usePlayer();
  const showMiniPlayer = !!currentTrack && location.pathname !== "/player" && location.pathname !== "/auth";
  const bottomPadding = showMiniPlayer ? 128 : 72;

  return (
    <div className="wk-app-shell min-h-screen flex flex-col">
      <main className="flex-1 overflow-y-auto overflow-x-hidden" style={{ paddingBottom: bottomPadding }}>
        <Outlet />
      </main>
      <MobileMiniPlayer />
      <MobileBottomNav />
    </div>
  );
}