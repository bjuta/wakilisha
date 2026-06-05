import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { WkIcon } from "@/components/design-system/Icon";
import { useAdminBadgeCounts } from "@/hooks/useAdminBadgeCounts";
import { useAdminUser } from "@/hooks/useAdminUser";
import { supabase } from "@/lib/supabase";
import { ROLE_LABELS, type UserRole } from "@/services/userRoles";
import type { WkIconName } from "@/components/design-system/Icon";

/* ────────────────────────── Types ────────────────────────── */

interface NavItem {
  path: string;
  label: string;
  icon: WkIconName;
  badgeKey?: string;
  disabled?: boolean;
  requiredCapability?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  visible: (role: UserRole | null) => boolean;
}

/* ────────────────────────── Navigation Groups ────────────────────────── */

const NAV_GROUPS: NavGroup[] = [
  { label: "Dashboard", visible: (r) => r === "administrator" || r === "editor" || r === "author", items: [{ path: "/admin", label: "Overview", icon: "LayoutDashboard" }] },
  {
    label: "Content",
    visible: (r) => r === "administrator" || r === "editor" || r === "author" || r === "writer",
    items: [
      { path: "/admin/content/articles", label: "Articles", icon: "FileText" },
      { path: "/admin/content/guides", label: "Guides", icon: "BookOpen" },
      { path: "/admin/content/pages", label: "Pages", icon: "Layout" },
      { path: "/admin/content/publishing", label: "Publishing", icon: "Globe" },
      { path: "/admin/content/archive", label: "Archive", icon: "Archive" },
      { path: "/admin/content/migration", label: "Media Migration", icon: "HardDriveDownload" },
      { path: "/admin/content/collections", label: "Collections", icon: "Library", disabled: true },
      { path: "/admin/content/categories", label: "Categories", icon: "FolderTree", disabled: true },
      { path: "/admin/content/tags", label: "Tags", icon: "Tags", disabled: true },
    ],
  },
  { label: "Charts", visible: (r) => r === "administrator", items: [{ path: "/admin/settings/charts/dashboard", label: "Dashboard", icon: "LayoutDashboard" }, { path: "/admin/settings/charts/families", label: "Chart Families", icon: "FolderTree" }, { path: "/admin/settings/charts/ingest", label: "Ingest Studio", icon: "Database" }, { path: "/admin/settings/charts/ingest-runs", label: "Ingest Runs", icon: "ListChecks" }, { path: "/admin/settings/charts/editions", label: "Editions", icon: "Layers" }, { path: "/admin/settings/charts/snapshots", label: "Snapshots", icon: "Camera" }] },
  { label: "Registry", visible: (r) => r === "administrator", items: [{ path: "/admin/registry/artists", label: "Artists", icon: "Mic2" }, { path: "/admin/registry/tracks", label: "Tracks", icon: "Music" }, { path: "/admin/registry/releases", label: "Releases", icon: "Disc" }, { path: "/admin/registry/labels", label: "Labels", icon: "Building2" }, { path: "/admin/registry/genres", label: "Genres", icon: "Tags" }] },
  { label: "Commerce", visible: () => false, items: [{ path: "/admin/commerce/products", label: "Products", icon: "ShoppingBag", disabled: true }, { path: "/admin/commerce/categories", label: "Categories", icon: "FolderTree", disabled: true }, { path: "/admin/commerce/tags", label: "Tags", icon: "Tags", disabled: true }] },
  { label: "Media", visible: (r) => r === "administrator" || r === "editor" || r === "author" || r === "writer", items: [{ path: "/admin/media/library", label: "Media Library", icon: "Image" }, { path: "/admin/media/missing", label: "Missing Images", icon: "ImageOff", badgeKey: "missingImages" }, { path: "/admin/media/orphaned", label: "Orphaned Media", icon: "Unlink", disabled: true }, { path: "/admin/media/broken", label: "Broken Links", icon: "LinkBreak", badgeKey: "brokenLinks" }] },
  { label: "Relationships", visible: (r) => r === "administrator", items: [{ path: "/admin/relationships/viewer", label: "Entity Relationships", icon: "Network" }, { path: "/admin/relationships/duplicates", label: "Duplicate Merge", icon: "Copy" }, { path: "/admin/relationships/content", label: "Content Relationships", icon: "FileSymlink", disabled: true }, { path: "/admin/relationships/charts", label: "Chart Relationships", icon: "BarChart3", disabled: true }] },
  { label: "Review", visible: (r) => r === "administrator" || r === "editor", items: [{ path: "/admin/review/queue", label: "Review Queue", icon: "GitPullRequest", badgeKey: "reviewQueue" }, { path: "/admin/review/migration", label: "Migration Issues", icon: "AlertTriangle", disabled: true }, { path: "/admin/review/broken-links", label: "Broken Links", icon: "LinkBreak", disabled: true }, { path: "/admin/review/missing-metadata", label: "Missing Metadata", icon: "AlertCircle", disabled: true }, { path: "/admin/review/unresolved", label: "Unresolved Entities", icon: "HelpCircle", disabled: true }, { path: "/admin/review/conflicts", label: "Conflicts", icon: "GitCompare", disabled: true }] },
  {
    label: "Imports",
    visible: (r) => r === "administrator",
    items: [
      { path: "/admin/imports/wizard", label: "Migration Wizard", icon: "Sparkles" },
      { path: "/admin/imports/jobs", label: "Import Jobs", icon: "Upload" },
      { path: "/admin/imports/upload", label: "Upload ZIP", icon: "FileUp" },
      { path: "/admin/imports/reports", label: "Import Reports", icon: "FileBarChart" },
      { path: "/admin/imports/staging", label: "Staging Records", icon: "Database" },
      { path: "/admin/imports/failed", label: "Failed Records", icon: "FileX", badgeKey: "failedImports" },
    ],
  },
  { label: "Settings", visible: (r) => r === "administrator", items: [{ path: "/admin/settings", label: "Settings Hub", icon: "Settings" }, { path: "/admin/settings/integrations", label: "Integrations", icon: "Plug" }, { path: "/admin/settings/frontend-appearance", label: "Appearance", icon: "Palette" }, { path: "/admin/settings/navigation", label: "Navigation", icon: "Compass" }, { path: "/admin/settings/audit", label: "Audit Log", icon: "ClipboardList" }] },
  { label: "Users", visible: (r) => r === "administrator", items: [{ path: "/admin/users", label: "Manage Users", icon: "Users" }] },
  { label: "Tools", visible: () => false, items: [{ path: "/admin/tools/health", label: "Data Health", icon: "Activity", disabled: true }, { path: "/admin/tools/cache", label: "Cache / Rebuild", icon: "RefreshCw", disabled: true }, { path: "/admin/tools/slugs", label: "Slug Aliases", icon: "Type", disabled: true }, { path: "/admin/tools/export", label: "Export / Backup", icon: "Download", disabled: true }] },
];

