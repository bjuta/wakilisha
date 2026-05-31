import { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { WkButton } from "@/components/design-system/primitives/Button";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { PlayerDock } from "@/components/design-system/music/PlayerDock";

const NAV_LINKS = [
  { label: "Charts", to: "/charts" },
  { label: "Artists", to: "/artists" },
  { label: "Releases", to: "/releases" },
  { label: "Genres", to: "/genres" },
  { label: "Labels", to: "/labels" },
  { label: "Magazine", to: "/magazine" },
  { label: "Search", to: "/search" },
];

export function AppLayout() {
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="wk-app-shell min-h-screen flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-[60] border-b border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="wk-container-wide flex items-center justify-between gap-4 px-6 py-3">
          <Link
            to="/"
            className="shrink-0 text-xl font-black tracking-tight text-[var(--wk-text)]"
          >
            WAKILISHA<span className="text-[var(--wk-brand)]">.</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--wk-text-soft)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)] whitespace-nowrap"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)]"
            >
              <i className={theme === "dark" ? "ri-moon-line" : "ri-sun-line"} />
            </button>
            <Link to="/admin/design-system" className="hidden lg:block">
              <WkButton variant="soft">
                <i className="ri-layout-masonry-line" />
                Design system
              </WkButton>
            </Link>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Open menu"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] lg:hidden"
            >
              <i className={mobileOpen ? "ri-close-line" : "ri-menu-line"} />
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-[var(--wk-border)] bg-[var(--wk-surface)] px-6 py-4 lg:hidden">
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-[13px] font-semibold text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to="/admin/design-system"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-[13px] font-semibold text-[var(--wk-brand)] hover:bg-[var(--wk-surface-raised)]"
              >
                Design system
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Player Dock */}
      <PlayerDock />

      {/* Footer */}
      <footer className="border-t border-[var(--wk-border)] bg-[var(--wk-surface-raised)]">
        <div className="wk-container-wide px-6 py-10">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xl font-black tracking-tight text-[var(--wk-text)]">
                WAKILISHA<span className="text-[var(--wk-brand)]">.</span>
              </div>
              <p className="mt-1 text-[13px] text-[var(--wk-text-muted)]">
                African music intelligence. One system. Every surface.
              </p>
            </div>
            <nav className="flex flex-wrap gap-x-8 gap-y-2 text-[13px] text-[var(--wk-text-muted)]">
              <Link to="/charts" className="hover:text-[var(--wk-text)]">Charts</Link>
              <Link to="/artists" className="hover:text-[var(--wk-text)]">Artists</Link>
              <Link to="/releases" className="hover:text-[var(--wk-text)]">Releases</Link>
              <Link to="/genres" className="hover:text-[var(--wk-text)]">Genres</Link>
              <Link to="/labels" className="hover:text-[var(--wk-text)]">Labels</Link>
              <Link to="/magazine" className="hover:text-[var(--wk-text)]">Magazine</Link>
              <Link to="/admin/design-system" className="hover:text-[var(--wk-text)]">Design system</Link>
            </nav>
          </div>
          <div className="mt-8 border-t border-[var(--wk-divider)] pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="text-[12px] text-[var(--wk-text-faint)]">
              WAKILISHA Cultural Registry v5 — Data driven. Community informed.
            </span>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-text-muted)]">
                {theme === "dark" ? "Dark mode" : "Light mode"}
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}