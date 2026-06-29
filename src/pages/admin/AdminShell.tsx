import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { WkIcon } from "@/components/design-system/Icon";
import { AdminCommandPalette } from "@/components/admin/AdminCommandPalette";
import { useAdminBadgeCounts } from "@/hooks/useAdminBadgeCounts";
import { useAdminUser } from "@/hooks/useAdminUser";
import { supabase } from "@/lib/supabase";
import { ROLE_LABELS, roleCanAccessAdmin, type Capability } from "@/services/userRoles";
import type { WkIconName } from "@/components/design-system/Icon";

interface NavItem { path: string; label: string; icon: WkIconName; badgeKey?: string; disabled?: boolean; requiredCapability?: Capability; separatorLabel?: string; }
interface NavGroup { label: string; items: NavItem[]; visible: (can: (capability: Capability) => boolean) => boolean; }

const NAV_GROUPS: NavGroup[] = [
  { label: "Dashboard", visible: (can) => can("view_dashboard"), items: [
    { path: "/admin", label: "Overview", icon: "LayoutDashboard", requiredCapability: "view_dashboard" },
    { path: "/admin/analytics", label: "Analytics", icon: "BarChart3", requiredCapability: "view_dashboard" },
  ] },
  { label: "Community", visible: (can) => can("moderate_community"), items: [
    { path: "/admin/community", label: "Moderation", icon: "MessageSquare", requiredCapability: "moderate_community", badgeKey: "pendingReports" },
  ] },
  { label: "Content & Editorial", visible: (can) => can("edit_own_articles"), items: [
    { path: "/admin/content/articles", label: "Articles", icon: "FileText", requiredCapability: "edit_own_articles" },
    { path: "/admin/content/guides", label: "Guides", icon: "BookOpen", requiredCapability: "edit_guides" },
    { path: "/admin/content/pages", label: "Pages", icon: "Layout", requiredCapability: "edit_pages" },
    { path: "/admin/content/lyrics", label: "Lyrics", icon: "Mic2", requiredCapability: "edit_own_articles" },
    { path: "", label: "", icon: "Minus", separatorLabel: "Magazine" },
    { path: "/admin/content/magazine/featured-artists", label: "Featured Artists", icon: "Star", requiredCapability: "edit_guides" },
    { path: "/admin/content/magazine/featured-guides", label: "Featured Guides", icon: "BookMarked", requiredCapability: "edit_guides" },
    { path: "", label: "", icon: "Minus", separatorLabel: "Organization" },
    { path: "/admin/content/publishing", label: "Publishing", icon: "Globe", requiredCapability: "view_publishing_dashboard" },
    { path: "/admin/content/categories", label: "Categories", icon: "FolderTree", requiredCapability: "manage_categories" },
    { path: "/admin/content/tags", label: "Tags", icon: "Tags", requiredCapability: "manage_tags" },
    { path: "/admin/content/archive", label: "Archive", icon: "Archive", requiredCapability: "view_archive" },
  ] },
  { label: "Music Registry", visible: (can) => can("view_registry"), items: [
    { path: "/admin/registry", label: "Overview", icon: "LayoutDashboard", requiredCapability: "view_registry" },
    { path: "/admin/registry/artists", label: "Artists", icon: "Mic2", requiredCapability: "view_registry" },
    { path: "/admin/registry/artists/intake", label: "Artist Intake", icon: "Upload", requiredCapability: "manage_registry" },
    { path: "/admin/registry/tracks", label: "Tracks", icon: "Music", requiredCapability: "view_registry" },
    { path: "/admin/registry/releases", label: "Releases", icon: "Disc", requiredCapability: "view_registry" },
    { path: "/admin/registry/labels", label: "Labels", icon: "Building2", requiredCapability: "view_registry" },
    { path: "/admin/registry/genres", label: "Genres", icon: "Tags", requiredCapability: "view_registry" },
    { path: "/admin/registry/artist-aliases", label: "Artist Aliases", icon: "Link", requiredCapability: "view_registry" },
    { path: "/admin/registry/authors", label: "Authors", icon: "PenLine", requiredCapability: "view_registry" },
  ] },
  { label: "Institute", visible: (can) => can("view_registry") || can("view_review_queue") || can("view_relationships"), items: [
    { path: "/admin/institute", label: "Inquiry OS", icon: "Network", requiredCapability: "view_registry" },
    { path: "/admin/institute/inquiries", label: "Inquiries", icon: "Network", requiredCapability: "view_registry" },
    { path: "/admin/institute/review", label: "Institute Review", icon: "GitPullRequest", badgeKey: "reviewQueue", requiredCapability: "view_review_queue" },
  ] },
  { label: "Charts Engine", visible: (can) => can("view_charts_admin"), items: [
    { path: "/admin/charts/dashboard", label: "Dashboard", icon: "LayoutDashboard", requiredCapability: "view_charts_admin" },
    { path: "/admin/charts/ingest", label: "Ingest Studio", icon: "Database", requiredCapability: "manage_ingest" },
    { path: "/admin/charts/ingest-runs", label: "Ingest Runs", icon: "ListChecks", requiredCapability: "view_charts_admin" },
    { path: "/admin/charts/editions", label: "Editions", icon: "Layers", requiredCapability: "manage_charts" },
    { path: "/admin/charts/scoring-runs", label: "Scoring Runs", icon: "Rocket", requiredCapability: "view_charts_admin" },
    { path: "/admin/charts/families", label: "Chart Families", icon: "FolderTree", requiredCapability: "manage_charts" },
    { path: "/admin/charts/snapshots", label: "Snapshots", icon: "Camera", requiredCapability: "view_charts_admin" },
    { path: "/admin/charts/ingest-health", label: "Ingest Health", icon: "HeartPulse", requiredCapability: "view_charts_admin" },
  ] },
  { label: "Media", visible: (can) => can("manage_media_library"), items: [
    { path: "/admin/media/library", label: "Media Library", icon: "Image", requiredCapability: "manage_media_library" },
    { path: "/admin/media/missing", label: "Missing Images", icon: "ImageOff", badgeKey: "missingImages", requiredCapability: "view_missing_images" },
    { path: "/admin/media/broken", label: "Broken Links", icon: "LinkBreak", badgeKey: "brokenLinks", requiredCapability: "view_broken_links" },
    { path: "/admin/media/migrate", label: "Migrate Images", icon: "Download", requiredCapability: "manage_media_library" },
  ] },
  { label: "Review & Quality", visible: (can) => can("view_review_queue") || can("view_relationships"), items: [
    { path: "/admin/review/queue", label: "Review Queue", icon: "GitPullRequest", badgeKey: "reviewQueue", requiredCapability: "view_review_queue" },
    { path: "/admin/relationships/viewer", label: "Entity Relationships", icon: "Network", requiredCapability: "view_relationships" },
    { path: "/admin/relationships/duplicates", label: "Duplicate Merge", icon: "Copy", requiredCapability: "manage_relationships" },
  ] },
  { label: "Data Import", visible: (can) => can("view_imports"), items: [
    { path: "/admin/imports", label: "WordPress Import", icon: "Download", requiredCapability: "view_imports" },
    { path: "/admin/imports/jobs", label: "Import Jobs", icon: "Upload", requiredCapability: "view_imports" },
  ] },
  { label: "Settings", visible: (can) => can("view_settings"), items: [
    { path: "/admin/settings", label: "Settings Hub", icon: "Settings", requiredCapability: "view_settings" },
    { path: "/admin/settings/site-identity", label: "Site Identity", icon: "Fingerprint", requiredCapability: "view_settings" },
    { path: "/admin/settings/frontend-appearance", label: "Appearance", icon: "Palette", requiredCapability: "manage_appearance" },
    { path: "/admin/settings/navigation", label: "Navigation", icon: "Compass", requiredCapability: "manage_appearance" },
    { path: "/admin/settings/design-system", label: "Design System", icon: "PanelTop", requiredCapability: "view_settings" },
    { path: "/admin/settings/chart-defaults", label: "Chart Defaults", icon: "BarChart3", requiredCapability: "view_settings" },
    { path: "/admin/settings/airplay", label: "Airplay", icon: "Radio", requiredCapability: "view_settings" },
    { path: "/admin/settings/player-playback", label: "Player & Playback", icon: "Play", requiredCapability: "view_settings" },
    { path: "/admin/settings/registry", label: "Registry Settings", icon: "Database", requiredCapability: "view_settings" },
    { path: "/admin/settings/integrations", label: "Integrations", icon: "Plug", requiredCapability: "manage_integrations" },
    { path: "/admin/settings/gsc-data", label: "GSC Data", icon: "Globe", requiredCapability: "view_settings" },
    { path: "/admin/settings/audience", label: "Audience", icon: "Users", requiredCapability: "view_settings" },
    { path: "/admin/settings/email-briefings", label: "Email & Briefings", icon: "Mail", requiredCapability: "view_settings" },
    { path: "/admin/settings/maintenance", label: "Maintenance", icon: "Wrench", requiredCapability: "view_settings" },
    { path: "/admin/settings/audit", label: "Audit Log", icon: "ClipboardList", requiredCapability: "view_settings" },
  ] },
  { label: "Users", visible: (can) => can("manage_users"), items: [{ path: "/admin/users", label: "Manage Users", icon: "Users", requiredCapability: "manage_users" }] },
  { label: "Developer", visible: () => true, items: [{ path: "/admin/api-docs", label: "API Docs", icon: "BookOpen", requiredCapability: undefined }] },
];

