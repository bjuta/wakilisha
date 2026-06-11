import { useEffect, useState } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { AdminAccessGate } from "@/components/auth/AdminAccessGate";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { WkIcon } from "@/components/design-system/Icon";
import type { WkIconName } from "@/components/design-system/Icon";
import type { Capability } from "@/services/userRoles";

interface NavItem { path: string; label: string; icon: WkIconName; badge?: number; requiredCapability?: Capability; }

const CHARTS_GROUP: NavItem[] = [
  { path: "/admin/charts/dashboard", label: "Dashboard", icon: "LayoutDashboard", requiredCapability: "view_charts_admin" },
  { path: "/admin/charts/families", label: "Chart Families", icon: "FolderTree", requiredCapability: "manage_charts" },
  { path: "/admin/charts/ingest", label: "Ingest Studio", icon: "Database", requiredCapability: "manage_ingest" },
  { path: "/admin/charts/ingest-runs", label: "Ingest Runs", icon: "ListChecks", requiredCapability: "view_charts_admin" },
  { path: "/admin/charts/editions", label: "Editions", icon: "Layers", requiredCapability: "manage_charts" },
  { path: "/admin/charts/snapshots", label: "Snapshots", icon: "Camera", requiredCapability: "view_charts_admin" },
];

const OPS_GROUP: NavItem[] = [
  { path: "/admin/charts/scoring-runs", label: "Scoring Runs", icon: "Rocket", requiredCapability: "view_charts_admin" },
  { path: "/admin/charts/review-queue", label: "Review Queue", icon: "GitPullRequest", requiredCapability: "view_review_queue" },
  { path: "/admin/charts/no-match", label: "No-match", icon: "XCircle", requiredCapability: "view_charts_admin" },
  { path: "/admin/charts/release-shells", label: "Release Shells", icon: "FolderPlus", requiredCapability: "view_charts_admin" },
  { path: "/admin/charts/canon-gaps", label: "Canon Gaps", icon: "AlertCircle", requiredCapability: "view_charts_admin" },
];

const SYSTEM_GROUP: NavItem[] = [
  { path: "/admin/charts/ingest-jobs", label: "Legacy Jobs", icon: "History", requiredCapability: "view_charts_admin" },
  { path: "/admin/charts/integration-map", label: "Integration Map", icon: "Map", requiredCapability: "view_charts_admin" },
  { path: "/admin/charts/public-api-qa", label: "Public API QA", icon: "FlaskConical", requiredCapability: "view_charts_admin" },
  { path: "/admin/charts/ingest-health", label: "API Health", icon: "HeartPulse", requiredCapability: "view_charts_admin" },
];

function SidebarLink({ item, active, collapsed, onClick }: { item: NavItem; active: boolean; collapsed: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={collapsed ? item.label : undefined} className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-all ${active ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text-soft)]"}`}>
      <span className="flex h-5 w-5 items-center justify-center shrink-0"><WkIcon name={item.icon} size={16} /></span>
      <span className={`whitespace-nowrap transition-all duration-300 ${collapsed ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100"}`}>{item.label}</span>
      {item.badge && <span className={`ml-auto shrink-0 rounded-full bg-[var(--wk-danger)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--wk-brand-on)] ${collapsed ? "absolute -right-0.5 -top-0.5" : ""}`}>{item.badge}</span>}
    </button>
  );
}

function SectionHeader({ label, collapsed }: { label: string; collapsed: boolean }) {
  return <div className={`mt-4 mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] transition-all ${collapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"}`}>{label}</div>;
}

