import { useEffect, useState } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { AdminAccessGate } from "@/components/auth/AdminAccessGate";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { WkIcon } from "@/components/design-system/Icon";
import type { WkIconName } from "@/components/design-system/Icon";
import { SETTINGS_DOMAINS } from "@/services/adminSettings/settingsTypes";

interface SettingsNavItem { path: string; label: string; icon: WkIconName; }
const SETTINGS_ITEMS: SettingsNavItem[] = SETTINGS_DOMAINS.map((d) => ({ path: d.route, label: d.label, icon: d.icon as WkIconName }));

function SidebarLink({ item, active, onClick }: { item: SettingsNavItem; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-all ${active ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text-soft)]"}`}><span className="flex h-5 w-5 items-center justify-center shrink-0"><WkIcon name={item.icon} size={16} /></span><span className="whitespace-nowrap">{item.label}</span></button>;
}

function SettingsLayoutInner() {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentPath = location.pathname;
  useEffect(() => { setMobileOpen(false); }, [currentPath]);
  useEffect(() => { if (mobileOpen) document.body.style.overflow = "hidden"; else document.body.style.overflow = ""; return () => { document.body.style.overflow = ""; }; }, [mobileOpen]);
  const isActive = (path: string) => currentPath === path;
  const getPageTitle = () => SETTINGS_ITEMS.find((i) => isActive(i.path))?.label || "Settings";

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-3 border-b border-[var(--wk-border)] px-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"><WkIcon name="Settings" size={16} /></div><div className="min-w-0 overflow-hidden"><h1 className="truncate text-[13px] font-black tracking-tight text-[var(--wk-text)]">WAKILISHA</h1><p className="truncate text-[10px] text-[var(--wk-text-muted)]">Settings</p></div></div>
      <div className="flex-1 overflow-y-auto py-3"><div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">Platform Settings</div><div className="space-y-0.5 px-2"><SidebarLink item={{ path: "/admin/settings", label: "Settings Hub", icon: "LayoutDashboard" }} active={isActive("/admin/settings")} onClick={() => { navigate("/admin/settings"); setMobileOpen(false); }} /></div><div className="mb-2 mt-4 px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">Domains</div><div className="space-y-0.5 px-2">{SETTINGS_ITEMS.map((item) => <SidebarLink key={item.path} item={item} active={isActive(item.path)} onClick={() => { navigate(item.path); setMobileOpen(false); }} />)}</div></div>
      <div className="border-t border-[var(--wk-border)] px-3 py-3"><div className="space-y-1">{[{ label: "Back to Admin", icon: "ArrowLeft" as WkIconName, onClick: () => navigate("/admin") }, { label: theme === "dark" ? "Dark mode" : "Light mode", icon: (theme === "dark" ? "Moon" : "Sun") as WkIconName, onClick: toggle }].map((item) => <button key={item.label} onClick={item.onClick} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text-soft)]"><span className="flex h-5 w-5 items-center justify-center shrink-0"><WkIcon name={item.icon} size={16} /></span><span className="whitespace-nowrap">{item.label}</span></button>)}</div></div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <aside className="hidden shrink-0 flex-col border-r border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all duration-300 ease-[var(--wk-ease-snap)] md:flex w-[260px]">{sidebarContent}</aside>
      {mobileOpen && <><div className="fixed inset-0 z-[var(--wk-z-modal)] bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} /><aside className="fixed left-0 top-0 z-[var(--wk-z-modal)] flex h-full w-[260px] flex-col border-r border-[var(--wk-border)] bg-[var(--wk-surface)] md:hidden">{sidebarContent}</aside></>}
      <div className="flex flex-1 flex-col overflow-hidden"><header className="flex h-14 items-center justify-between gap-4 border-b border-[var(--wk-border)] bg-[var(--wk-surface)]/95 px-4 backdrop-blur md:px-6"><div className="flex items-center gap-3"><button onClick={() => setMobileOpen(!mobileOpen)} className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] md:hidden"><WkIcon name="Menu" size={18} /></button><div className="flex items-center gap-2 text-[13px] text-[var(--wk-text-muted)]"><span className="font-semibold text-[var(--wk-brand)]">Admin</span><WkIcon name="ChevronRight" size={12} /><span className="font-semibold text-[var(--wk-text-soft)]">Settings</span><WkIcon name="ChevronRight" size={12} /><span className="text-[var(--wk-text-soft)]">{getPageTitle()}</span></div></div><div className="flex items-center gap-2"><div className="hidden h-6 w-px bg-[var(--wk-border)] md:block" /><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"><WkIcon name="User" size={14} /></div></div></header><main className="flex-1 overflow-y-auto"><div className="mx-auto w-full max-w-[var(--wk-w-max)] px-4 py-6 md:px-6"><Outlet /></div></main><footer className="border-t border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-4 md:px-6"><div className="flex flex-col items-center justify-between gap-2 sm:flex-row"><div className="flex items-center gap-3"><div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"><WkIcon name="BarChart3" size={12} /></div><div><p className="text-[12px] font-bold text-[var(--wk-text)]">WAKILISHA<span className="text-[var(--wk-brand)]">.</span></p><p className="text-[10px] text-[var(--wk-text-muted)]">Platform settings</p></div></div><nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[12px] text-[var(--wk-text-muted)]">{[{ label: "Dashboard", path: "/admin" }, { label: "Settings", path: "/admin/settings" }, { label: "Charts", path: "/admin/charts" }, { label: "Integrations", path: "/admin/settings/integrations" }, { label: "Public Site", path: "/" }].map((link) => <button key={link.path} onClick={() => navigate(link.path)} className="hover:text-[var(--wk-text)] transition-colors">{link.label}</button>)}</nav><div className="flex items-center gap-2"><span className="text-[10px] text-[var(--wk-text-faint)]">v5</span><span className="inline-flex items-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-text-muted)]">{theme === "dark" ? "Dark" : "Light"}</span></div></div></footer></div>
    </div>
  );
}

export function AdminSettingsLayout() {
  return <AdminAccessGate requiredCapability="view_settings" label="Settings"><SettingsLayoutInner /></AdminAccessGate>;
}
