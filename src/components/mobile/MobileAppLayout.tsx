import { useState, useRef, useEffect } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { useScrollLock } from "@/hooks/useScrollLock";
import { WkIcon } from "@/components/design-system/Icon";
import { MobileFullPlayer } from "./MobileFullPlayer";

const PRIMARY_NAV = [
  { label: "Home", to: "/", icon: "Home" },
  { label: "Charts", to: "/charts", icon: "BarChart3", pip: true },
  { label: "Search", to: "/search", icon: "Search" },
  { label: "Magazine", to: "/magazine", icon: "Newspaper" },
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

function MoreMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const dragYRef = useRef(0);
  const { theme, toggle } = useTheme();
  const location = useLocation();

  useScrollLock(isOpen);

  const open = () => { setExiting(false); setDragY(0); dragYRef.current = 0; setIsOpen(true); };
  const close = () => {
    setExiting(true);
    setTimeout(() => { setIsOpen(false); setExiting(false); setDragY(0); dragYRef.current = 0; }, 300);
  };
  const onDragStart = (y: number) => { startYRef.current = y; dragYRef.current = 0; setIsDragging(true); };
  const onDragMove = (y: number) => {
    const delta = y - startYRef.current;
    if (delta > 0) { dragYRef.current = delta; setDragY(delta); } else { dragYRef.current = 0; setDragY(0); }
  };
  const onDragEnd = () => { setIsDragging(false); if (dragYRef.current > 120) close(); else { setDragY(0); dragYRef.current = 0; } };

  useEffect(() => {
    if (!isDragging) return;
    const handleTouchMove = (e: TouchEvent) => onDragMove(e.touches[0].clientY);
    const handleTouchEnd = () => onDragEnd();
    const handleMouseMove = (e: MouseEvent) => onDragMove(e.clientY);
    const handleMouseUp = () => onDragEnd();
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

  if (location.pathname === "/auth") return null;

  const backdropOpacity = isDragging ? Math.max(0, 0.5 - dragY / 400) : exiting ? 0 : 0.5;
  const sheetTransform = isDragging ? `translateY(${dragY}px)` : exiting ? "translateY(100%)" : "translateY(0)";

  return (
    <>
      <button onClick={open} className="phn-nav-more" aria-label="More">
        <WkIcon name="MoreHorizontal" size={22} />
        <span className="pnl">More</span>
      </button>

      {isOpen && (
        <>
          <div className={`phn-more-backdrop ${exiting ? "exiting" : ""}`} style={{ opacity: backdropOpacity }} onClick={close} />
          <div data-scroll-lock="container" className={`phn-more-sheet ${isDragging ? "dragging" : ""} ${exiting ? "exiting" : ""}`} style={{ transform: sheetTransform }}>
            <div className="phn-more-drag-zone" onTouchStart={(e) => onDragStart(e.touches[0].clientY)} onMouseDown={(e) => onDragStart(e.clientY)}>
              <div className="phn-more-handle" />
              <div className="phn-more-title">More</div>
            </div>

            <Link to="/profile" className="phn-more-row" onClick={close}>
              <div className="phn-more-row-avatar">JB</div>
              <div className="phn-more-row-label">Profile</div>
              <WkIcon name="ArrowRight" size={16} className="phn-more-row-icon" />
            </Link>

            <Link to="/artists" className="phn-more-row" onClick={close}>
              <WkIcon name="Mic2" size={18} />
              <div className="phn-more-row-label">Artists</div>
              <WkIcon name="ArrowRight" size={16} className="phn-more-row-icon" />
            </Link>

            <Link to="/settings" className="phn-more-row" onClick={close}>
              <WkIcon name="Settings" size={18} />
              <div className="phn-more-row-label">Settings</div>
              <WkIcon name="ArrowRight" size={16} className="phn-more-row-icon" />
            </Link>

            <button onClick={toggle} className="phn-more-row">
              <WkIcon name={theme === "dark" ? "Moon" : "Sun"} size={18} />
              <div className="phn-more-row-label">Dark mode</div>
              <div className="phn-more-toggle">{theme === "dark" ? "On" : "Off"}</div>
            </button>

            <Link to="/auth" className="phn-more-row" onClick={close}>
              <WkIcon name="LogIn" size={18} />
              <div className="phn-more-row-label">Sign in</div>
              <WkIcon name="ArrowRight" size={16} className="phn-more-row-icon" />
            </Link>

            <div className="phn-more-footer"><span className="phn-more-footer-text">WAKILISHA v5 · mobile-first</span></div>
          </div>
        </>
      )}
    </>
  );
}

function MobileBottomNav() {
  const location = useLocation();
  const isActive = (path: string) => path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
  if (location.pathname === "/auth") return null;

  return (
    <nav className="phn-nav" aria-label="Primary mobile navigation">
      {PRIMARY_NAV.map((item) => {
        const active = isActive(item.to);
        return (
          <Link key={item.to} to={item.to} className={`phn-nav-tab ${active ? "on" : ""} ${item.pip ? "has-pip" : ""}`}>
            <WkIcon name={item.icon as any} size={22} />
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
  const { currentTrack, isFullPlayerOpen } = usePlayer();
  const showMiniPlayer = !!currentTrack && location.pathname !== "/auth";
  const bottomPadding = showMiniPlayer ? 148 : 88;

  useScrollLock(isFullPlayerOpen);

  return (
    <div className="wk-app-shell min-h-screen flex flex-col">
      <main className="flex-1 overflow-y-auto overflow-x-hidden" style={{ paddingBottom: bottomPadding }}>
        <Outlet />
      </main>
      <MobileMiniPlayer />
      <MobileBottomNav />
      {isFullPlayerOpen && (
        <div
          data-scroll-lock="container"
          className="fixed inset-0 z-[90] overflow-y-auto bg-[var(--wk-bg)]"
          style={{ animation: "slideUp 0.35s cubic-bezier(.16,1,.3,1)" }}
        >
          <MobileFullPlayer />
        </div>
      )}
    </div>
  );
}