function ChartsLayoutInner() {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => { if (typeof window === "undefined") return false; return localStorage.getItem("admin-sidebar-collapsed") === "true"; });
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentPath = location.pathname;
  useEffect(() => { setMobileOpen(false); }, [currentPath]);
  useEffect(() => { localStorage.setItem("admin-sidebar-collapsed", String(collapsed)); }, [collapsed]);
  useEffect(() => { if (mobileOpen) document.body.style.overflow = "hidden"; else document.body.style.overflow = ""; return () => { document.body.style.overflow = ""; }; }, [mobileOpen]);
  const isActive = (path: string) => currentPath === path || currentPath.startsWith(`${path}/`);
  const getPageTitle = () => [...CHARTS_GROUP, ...OPS_GROUP, ...SYSTEM_GROUP].find((i) => isActive(i.path))?.label || "Charts Admin";

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-3 border-b border-[var(--wk-border)] px-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"><WkIcon name="BarChart3" size={16} /></div>
        <div className={`min-w-0 overflow-hidden transition-all duration-300 ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}><h1 className="truncate text-[13px] font-black tracking-tight text-[var(--wk-text)]">WAKILISHA</h1><p className="truncate text-[10px] text-[var(--wk-text-muted)]">Charts Admin</p></div>
        <button onClick={() => setCollapsed(!collapsed)} className={`ml-auto flex h-7 w-7 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)] ${collapsed ? "mx-auto" : ""}`} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}><WkIcon name={collapsed ? "ChevronRight" : "ChevronLeft"} size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto py-3">
        <SectionHeader label="Charts" collapsed={collapsed} /><div className="space-y-0.5 px-2">{CHARTS_GROUP.map((item) => <SidebarLink key={item.path} item={item} active={isActive(item.path)} collapsed={collapsed} onClick={() => { navigate(item.path); setMobileOpen(false); }} />)}</div>
        <SectionHeader label="Operations" collapsed={collapsed} /><div className="space-y-0.5 px-2">{OPS_GROUP.map((item) => <SidebarLink key={item.path} item={item} active={isActive(item.path)} collapsed={collapsed} onClick={() => { navigate(item.path); setMobileOpen(false); }} />)}</div>
        <SectionHeader label="System" collapsed={collapsed} /><div className="space-y-0.5 px-2">{SYSTEM_GROUP.map((item) => <SidebarLink key={item.path} item={item} active={isActive(item.path)} collapsed={collapsed} onClick={() => { navigate(item.path); setMobileOpen(false); }} />)}</div>
      </div>
      <div className="border-t border-[var(--wk-border)] px-3 py-3"><div className="space-y-1">{[{ label: "Back to Admin", icon: "ArrowLeft" as WkIconName, onClick: () => navigate("/admin") }, { label: "Chart Settings", icon: "Settings" as WkIconName, onClick: () => navigate("/admin/settings/chart-defaults") }, { label: theme === "dark" ? "Dark mode" : "Light mode", icon: (theme === "dark" ? "Moon" : "Sun") as WkIconName, onClick: toggle }].map((item) => <button key={item.label} onClick={item.onClick} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text-soft)] ${collapsed ? "justify-center" : ""}`} title={collapsed ? item.label : undefined}><span className="flex h-5 w-5 items-center justify-center shrink-0"><WkIcon name={item.icon} size={16} /></span><span className={`whitespace-nowrap transition-all duration-300 ${collapsed ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100"}`}>{item.label}</span></button>)}</div></div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <aside className={`hidden shrink-0 flex-col border-r border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all duration-300 ease-[var(--wk-ease-snap)] md:flex ${collapsed ? "w-[68px]" : "w-[260px]"}`}>{sidebarContent}</aside>
      {mobileOpen && <><div className="fixed inset-0 z-[var(--wk-z-modal)] bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} /><aside className="fixed left-0 top-0 z-[var(--wk-z-modal)] flex h-full w-[260px] flex-col border-r border-[var(--wk-border)] bg-[var(--wk-surface)] md:hidden">{sidebarContent}</aside></>}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between gap-4 border-b border-[var(--wk-border)] bg-[var(--wk-surface)]/95 px-4 backdrop-blur md:px-6"><div className="flex items-center gap-3"><button onClick={() => setMobileOpen(!mobileOpen)} className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] md:hidden"><WkIcon name="Menu" size={18} /></button><div className="flex items-center gap-2 text-[13px] text-[var(--wk-text-muted)]"><span className="font-semibold text-[var(--wk-brand)]">Admin</span><WkIcon name="ChevronRight" size={12} /><span className="text-[var(--wk-text-soft)]">{getPageTitle()}</span></div></div><div className="flex items-center gap-2"><button onClick={() => setCollapsed(!collapsed)} className="hidden h-8 w-8 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] md:flex" title="Toggle sidebar"><WkIcon name={collapsed ? "PanelLeftOpen" : "PanelLeftClose"} size={18} /></button><div className="hidden h-6 w-px bg-[var(--wk-border)] md:block" /><button onClick={() => navigate("/admin/charts/ingest")} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"><WkIcon name="Plus" size={14} /> <span className="hidden sm:inline">New Ingest</span></button></div></header>
        <main className="flex-1 overflow-y-auto"><div className="mx-auto w-full max-w-[var(--wk-w-max)] px-4 py-6 md:px-6"><Outlet /></div></main>
      </div>
    </div>
  );
}

export function AdminChartsLayout() {
  return <AdminAccessGate requiredCapability="view_charts_admin" label="Charts Admin"><ChartsLayoutInner /></AdminAccessGate>;
}
