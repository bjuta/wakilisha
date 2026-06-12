import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { AdminAccessGate } from "@/components/auth/AdminAccessGate";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { WkIcon } from "@/components/design-system/Icon";
import type { WkIconName } from "@/components/design-system/Icon";
import { SETTINGS_DOMAINS } from "@/services/adminSettings/settingsTypes";

interface NavItem { path: string; label: string; icon: WkIconName; }

const ALL_DOMAINS: NavItem[] = SETTINGS_DOMAINS.map((d) => ({ path: d.route, label: d.label, icon: d.icon as WkIconName }));

const PRIMARY_TABS: NavItem[] = [
  { path: "/admin/settings", label: "Hub", icon: "LayoutDashboard" },
  ...ALL_DOMAINS.filter((d) =>
    ["site-identity", "chart-defaults", "design-system", "integrations", "frontend-appearance", "registry"].some((slug) => d.path.endsWith(slug))
  ),
];

const MORE_ITEMS: NavItem[] = ALL_DOMAINS.filter(
  (d) => !PRIMARY_TABS.some((pt) => pt.path === d.path)
);

function SettingsLayoutInner() {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const currentPath = location.pathname;

  useEffect(() => { setMobileOpen(false); }, [currentPath]);
  useEffect(() => { if (mobileOpen) document.body.style.overflow = "hidden"; else document.body.style.overflow = ""; return () => { document.body.style.overflow = ""; }; }, [mobileOpen]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    if (moreOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [moreOpen]);

  const isActive = (path: string) => {
    if (path === "/admin/settings") return currentPath === "/admin/settings";
    return currentPath === path || currentPath.startsWith(`${path}/`);
  };
  const activeMoreItem = MORE_ITEMS.find((i) => isActive(i.path));
  const getPageTitle = () => {
    if (isActive("/admin/settings")) return "Settings Hub";
    return ALL_DOMAINS.find((i) => isActive(i.path))?.label || "Settings";
  };

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
            <span className="font-semibold text-[var(--wk-text-soft)]">Settings</span>
            {!isActive("/admin/settings") && (
              <>
                <WkIcon name="ChevronRight" size={12} />
                <span className="text-[var(--wk-text-soft)]">{getPageTitle()}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/admin")} className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text-soft)] transition-all whitespace-nowrap">
            <WkIcon name="ArrowLeft" size={14} />
            <span className="hidden sm:inline">Back</span>
          </button>
        </div>
      </header>

      {/* Horizontal tab bar */}
      <nav className="flex shrink-0 items-center gap-1 border-b border-[var(--wk-border)] bg-[var(--wk-surface)]/60 px-4 py-1.5 md:px-6">
        {PRIMARY_TABS.map((item) => (
          <TabLink key={item.path} item={item} />
        ))}

        {/* More dropdown */}
        {MORE_ITEMS.length > 0 && (
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
        )}

        <div className="ml-auto">
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
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"><WkIcon name="Settings" size={16} /></div>
              <div><h1 className="truncate text-[13px] font-black tracking-tight text-[var(--wk-text)]">WAKILISHA</h1><p className="truncate text-[10px] text-[var(--wk-text-muted)]">Settings</p></div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {[{ path: "/admin/settings", label: "Settings Hub", icon: "LayoutDashboard" as WkIconName }, ...ALL_DOMAINS].map((item) => (
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

export function AdminSettingsLayout() {
  return <AdminAccessGate requiredCapability="view_settings" label="Settings"><SettingsLayoutInner /></AdminAccessGate>;
}