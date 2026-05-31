import { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { usePlayer } from "@/context/PlayerContext";

const MOBILE_NAV = [
  { label: "Home", to: "/", icon: "ri-home-5-line", iconActive: "ri-home-5-fill" },
  { label: "Charts", to: "/charts", icon: "ri-bar-chart-line", iconActive: "ri-bar-chart-fill" },
  { label: "Artists", to: "/artists", icon: "ri-user-voice-line", iconActive: "ri-user-voice-fill" },
  { label: "Search", to: "/search", icon: "ri-search-line", iconActive: "ri-search-fill" },
  { label: "Profile", to: "/profile", icon: "ri-user-3-line", iconActive: "ri-user-3-fill" },
];

const FULL_NAV = [
  { label: "Home", to: "/" },
  { label: "Charts", to: "/charts" },
  { label: "Artists", to: "/artists" },
  { label: "Releases", to: "/releases" },
  { label: "Genres", to: "/genres" },
  { label: "Labels", to: "/labels" },
  { label: "Magazine", to: "/magazine" },
  { label: "Search", to: "/search" },
  { label: "Profile", to: "/profile" },
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

function MobileBottomNav() {
  const location = useLocation();
  const isActive = (path: string) => path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
  if (location.pathname === "/player" || location.pathname === "/auth") return null;
  return (
    <nav className="phn-nav">
      {MOBILE_NAV.map((item) => {
        const active = isActive(item.to);
        return <Link key={item.to} to={item.to} className={`phn-nav-tab ${active ? "on" : ""}`}><i className={active ? item.iconActive : item.icon} /><span className="pnl">{item.label}</span></Link>;
      })}
    </nav>
  );
}

function MobileTopNav() {
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  if (location.pathname === "/player" || location.pathname === "/auth") return null;

  return (
    <>
      <header className="phn-topbar">
        <Link to="/" className="phn-logo">WAKILISHA<span>.</span></Link>
        <div className="phn-top-actions">
          <Link to="/search" className="phn-icon-btn"><i className="ri-search-line" /></Link>
          <button onClick={toggle} className="phn-icon-btn"><i className={theme === "dark" ? "ri-moon-line" : "ri-sun-line"} /></button>
          <button onClick={() => setMenuOpen(!menuOpen)} className="phn-icon-btn"><i className={menuOpen ? "ri-close-line" : "ri-menu-line"} /></button>
        </div>
      </header>

      {menuOpen && (
        <div className="phn-menu">
          <nav className="phn-menu-links">
            {FULL_NAV.map((link) => {
              const active = link.to === "/" ? location.pathname === "/" : location.pathname.startsWith(link.to);
              return <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)} className={`phn-menu-link ${active ? "on" : ""}`}>{link.label}</Link>;
            })}
            <Link to="/auth" onClick={() => setMenuOpen(false)} className="phn-menu-link phn-menu-auth">Sign in</Link>
            <Link to="/admin/design-system" onClick={() => setMenuOpen(false)} className="phn-menu-link phn-menu-auth">Design system</Link>
          </nav>
          <div className="phn-menu-foot">WAKILISHA Cultural Registry v5</div>
        </div>
      )}
    </>
  );
}

export function MobileAppLayout() {
  const location = useLocation();
  const isPlayer = location.pathname === "/player";

  return (
    <div className="wk-app-shell min-h-screen flex flex-col">
      <MobileTopNav />
      <main className={`flex-1 overflow-y-auto overflow-x-hidden mobile-content ${isPlayer ? "" : ""}`}>
        <Outlet />
      </main>
      <MobileMiniPlayer />
      <MobileBottomNav />
    </div>
  );
}
