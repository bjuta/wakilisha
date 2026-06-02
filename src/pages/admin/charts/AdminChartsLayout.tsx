import { useEffect, useState } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";

/* ────────────────────────── Nav Groups ────────────────────────── */

interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge?: number;
}

const CHARTS_GROUP: NavItem[] = [
  { path: "/admin/charts/dashboard", label: "Dashboard", icon: "ri-dashboard-3-line" },
  { path: "/admin/charts/families", label: "Chart Families", icon: "ri-folder-chart-line" },
  { path: "/admin/charts/ingest", label: "Ingest Studio", icon: "ri-database-2-line" },
  { path: "/admin/charts/ingest-runs", label: "Ingest Runs", icon: "ri-list-check" },
  { path: "/admin/charts/editions", label: "Editions", icon: "ri-stack-line" },
  { path: "/admin/charts/snapshots", label: "Snapshots", icon: "ri-camera-lens-line" },
];

const OPS_GROUP: NavItem[] = [
  { path: "/admin/charts/review-queue", label: "Review Queue", icon: "ri-git-pull-request-line" },
  { path: "/admin/charts/no-match", label: "No-match", icon: "ri-close-circle-line" },
  { path: "/admin/charts/release-shells", label: "Release Shells", icon: "ri-folder-add-line" },
  { path: "/admin/charts/canon-gaps", label: "Canon Gaps", icon: "ri-error-warning-line" },
];

const SYSTEM_GROUP: NavItem[] = [
  { path: "/admin/charts/ingest-jobs", label: "Legacy Jobs", icon: "ri-history-line" },
  { path: "/admin/charts/integration-map", label: "Integration Map", icon: "ri-map-pin-line" },
  { path: "/admin/charts/public-api-qa", label: "Public API QA", icon: "ri-test-tube-line" },
  { path: "/admin/charts/ingest-health", label: "API Health", icon: "ri-heart-pulse-line" },
];

/* ────────────────────────── Sidebar Link ────────────────────────── */