function getNavBadge(key: string, counts: ReturnType<typeof useAdminBadgeCounts>): number | undefined {
  switch (key) {
    case "missingImages": return counts.missingImages > 0 ? counts.missingImages : undefined;
    case "brokenLinks": return counts.brokenLinks > 0 ? counts.brokenLinks : undefined;
    case "reviewQueue": return counts.reviewQueue > 0 ? counts.reviewQueue : undefined;
    case "failedImports": return counts.failedImports > 0 ? counts.failedImports : undefined;
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
      {item.disabled && !collapsed && <span className="ml-auto shrink-0 rounded-full bg-wk-surface-raised px-1.5 py-0.5 text-[9px] font-bold text-wk-text-faint uppercase">Soon</span>}
    </button>
  );
}

/* ────────────────────────── User Profile Dropdown ────────────────────────── */

function UserProfileDropdown({ user, collapsed }: { user: ReturnType<typeof useAdminUser>; collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); } document.addEventListener("mousedown", handleClick); return () => document.removeEventListener("mousedown", handleClick); }, []);

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate("/"); };
  const roleLabel = user.role ? ROLE_LABELS[user.role] : null;
  const roleBadgeColors: Record<string, string> = { administrator: "bg-wk-danger/10 text-wk-danger border-wk-danger/20", editor: "bg-wk-brand/10 text-wk-brand border-wk-brand/20", author: "bg-wk-success/10 text-wk-success border-wk-success/20", writer: "bg-wk-warning/10 text-wk-warning border-wk-warning/20" };

  if (!user.id) {
    return (
      <button onClick={() => navigate("/auth")} className="flex w-full items-center gap-3 rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2 text-left hover:border-wk-brand/40">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-wk-brand-soft"><WkIcon name="LogIn" size={16} className="text-wk-brand" /></div>
        {!collapsed && <div className="min-w-0"><div className="text-[12px] font-bold text-wk-text">Sign in</div><div className="text-[10px] text-wk-text-faint">Access admin</div></div>}
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2 text-left hover:border-wk-brand/40">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wk-brand text-[12px] font-black text-wk-brand-on">{user.name?.[0]?.toUpperCase() ?? "U"}</div>
        {!collapsed && <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-bold text-wk-text">{user.name}</div><div className="truncate text-[10px] text-wk-text-faint">{roleLabel ?? "User"}</div></div>}
        {!collapsed && <WkIcon name="ChevronUp" size={14} className={`shrink-0 text-wk-text-faint transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>
      {open && !collapsed && <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border border-wk-border bg-wk-surface shadow-xl"><div className="border-b border-wk-border p-3"><div className="font-bold text-wk-text text-sm">{user.name}</div><div className="text-xs text-wk-text-muted">{user.email}</div>{user.role && <div className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${roleBadgeColors[user.role]}`}>{roleLabel}</div>}</div><button onClick={() => { setOpen(false); navigate("/admin/settings"); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"><WkIcon name="Settings" size={14} /> Settings</button><button onClick={handleSignOut} className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-wk-danger hover:bg-wk-danger/10"><WkIcon name="LogOut" size={14} /> Sign out</button></div>}
    </div>
  );
}

/* ────────────────────────── Admin Shell Component ────────────────────────── */

export function AdminShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme, setMode } = useTheme();
  const counts = useAdminBadgeCounts();
  const user = useAdminUser();
  const [collapsed, setCollapsed] = useState(() => { if (typeof window === "undefined") return false; return window.localStorage.getItem("wk-admin-sidebar-collapsed") === "true"; });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { window.localStorage.setItem("wk-admin-sidebar-collapsed", String(collapsed)); }, [collapsed]);
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const visibleGroups = NAV_GROUPS.filter((group) => group.visible(user.role));

  return (
    <div className="min-h-screen bg-wk-bg text-wk-text">
      <button onClick={() => setMobileOpen(true)} className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-wk-border bg-wk-surface shadow-lg lg:hidden"><WkIcon name="Menu" size={20} /></button>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-wk-border bg-wk-surface transition-all duration-300 ${collapsed ? "w-16" : "w-64"} ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex h-16 items-center justify-between border-b border-wk-border px-4">
          {!collapsed && <div><div className="text-lg font-black tracking-tight text-wk-text">WAKILISHA</div><div className="text-[10px] uppercase tracking-wider text-wk-text-faint">Admin</div></div>}
          {collapsed && <div className="text-lg font-black text-wk-brand">W</div>}
          <button onClick={() => setCollapsed(!collapsed)} className="hidden h-8 w-8 items-center justify-center rounded-lg text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text lg:flex"><WkIcon name={collapsed ? "PanelLeftOpen" : "PanelLeftClose"} size={16} /></button>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto p-3">
          {visibleGroups.map((group) => <div key={group.label}>{!collapsed && <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-wk-text-faint">{group.label}</div>}<div className="space-y-1">{group.items.map((item) => <SidebarLink key={item.path} item={item} active={location.pathname === item.path || (item.path !== "/admin" && location.pathname.startsWith(item.path))} collapsed={collapsed} badge={item.badgeKey ? getNavBadge(item.badgeKey, counts) : undefined} onClick={() => navigate(item.path)} />)}</div></div>)}
        </nav>
        <div className="border-t border-wk-border p-3"><UserProfileDropdown user={user} collapsed={collapsed} />{!collapsed && <div className="mt-3 flex items-center justify-between"><button onClick={() => setMode(resolvedTheme === "dark" ? "light" : "dark")} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"><WkIcon name={resolvedTheme === "dark" ? "Sun" : "Moon"} size={14} /> {resolvedTheme === "dark" ? "Light" : "Dark"}</button><button onClick={() => navigate("/")} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"><WkIcon name="ExternalLink" size={12} /> View site</button></div>}</div>
      </aside>
      <main className={`min-h-screen transition-all duration-300 ${collapsed ? "lg:ml-16" : "lg:ml-64"}`}><div className="p-4 pt-16 lg:p-6 lg:pt-6"><Outlet /></div></main>
    </div>
  );
}
