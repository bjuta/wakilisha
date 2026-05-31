import { useEffect, useState } from "react";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface AdminChartsLayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { path: "/admin/charts/dashboard", label: "Dashboard", icon: "ri-dashboard-line" },
  { path: "/admin/charts/families", label: "Families", icon: "ri-folder-chart-line" },
  { path: "/admin/charts/ingest", label: "Ingest Jobs", icon: "ri-database-2-line" },
  { path: "/admin/charts/editions", label: "Editions", icon: "ri-stack-line" },
  { path: "/admin/charts/snapshots", label: "Snapshots", icon: "ri-camera-lens-line" },
  { path: "/admin/charts/integration-map", label: "Integration Map", icon: "ri-map-pin-line" },
];

export function AdminChartsLayout({ children }: AdminChartsLayoutProps) {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const currentPath = location.pathname;

  useEffect(() => {
    setMobileNavOpen(false);
  }, [currentPath]);

  return (
    <div className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
      {/* Header */}
      <header className="sticky top-0 z-[var(--wk-z-nav)] border-b border-[var(--wk-border)] bg-[var(--wk-surface)]/95 backdrop-blur">
        <div className="wk-container-max flex items-center justify-between gap-4 px-6 py-3">
          <div className="min-w-0 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
              <i className="ri-bar-chart-grouped-line text-sm font-bold" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-[13px] font-black tracking-tight text-[var(--wk-text)]">
                Chart Ingestion Studio
              </h1>
              <p className="truncate text-[11px] text-[var(--wk-text-muted)]">
                Cultural data command center
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 md:flex">
              {NAV_ITEMS.map((item) => {
                const isActive = currentPath === item.path || currentPath.startsWith(`${item.path}/`);
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold transition-all ${
                      isActive
                        ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                        : "text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <i className={item.icon} />
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
            <div className="hidden h-6 w-px bg-[var(--wk-border)] md:block" />
            <button
              onClick={toggle}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--wk-text-soft)] transition-all hover:bg-[var(--wk-surface-raised)]"
            >
              <i className={theme === "dark" ? "ri-moon-line" : "ri-sun-line"} />
              <span className="hidden sm:inline">{theme === "dark" ? "Dark" : "Light"}</span>
            </button>
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] md:hidden"
            >
              <i className={mobileNavOpen ? "ri-close-line" : "ri-menu-line"} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      {mobileNavOpen && (
        <div className="border-b border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 md:hidden">
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = currentPath === item.path || currentPath.startsWith(`${item.path}/`);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all ${
                    isActive
                      ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                      : "text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
                  }`}
                >
                  <i className={item.icon} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="wk-container-max px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}