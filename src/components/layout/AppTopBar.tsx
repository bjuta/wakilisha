import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { WkButton } from "@/components/design-system/primitives/Button";

const NAV_LINKS = [
  { label: "Charts", to: "/charts" },
  { label: "Artists", to: "/artists" },
  { label: "Releases", to: "/releases" },
  { label: "Genres", to: "/genres" },
  { label: "Labels", to: "/labels" },
  { label: "Magazine", to: "/magazine" },
  { label: "Search", to: "/search" },
];

export function AppTopBar() {
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
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
        <>
          <div
            className="fixed inset-0 z-[55] bg-black/40 lg:hidden"
            onClick={closeMobile}
          />
          <div className="absolute top-full left-0 right-0 z-[56] border-b border-[var(--wk-border)] bg-[var(--wk-surface)] px-6 py-4 lg:hidden max-h-[70vh] overflow-y-auto">
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={closeMobile}
                  className="rounded-lg px-3 py-3 text-[14px] font-semibold text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)] active:scale-[0.98] active:opacity-80 transition-all"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to="/admin/design-system"
                onClick={closeMobile}
                className="rounded-lg px-3 py-3 text-[14px] font-semibold text-[var(--wk-brand)] hover:bg-[var(--wk-surface-raised)] active:scale-[0.98] active:opacity-80 transition-all"
              >
                Design system
              </Link>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}