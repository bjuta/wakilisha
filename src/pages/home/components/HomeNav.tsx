import { useState } from "react";
import { Link } from "react-router-dom";
import { WkButton } from "@/components/design-system/primitives/Button";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";

interface HomeNavProps {
  theme: string;
  onToggleTheme: () => void;
}

const NAV_LINKS = [
  { label: "Charts", to: "/charts" },
  { label: "Artists", to: "/artists" },
  { label: "Releases", to: "/releases" },
  { label: "Genres", to: "/genres" },
  { label: "Labels", to: "/labels" },
  { label: "Magazine", to: "/magazine" },
];

export function HomeNav({ theme, onToggleTheme }: HomeNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

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
            onClick={onToggleTheme}
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
  );
}