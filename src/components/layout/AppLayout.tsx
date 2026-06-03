import { Link, Outlet } from "react-router-dom";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { PlayerDock } from "@/components/design-system/music/PlayerDock";
import { AppTopBar } from "./AppTopBar";

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
              <Link to="/genres" className="hover:text-[var(--wk-text)]">Genres</Link>
              <Link to="/labels" className="hover:text-[var(--wk-text)]">Labels</Link>
              <Link to="/magazine" className="hover:text-[var(--wk-text)]">Magazine</Link>
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