import { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { usePlayer } from "@/context/PlayerContext";

const MOBILE_NAV = [
  { label: "Home", to: "/", icon: "ri-home-5-line", iconActive: "ri-home-5-fill" },
  { label: "Charts", to: "/charts", icon: "ri-bar-chart-line", iconActive: "ri-bar-chart-fill" },
  { label: "Artists", to: "/artists", icon: "ri-user-voice-line", iconActive: "ri-user-voice-fill" },
  { label: "Search", to: "/search", icon: "ri-search-line", iconActive: "ri-search-fill" },
  { label: "Magazine", to: "/magazine", icon: "ri-article-line", iconActive: "ri-article-fill" },
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
];

function MobileMiniPlayer() {
  const { currentTrack, isPlaying, togglePlay, next, openFullPlayer, progress } = usePlayer();
  const location = useLocation();

  if (!currentTrack) return null;
  if (location.pathname === "/player") return null;
  const isPlayable = currentTrack.isPlayable !== false;

  return (
    <div
      className="sticky bottom-0 z-[50] grid items-center gap-3 overflow-hidden border-t border-[var(--wk-brand)] bg-[var(--wk-surface)] px-3 backdrop-blur-md"
      style={{ height: "var(--wk-player-dock-h-mobile)" }}
    >
      {/* Progress bar */}
      <div
        className="absolute top-0 left-0 w-full bg-[var(--wk-divider)]"
        style={{ height: 2, transformOrigin: "left" }}
      >
        <div
          className="absolute top-0 left-0 bg-[var(--wk-brand)]"
          style={{ height: 2, width: "100%", transform: `scaleX(${progress})`, transformOrigin: "left" }}
        />
      </div>

      <div className="flex items-center gap-3" style={{ height: "var(--wk-player-dock-h-mobile)" }}>
        {/* Art */}
        <Link
          to="/player"
          onClick={() => openFullPlayer()}
          className="flex h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]"
        >
          {currentTrack.artworkUrl ? (
            <img src={currentTrack.artworkUrl} alt={currentTrack.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <i className="ri-music-2-line text-[var(--wk-text-faint)]" />
            </div>
          )}
        </Link>

        {/* Info */}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="truncate text-[12.5px] font-bold leading-tight text-[var(--wk-text)]">
            {currentTrack.title}
          </div>
          <div className="flex items-center gap-2">
            <div className="truncate text-[10.5px] font-medium text-[var(--wk-text-muted)]">
              {currentTrack.artist}
            </div>
            {currentTrack.source && (
              <span className="shrink-0 rounded-full bg-[var(--wk-brand-soft)] px-1.5 py-0 text-[9px] font-bold text-[var(--wk-brand)]">
                {currentTrack.source}
              </span>
            )}
          </div>
        </div>

        {/* Play */}
        <button
          onClick={togglePlay}
          disabled={!isPlayable}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wk-text)] text-[var(--wk-bg)] transition-all disabled:opacity-40"
        >
          <i className={isPlaying ? "ri-pause-fill" : "ri-play-fill"} />
        </button>

        {/* Skip */}
        <button
          onClick={next}
          aria-label="Next"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"
        >
          <i className="ri-skip-forward-line" />
        </button>
      </div>
    </div>
  );
}

function MobileBottomNav() {
  const location = useLocation();
  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  if (location.pathname === "/player") return null;

  return (
    <nav className="phn-nav">
      {MOBILE_NAV.map((item) => {
        const active = isActive(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`phn-nav-tab ${active ? "on" : ""}`}
          >
            <i className={active ? item.iconActive : item.icon} />
            <span className="pnl">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function MobileTopNav() {
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  if (location.pathname === "/player") return null;

  return (
    <>
      <header className="sticky top-0 z-[60] border-b border-[var(--wk-border)] bg-[var(--wk-surface)]/95 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Logo */}
          <Link
            to="/"
            className="shrink-0 text-lg font-black tracking-tight text-[var(--wk-text)]"
          >
            WAKILISHA<span className="text-[var(--wk-brand)]">.</span>
          </Link>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            <Link
              to="/search"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)]"
            >
              <i className="ri-search-line" />
            </Link>
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)]"
            >
              <i className={theme === "dark" ? "ri-moon-line" : "ri-sun-line"} />
            </button>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Open menu"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)]"
            >
              <i className={menuOpen ? "ri-close-line" : "ri-menu-line"} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-[55] bg-[var(--wk-bg)]/98 backdrop-blur-md">
          <div className="flex h-full flex-col px-5 pt-16 pb-8">
            <nav className="flex-1 flex flex-col gap-1">
              {FULL_NAV.map((link) => {
                const active = link.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(link.to);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMenuOpen(false)}
                    className={`rounded-xl px-4 py-3.5 text-[15px] font-semibold transition-all ${
                      active
                        ? "bg-[var(--wk-brand)]/10 text-[var(--wk-brand)]"
                        : "text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <Link
                to="/admin/design-system"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-4 py-3.5 text-[15px] font-semibold text-[var(--wk-brand)] hover:bg-[var(--wk-surface-raised)]"
              >
                Design system
              </Link>
            </nav>

            <div className="border-t border-[var(--wk-border)] pt-4">
              <div className="text-[11px] text-[var(--wk-text-faint)]">
                WAKILISHA Cultural Registry v5
              </div>
            </div>
          </div>
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
      {/* Top nav bar — hidden on player page */}
      <MobileTopNav />

      {/* Scrollable content area — no top padding when player is full-screen */}
      <main className={`flex-1 overflow-y-auto overflow-x-hidden mobile-content ${isPlayer ? "" : ""}`}>
        <Outlet />
      </main>

      {/* Mini player — hidden on player page */}
      <MobileMiniPlayer />

      {/* Bottom nav — hidden on player page */}
      <MobileBottomNav />
    </div>
  );
}