function SidebarLink({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-all ${
        active
          ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
          : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text-soft)]"
      }`}
    >
      <span className="flex h-5 w-5 items-center justify-center text-[15px] shrink-0">
        <i className={item.icon} />
      </span>
      <span
        className={`whitespace-nowrap transition-all duration-300 ${
          collapsed ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100"
        }`}
      >
        {item.label}
      </span>
      {item.badge && (
        <span
          className={`ml-auto shrink-0 rounded-full bg-[var(--wk-danger)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--wk-brand-on)] ${
            collapsed ? "absolute -right-0.5 -top-0.5" : ""
          }`}
        >
          {item.badge}
        </span>
      )}
    </button>
  );
}

/* ────────────────────────── Section Header ────────────────────────── */

function SectionHeader({
  label,
  collapsed,
}: {
  label: string;
  collapsed: boolean;
}) {
  return (
    <div
      className={`mt-4 mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] transition-all ${
        collapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"
      }`}
    >
      {label}
    </div>
  );
}

/* ────────────────────────── Layout ────────────────────────── */

export function AdminChartsLayout() {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("admin-sidebar-collapsed") === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentPath = location.pathname;

  useEffect(() => {
    setMobileOpen(false);
  }, [currentPath]);

  useEffect(() => {
    localStorage.setItem("admin-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const isActive = (path: string) =>
    currentPath === path || currentPath.startsWith(`${path}/`);

  const getPageTitle = () => {
    const all = [...CHARTS_GROUP, ...OPS_GROUP, ...SYSTEM_GROUP];
    const match = all.find((i) => isActive(i.path));
    return match?.label || "Admin";
  };

  /* ──────── Sidebar Content ──────── */
  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-14 items-center gap-3 border-b border-[var(--wk-border)] px-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
          <i className="ri-bar-chart-grouped-line text-[15px] font-bold" />
        </div>
        <div
          className={`min-w-0 overflow-hidden transition-all duration-300 ${
            collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
          }`}
        >
          <h1 className="truncate text-[13px] font-black tracking-tight text-[var(--wk-text)]">
            WAKILISHA
          </h1>
          <p className="truncate text-[10px] text-[var(--wk-text-muted)]">
            Admin
          </p>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`ml-auto flex h-7 w-7 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)] ${
            collapsed ? "mx-auto" : ""
          }`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <i className={collapsed ? "ri-arrow-right-s-line" : "ri-arrow-left-s-line"} />
        </button>
      </div>

      {/* Nav Groups */}
      <div className="flex-1 overflow-y-auto py-3">
        <SectionHeader label="Charts" collapsed={collapsed} />
        <div className="space-y-0.5 px-2">
          {CHARTS_GROUP.map((item) => (
            <SidebarLink
              key={item.path}
              item={item}
              active={isActive(item.path)}
              collapsed={collapsed}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
            />
          ))}
        </div>

        <SectionHeader label="Operations" collapsed={collapsed} />
        <div className="space-y-0.5 px-2">
          {OPS_GROUP.map((item) => (
            <SidebarLink
              key={item.path}
              item={item}
              active={isActive(item.path)}
              collapsed={collapsed}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
            />
          ))}
        </div>

        <SectionHeader label="System" collapsed={collapsed} />
        <div className="space-y-0.5 px-2">
          {SYSTEM_GROUP.map((item) => (
            <SidebarLink
              key={item.path}
              item={item}
              active={isActive(item.path)}
              collapsed={collapsed}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
            />
          ))}
        </div>
      </div>

      {/* Sidebar Footer */}
      <div className="border-t border-[var(--wk-border)] px-3 py-3">
        <div className="space-y-1">
          <button
            onClick={() => navigate("/")}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text-soft)] ${
              collapsed ? "justify-center" : ""
            }`}
            title={collapsed ? "Back to site" : undefined}
          >
            <span className="flex h-5 w-5 items-center justify-center text-[15px] shrink-0">
              <i className="ri-home-smile-line" />
            </span>
            <span
              className={`whitespace-nowrap transition-all duration-300 ${
                collapsed ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100"
              }`}
            >
              Back to Site
            </span>
          </button>
          <button
            onClick={() => navigate("/admin/design-system")}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text-soft)] ${
              collapsed ? "justify-center" : ""
            }`}
            title={collapsed ? "Design System" : undefined}
          >
            <span className="flex h-5 w-5 items-center justify-center text-[15px] shrink-0">
              <i className="ri-layout-masonry-line" />
            </span>
            <span
              className={`whitespace-nowrap transition-all duration-300 ${
                collapsed ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100"
              }`}
            >
              Design System
            </span>
          </button>
          <button
            onClick={toggle}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text-soft)] ${
              collapsed ? "justify-center" : ""
            }`}
            title={collapsed ? "Toggle theme" : undefined}
          >
            <span className="flex h-5 w-5 items-center justify-center text-[15px] shrink-0">
              <i className={theme === "dark" ? "ri-moon-line" : "ri-sun-line"} />
            </span>
            <span
              className={`whitespace-nowrap transition-all duration-300 ${
                collapsed ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100"
              }`}
            >
              {theme === "dark" ? "Dark mode" : "Light mode"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--wk-bg)] text-[var(--wk-text)]">
      {/* ─────────── Desktop Sidebar ─────────── */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all duration-300 ease-[var(--wk-ease-snap)] md:flex ${
          collapsed ? "w-[68px]" : "w-[260px]"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* ─────────── Mobile Sidebar Overlay ─────────── */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-[var(--wk-z-modal)] bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed left-0 top-0 z-[var(--wk-z-modal)] flex h-full w-[260px] flex-col border-r border-[var(--wk-border)] bg-[var(--wk-surface)] md:hidden">
            {sidebarContent}
          </aside>
        </>
      )}

      {/* ─────────── Main Area ─────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-14 items-center justify-between gap-4 border-b border-[var(--wk-border)] bg-[var(--wk-surface)]/95 px-4 backdrop-blur md:px-6">
          {/* Left: Mobile toggle + Breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] md:hidden"
            >
              <i className="ri-menu-3-line" />
            </button>
            <div className="flex items-center gap-2 text-[13px] text-[var(--wk-text-muted)]">
              <span className="font-semibold text-[var(--wk-brand)]">Admin</span>
              <i className="ri-arrow-right-s-line text-[11px]" />
              <span className="text-[var(--wk-text-soft)]">{getPageTitle()}</span>
            </div>
          </div>

          {/* Right: Collapse toggle (desktop) + Avatar + Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden h-8 w-8 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] md:flex"
              title="Toggle sidebar"
            >
              <i className={collapsed ? "ri-sidebar-unfold-line" : "ri-sidebar-fold-line"} />
            </button>
            <div className="hidden h-6 w-px bg-[var(--wk-border)] md:block" />
            <button
              onClick={() => navigate("/admin/charts/ingest")}
              className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
            >
              <i className="ri-add-line" />
              New Ingest
            </button>
            <div className="hidden h-6 w-px bg-[var(--wk-border)] md:block" />
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
              <i className="ri-user-3-line text-[13px] font-bold" />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[var(--wk-w-max)] px-4 py-6 md:px-6">
            <Outlet />
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-4 md:px-6">
          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
                <i className="ri-bar-chart-grouped-line text-[11px] font-bold" />
              </div>
              <div>
                <p className="text-[12px] font-bold text-[var(--wk-text)]">
                  WAKILISHA
                  <span className="text-[var(--wk-brand)]">.</span>
                </p>
                <p className="text-[10px] text-[var(--wk-text-muted)]">
                  Cultural data command center
                </p>
              </div>
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[12px] text-[var(--wk-text-muted)]">
              <button onClick={() => navigate("/admin/charts/dashboard")} className="hover:text-[var(--wk-text)] transition-colors">Dashboard</button>
              <button onClick={() => navigate("/admin/charts/ingest")} className="hover:text-[var(--wk-text)] transition-colors">Ingest</button>
              <button onClick={() => navigate("/admin/charts/editions")} className="hover:text-[var(--wk-text)] transition-colors">Editions</button>
              <button onClick={() => navigate("/admin/charts/ingest-health")} className="hover:text-[var(--wk-text)] transition-colors">Health</button>
              <button onClick={() => navigate("/admin/design-system")} className="hover:text-[var(--wk-text)] transition-colors">Design System</button>
              <button onClick={() => navigate("/")} className="hover:text-[var(--wk-text)] transition-colors">Public Site</button>
            </nav>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--wk-text-faint)]">
                v5
              </span>
              <span className="inline-flex items-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-text-muted)]">
                {theme === "dark" ? "Dark" : "Light"}
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}