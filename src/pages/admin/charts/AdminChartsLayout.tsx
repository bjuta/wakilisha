import { useEffect, useState } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";

const PRIMARY_NAV_ITEMS = [
  { path: "/admin/charts/dashboard", label: "Dashboard", icon: "ri-dashboard-line" },
  { path: "/admin/charts/families", label: "Families", icon: "ri-folder-chart-line" },
  { path: "/admin/charts/ingest", label: "Ingest Studio", icon: "ri-database-2-line" },
  { path: "/admin/charts/ingest-runs", label: "Ingest Runs", icon: "ri-list-check" },
  { path: "/admin/charts/editions", label: "Editions", icon: "ri-stack-line" },
  { path: "/admin/charts/snapshots", label: "Snapshots", icon: "ri-camera-lens-line" },
];

const SECONDARY_NAV_ITEMS = [
  { path: "/admin/charts/review-queue", label: "Review Queue", icon: "ri-git-pull-request-line" },
  { path: "/admin/charts/no-match", label: "No-match", icon: "ri-close-circle-line" },
  { path: "/admin/charts/release-shells", label: "Release Shells", icon: "ri-folder-add-line" },
  { path: "/admin/charts/canon-gaps", label: "Canon Gaps", icon: "ri-error-warning-line" },
  { path: "/admin/charts/ingest-jobs", label: "Legacy Jobs", icon: "ri-history-line" },
  { path: "/admin/charts/integration-map", label: "Integration Map", icon: "ri-map-pin-line" },
  { path: "/admin/charts/public-api-qa", label: "Public API QA", icon: "ri-test-tube-line" },
  { path: "/admin/charts/ingest-health", label: "API Health", icon: "ri-heart-pulse-line" },
];

export function AdminChartsLayout() {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const currentPath = location.pathname;

  useEffect(() => {
    setMobileNavOpen(false);
  }, [currentPath]);

  const isActive = (path: string) =>
    currentPath === path || currentPath.startsWith(`${path}/`);

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
            <nav className="hidden items-center gap-1 lg:flex">
              {PRIMARY_NAV_ITEMS.map((item) => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold transition-all ${
                      active
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
            <div className="hidden h-6 w-px bg-[var(--wk-border)] lg:block" />
            <nav className="hidden items-center gap-1 xl:flex">
              {SECONDARY_NAV_ITEMS.map((item) => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold transition-all ${
                      active
                        ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                        : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
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
            <div className="hidden h-6 w-px bg-[var(--wk-border)] xl:block" />
            <button
              onClick={toggle}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--wk-text-soft)] transition-all hover:bg-[var(--wk-surface-raised)]"
            >
              <i className={theme === "dark" ? "ri-moon-line" : "ri-sun-line"} />
              <span className="hidden sm:inline">{theme === "dark" ? "Dark" : "Light"}</span>
            </button>
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] lg:hidden"
            >
              <i className={mobileNavOpen ? "ri-close-line" : "ri-menu-line"} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      {mobileNavOpen && (
        <div className="border-b border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 lg:hidden">
          <div className="space-y-1">
            <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">
              Primary
            </p>
            {PRIMARY_NAV_ITEMS.map((item) => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all ${
                    active
                      ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                      : "text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
                  }`}
                >
                  <i className={item.icon} />
                  {item.label}
                </button>
              );
            })}
            <p className="mt-3 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">
              Operations
            </p>
            {SECONDARY_NAV_ITEMS.map((item) => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all ${
                    active
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

      {/* Main content — renders the matched child route via Outlet */}
      <main className="wk-container-max px-4 py-6 md:px-6">
        <Outlet />
      </main>
    </div>
  );
}