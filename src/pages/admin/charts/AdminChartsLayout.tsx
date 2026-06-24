import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { AdminAccessGate } from "@/components/auth/AdminAccessGate";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { WkIcon } from "@/components/design-system/Icon";
import type { WkIconName } from "@/components/design-system/Icon";
import type { Capability } from "@/services/userRoles";

interface NavItem { path: string; label: string; icon: WkIconName; badge?: number; requiredCapability?: Capability; }

const PRIMARY_TABS: NavItem[] = [
  { path: "/admin/charts/dashboard", label: "Dashboard", icon: "LayoutDashboard", requiredCapability: "view_charts_admin" },
  { path: "/admin/charts/ingest", label: "Ingest Studio", icon: "Database", requiredCapability: "manage_ingest" },
  { path: "/admin/charts/ingest-runs", label: "Ingest Runs", icon: "ListChecks", requiredCapability: "view_charts_admin" },
  { path: "/admin/charts/backfill", label: "Backfill", icon: "CalendarRange", requiredCapability: "manage_ingest" },
  { path: "/admin/charts/editions", label: "Editions", icon: "Layers", requiredCapability: "manage_charts" },
  { path: "/admin/charts/scoring-runs", label: "Scoring", icon: "Rocket", requiredCapability: "view_charts_admin" },
  { path: "/admin/charts/review-queue", label: "Review", icon: "GitPullRequest", requiredCapability: "view_review_queue" },
];

const MORE_ITEMS: NavItem[] = [
  { path: "/admin/charts/families", label: "Chart Families", icon: "FolderTree", requiredCapability: "manage_charts" },
  { path: "/admin/charts/snapshots", label: "Snapshots", icon: "Camera", requiredCapability: "view_charts_admin" },
  { path: "/admin/charts/no-match", label: "No-match", icon: "XCircle", requiredCapability: "view_charts_admin" },
  { path: "/admin/charts/canon-gaps", label: "Canon Gaps", icon: "AlertCircle", requiredCapability: "view_charts_admin" },
  { path: "/admin/charts/integration-map", label: "Integration Map", icon: "Map", requiredCapability: "view_charts_admin" },
  { path: "/admin/charts/public-api-qa", label: "Public API QA", icon: "FlaskConical", requiredCapability: "view_charts_admin" },
  { path: "/admin/charts/ingest-health", label: "API Health", icon: "HeartPulse", requiredCapability: "view_charts_admin" },
];

const ALL_ITEMS = [...PRIMARY_TABS, ...MORE_ITEMS];

function ChartsLayoutInner() {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const currentPath = location.pathname;

  useEffect(() => { setMobileOpen(false); }, [currentPath]);
  useEffect(() => { if (mobileOpen) document.body.style.overflow = "hidden"; else document.body.style.overflow = ""; return () => { document.body.style.overflow = ""; }; }, [mobileOpen]);

  // Close "More" dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    if (moreOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [moreOpen]);

  const isActive = (path: string) => currentPath === path || currentPath.startsWith(`${path}/`);
  const activeMoreItem = MORE_ITEMS.find((i) => isActive(i.path));
  const getPageTitle = () => ALL_ITEMS.find((i) => isActive(i.path))?.label || "Charts Admin";

  const TabLink = ({ item, compact }: { item: NavItem; compact?: boolean }) => {
    const active = isActive(item.path);
    return (
      <button
        onClick={() => { navigate(item.path); setMoreOpen(false); setMobileOpen(false); }}
        className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-semibold transition-all cursor-pointer ${active ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text-soft)]"} ${compact ? "w-full justify-start" : ""}`}
      >
        <span className="flex h-4 w-4 items-center justify-center shrink-0"><WkIcon name={item.icon} size={14} /></span>
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--wk-bg)] text-[var(--wk-text)]">
      {/* Top header bar */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--wk-border)] bg-[var(--wk-surface)]/95 px-4 backdrop-blur md:px-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] md:hidden">
            <WkIcon name="Menu" size={18} />
          </button>
          <div className="flex items-center gap-2 text-[13px] text-[var(--wk-text-muted)]">
            <span className="font-semibold text-[var(--wk-brand)]">Admin</span>
            <WkIcon name="ChevronRight" size={12} />
            <span className="text-[var(--wk-text-soft)]">{getPageTitle()}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/admin")} className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text-soft)] transition-all whitespace-nowrap">
            <WkIcon name="ArrowLeft" size={14} />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="hidden h-6 w-px bg-[var(--wk-border)] md:block" />
          <button onClick={() => navigate("/admin/charts/ingest")} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
            <WkIcon name="Plus" size={14} />
            <span className="hidden sm:inline">New Ingest</span>
          </button>
        </div>
      </header>

      {/* Horizontal tab bar */}
      <nav className="flex shrink-0 items-center gap-1 border-b border-[var(--wk-border)] bg-[var(--wk-surface)]/60 px-4 py-1.5 md:px-6">
        {PRIMARY_TABS.map((item) => (
          <TabLink key={item.path} item={item} />
        ))}

        {/* More dropdown */}
        <div className="relative" ref={moreRef}>
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-semibold transition-all cursor-pointer ${activeMoreItem ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text-soft)]"}`}
          >
            {activeMoreItem ? (
              <>
                <span className="flex h-4 w-4 items-center justify-center shrink-0"><WkIcon name={activeMoreItem.icon} size={14} /></span>
                <span>{activeMoreItem.label}</span>
              </>
            ) : (
              "More"
            )}
            <WkIcon name="ChevronDown" size={12} className={`transition-transform ${moreOpen ? "rotate-180" : ""}`} />
          </button>
          {moreOpen && (
            <div className="absolute left-0 top-full z-[var(--wk-z-popover)] mt-1 w-52 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] p-1 shadow-lg">
              {MORE_ITEMS.map((item) => (
                <TabLink key={item.path} item={item} compact />
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => navigate("/admin/settings/chart-defaults")} className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text-soft)] transition-all" title="Chart Settings">
            <WkIcon name="Settings" size={14} />
          </button>
          <button onClick={toggle} className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text-soft)] transition-all" title={theme === "dark" ? "Light mode" : "Dark mode"}>
            <WkIcon name={theme === "dark" ? "Sun" : "Moon"} size={14} />
          </button>
        </div>
      </nav>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-[var(--wk-z-modal)] bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 z-[var(--wk-z-modal)] flex h-full w-[260px] flex-col border-r border-[var(--wk-border)] bg-[var(--wk-surface)] md:hidden">
            <div className="flex h-14 items-center gap-3 border-b border-[var(--wk-border)] px-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"><WkIcon name="BarChart3" size={16} /></div>
              <div><h1 className="truncate text-[13px] font-black tracking-tight text-[var(--wk-text)]">WAKILISHA</h1><p className="truncate text-[10px] text-[var(--wk-text-muted)]">Charts Admin</p></div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {ALL_ITEMS.map((item) => (
                <button
                  key={item.path}
                  onClick={() => { navigate(item.path); setMobileOpen(false); }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-all ${isActive(item.path) ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text-soft)]"}`}
                >
                  <span className="flex h-5 w-5 items-center justify-center shrink-0"><WkIcon name={item.icon} size={16} /></span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[var(--wk-w-max)] px-4 py-6 md:px-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function AdminChartsLayout() {
  return <AdminAccessGate requiredCapability="view_charts_admin" label="Charts Admin"><ChartsLayoutInner /></AdminAccessGate>;
}