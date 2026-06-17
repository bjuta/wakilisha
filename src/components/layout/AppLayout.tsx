import { Link, Outlet } from "react-router-dom";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { PlayerDock } from "@/components/design-system/music/PlayerDock";
import { AppTopBar } from "./AppTopBar";

const FOOTER_PILLARS = [
  { label: "Music", to: "/charts" },
  { label: "Guides", to: "/guides" },
  { label: "Film", to: "/film" },
  { label: "Fashion", to: "/fashion" },
  { label: "Food", to: "/food" },
  { label: "Language", to: "/language" },
  { label: "Places", to: "/places" },
];

const FOOTER_DISCOVER = [
  { label: "Charts", to: "/charts" },
  { label: "Artists", to: "/artists" },
  { label: "Genres", to: "/genres" },
  { label: "Labels", to: "/labels" },
  { label: "Search", to: "/search" },
];

const FOOTER_READ = [
  { label: "Magazine", to: "/magazine" },
  { label: "Guides", to: "/guides" },
];

export function AppLayout() {
  const { theme } = useTheme();

  return (
    <div className="wk-app-shell min-h-screen flex flex-col">
      <AppTopBar />
      <main className="flex-1">
        <Outlet />
      </main>
      <PlayerDock />
      <footer className="border-t border-[var(--wk-border)] bg-[var(--wk-surface-raised)]">
        <div className="wk-container-wide px-6 py-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="col-span-2 sm:col-span-1">
              <div className="text-xl font-black tracking-tight text-[var(--wk-text)]">
                WAKILISHA<span className="text-[var(--wk-brand)]">.</span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--wk-text-muted)]">
                A home for African creative life. Music first, then stories, artists, places, and everything that moves the culture forward.
              </p>
            </div>

            {/* Verticals */}
            <div>
              <h4 className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-text-faint)] mb-4">
                Verticals
              </h4>
              <nav className="flex flex-col gap-2">
                {FOOTER_PILLARS.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="text-[13px] text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] transition-colors whitespace-nowrap"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Discover */}
            <div>
              <h4 className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-text-faint)] mb-4">
                Discover
              </h4>
              <nav className="flex flex-col gap-2">
                {FOOTER_DISCOVER.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="text-[13px] text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] transition-colors whitespace-nowrap"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Read */}
            <div>
              <h4 className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-text-faint)] mb-4">
                Read
              </h4>
              <nav className="flex flex-col gap-2">
                {FOOTER_READ.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="text-[13px] text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] transition-colors whitespace-nowrap"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>

          <div className="mt-10 border-t border-[var(--wk-divider)] pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-[12px] text-[var(--wk-text-faint)]">
              WAKILISHA — Your people are here.
            </span>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--wk-text-muted)]">
                {theme === "dark" ? "Dark mode" : "Light mode"}
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}