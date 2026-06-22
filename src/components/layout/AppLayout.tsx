import { useEffect } from "react";
import { Link, Outlet } from "react-router-dom";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { usePlayer } from "@/context/PlayerContext";
import { PlayerDock } from "@/components/design-system/music/PlayerDock";
import { AppTopBar } from "./AppTopBar";
import DesktopPlayerPage from "@/pages/player/page";

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

const FOOTER_ABOUT = [
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
  { label: "FAQs", to: "/faqs" },
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
];

export function AppLayout() {
  const { theme } = useTheme();
  const { isFullPlayerOpen } = usePlayer();

  useEffect(() => {
    if (!isFullPlayerOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, [isFullPlayerOpen]);

  return (
    <div className={`wk-app-shell flex flex-col ${isFullPlayerOpen ? "h-screen overflow-hidden" : "min-h-screen"}`}>
      <AppTopBar />
      <main className={`flex-1 ${isFullPlayerOpen ? "overflow-hidden" : ""}`}>
        <Outlet />
      </main>
      {!isFullPlayerOpen && <PlayerDock />}

      {/* Full player overlay — rendered in-place so the page underneath never unmounts */}
      {isFullPlayerOpen && (
        <div className="fixed inset-0 z-[90] h-screen overflow-hidden bg-[var(--wk-bg)]">
          <DesktopPlayerPage />
        </div>
      )}
      {!isFullPlayerOpen && (
        <footer className="border-t border-[var(--wk-border)] bg-[var(--wk-surface-raised)]">
          <div className="wk-container-wide px-6 py-12">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
              {/* Brand */}
              <div className="col-span-2 sm:col-span-1">
                <div className="text-xl font-black tracking-tight text-[var(--wk-text)]">
                  WAKILISHA<span className="text-[var(--wk-brand)]">.</span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--wk-text-muted)]">
                  A home for African creative life. Music first, then stories, artists, and everything that moves the culture forward.
                </p>
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

              {/* About */}
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-text-faint)] mb-4">
                  About
                </h4>
                <nav className="flex flex-col gap-2">
                  {FOOTER_ABOUT.map((link) => (
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
      )}
    </div>
  );
}