function getNavBadge(key: string, counts: ReturnType<typeof useAdminBadgeCounts>): number | undefined {
  switch (key) {
    case "missingImages": return counts.missingImages > 0 ? counts.missingImages : undefined;
    case "brokenLinks": return counts.brokenLinks > 0 ? counts.brokenLinks : undefined;
    case "reviewQueue": return counts.reviewQueue > 0 ? counts.reviewQueue : undefined;
    case "failedImports": return counts.failedImports > 0 ? counts.failedImports : undefined;
    case "pendingReports": return counts.pendingReports > 0 ? counts.pendingReports : undefined;
    default: return undefined;
  }
}

function SidebarLink({ item, active, collapsed, badge, onClick }: { item: NavItem; active: boolean; collapsed: boolean; badge?: number; onClick: () => void }) {
  return (
    <button onClick={onClick} title={collapsed ? item.label : undefined} disabled={item.disabled} className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-all ${item.disabled ? "cursor-not-allowed opacity-40" : active ? "bg-wk-brand-soft text-wk-brand" : "text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text-soft"}`}>
      <span className="flex h-5 w-5 items-center justify-center shrink-0"><WkIcon name={item.icon} size={16} /></span>
      <span className={`whitespace-nowrap transition-all duration-300 ${collapsed ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100"}`}>{item.label}</span>
      {badge !== undefined && badge > 0 && !collapsed && <span className="ml-auto shrink-0 rounded-full bg-wk-danger px-1.5 py-0.5 text-[10px] font-bold text-wk-brand-on">{badge}</span>}
      {badge !== undefined && badge > 0 && collapsed && <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-wk-danger text-[9px] font-bold text-wk-brand-on">{badge > 99 ? "99+" : badge}</span>}
    </button>
  );
}

function UserProfileDropdown({ user, collapsed }: { user: ReturnType<typeof useAdminUser>; collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); } document.addEventListener("mousedown", handleClick); return () => document.removeEventListener("mousedown", handleClick); }, []);
  const handleSignOut = async () => { await supabase.auth.signOut(); navigate("/admin/login"); };
  const roleLabel = user.role ? ROLE_LABELS[user.role] : null;
  const roleBadgeColors: Record<string, string> = { administrator: "bg-wk-danger/10 text-wk-danger border-wk-danger/20", editor: "bg-wk-brand/10 text-wk-brand border-wk-brand/20", chart_editor_global: "bg-wk-brand/10 text-wk-brand border-wk-brand/20", chart_editor_regional: "bg-wk-brand/10 text-wk-brand border-wk-brand/20", registry_editor: "bg-wk-success/10 text-wk-success border-wk-success/20", media_editor: "bg-wk-success/10 text-wk-success border-wk-success/20", reviewer: "bg-wk-warning/10 text-wk-warning border-wk-warning/20", author: "bg-wk-success/10 text-wk-success border-wk-success/20", writer: "bg-wk-warning/10 text-wk-warning border-wk-warning/20" };
  if (!user.id) return <button onClick={() => navigate("/admin/login")} className="flex w-full items-center gap-3 rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2 text-left hover:border-wk-brand/40"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-wk-brand-soft"><WkIcon name="LogIn" size={16} className="text-wk-brand" /></div>{!collapsed && <div className="min-w-0"><div className="text-[12px] font-bold text-wk-text">Admin sign in</div><div className="text-[10px] text-wk-text-faint">Staff access</div></div>}</button>;
  return <div ref={ref} className="relative"><button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2 text-left hover:border-wk-brand/40"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wk-brand text-[12px] font-black text-wk-brand-on">{user.name?.[0]?.toUpperCase() ?? "U"}</div>{!collapsed && <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-bold text-wk-text">{user.name}</div><div className="truncate text-[10px] text-wk-text-faint">{roleLabel ?? "User"}</div></div>}{!collapsed && <WkIcon name="ChevronUp" size={14} className={`shrink-0 text-wk-text-faint transition-transform ${open ? "rotate-180" : ""}`} />}</button>{open && !collapsed && <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border border-wk-border bg-wk-surface shadow-xl"><div className="border-b border-wk-border p-3"><div className="font-bold text-wk-text text-sm">{user.name}</div><div className="text-xs text-wk-text-muted">{user.email}</div>{user.role && <div className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${roleBadgeColors[user.role] ?? "bg-wk-surface-raised text-wk-text-muted border-wk-border"}`}>{roleLabel}</div>}</div><button onClick={() => { setOpen(false); navigate("/admin/settings"); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"><WkIcon name="Settings" size={14} /> Settings</button><button onClick={handleSignOut} className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-wk-danger hover:bg-wk-danger/10"><WkIcon name="LogOut" size={14} /> Sign out</button></div>}</div>;
}

export function AdminShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme: resolvedTheme, setTheme: setMode } = useTheme();
  const counts = useAdminBadgeCounts();
  const user = useAdminUser();
  const [collapsed, setCollapsed] = useState(() => { if (typeof window === "undefined") return false; return window.localStorage.getItem("wk-admin-sidebar-collapsed") === "true"; });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => { window.localStorage.setItem("wk-admin-sidebar-collapsed", String(collapsed)); }, [collapsed]);
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (user.loading) return;
    if (!user.id) navigate(`/admin/login?next=${encodeURIComponent(location.pathname)}`, { replace: true });
    else if (!roleCanAccessAdmin(user.role)) navigate(`/admin/login?next=${encodeURIComponent(location.pathname)}`, { replace: true });
  }, [user.loading, user.id, user.role, navigate, location.pathname]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setSearchOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (user.loading || !user.id || !roleCanAccessAdmin(user.role)) {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-wk-bg text-wk-text">
          <div className="rounded-xl border border-wk-border bg-wk-surface p-6 text-center">
            <WkIcon name="ShieldCheck" size={28} className="mx-auto mb-3 text-wk-brand" />
            <div className="text-[14px] font-bold">Checking admin access…</div>
            <div className="mt-1 text-[12px] text-wk-text-muted">Public subscriber sessions cannot enter Admin Studio.</div>
          </div>
        </div>
      </>
    );
  }

  const visibleGroups = NAV_GROUPS.filter((group) => group.visible(user.can)).map((group) => ({ ...group, items: group.items.filter((item) => !item.requiredCapability || user.can(item.requiredCapability)) }));

  return (
    <div className="min-h-screen bg-wk-bg text-wk-text">
      {/* Mobile menu trigger */}
      <button onClick={() => setMobileOpen(true)} className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-wk-border bg-wk-surface shadow-lg lg:hidden"><WkIcon name="Menu" size={20} /></button>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-wk-border bg-wk-surface transition-all duration-300 ${collapsed ? "w-16" : "w-64"} ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        {/* Sidebar Header */}
        <div className="flex h-16 items-center gap-3 border-b border-wk-border px-4">
          <button onClick={() => navigate("/admin")} className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wk-brand text-wk-brand-on">
              <WkIcon name="Shield" size={18} />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-black">WAKILISHA</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint">Admin Studio</div>
              </div>
            )}
          </button>
          {!collapsed && (
            <div className="ml-auto flex items-center gap-0.5">
              <button
                onClick={() => setSearchOpen(true)}
                className="rounded p-1.5 text-wk-text-faint hover:bg-wk-surface-raised hover:text-wk-text transition-colors"
                title="Search (Cmd+K)"
              >
                <WkIcon name="Search" size={16} />
              </button>
              <button onClick={() => setCollapsed(true)} className="rounded p-1.5 text-wk-text-faint hover:bg-wk-surface-raised hover:text-wk-text transition-colors">
                <WkIcon name="PanelLeftClose" size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Collapsed state: expand + search buttons */}
        {collapsed && (
          <div className="flex flex-col items-center gap-1.5 py-3">
            <button onClick={() => setSearchOpen(true)} className="rounded-lg p-1.5 text-wk-text-faint hover:bg-wk-surface-raised hover:text-wk-text transition-colors" title="Search (Cmd+K)">
              <WkIcon name="Search" size={18} />
            </button>
            <button onClick={() => setCollapsed(false)} className="rounded-lg p-1.5 text-wk-text-faint hover:bg-wk-surface-raised hover:text-wk-text transition-colors" title="Expand sidebar">
              <WkIcon name="PanelLeftOpen" size={18} />
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {visibleGroups.map((group) => group.items.length > 0 && (
            <div key={group.label} className="mb-5">
              <div className={`mb-2 px-3 text-[10px] font-black uppercase tracking-wider text-wk-text-faint ${collapsed ? "sr-only" : ""}`}>
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  if (item.separatorLabel) {
                    return (
                      <div key={item.separatorLabel} className={`px-3 pt-3 pb-1 text-[9px] font-black uppercase tracking-widest text-wk-text-faint/50 ${collapsed ? "sr-only" : ""}`}>
                        {item.separatorLabel}
                      </div>
                    );
                  }
                  return (
                    <SidebarLink
                      key={item.path}
                      item={item}
                      active={location.pathname === item.path || (item.path !== "/admin" && location.pathname.startsWith(item.path))}
                      collapsed={collapsed}
                      badge={item.badgeKey ? getNavBadge(item.badgeKey, counts) : undefined}
                      onClick={() => navigate(item.path)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-wk-border p-3">
          <UserProfileDropdown user={user} collapsed={collapsed} />
          <button onClick={() => setMode(resolvedTheme === "dark" ? "light" : "dark")} className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[12px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text">
            <WkIcon name={resolvedTheme === "dark" ? "Sun" : "Moon"} size={15} />
            {!collapsed && <span>{resolvedTheme === "dark" ? "Light mode" : "Dark mode"}</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className={`min-h-screen transition-all duration-300 ${collapsed ? "lg:pl-16" : "lg:pl-64"}`}>
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>

      {/* Command Palette */}
      <AdminCommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}