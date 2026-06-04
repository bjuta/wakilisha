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
  {
    label: "Dashboard",
    visible: (r) => r === "administrator" || r === "editor" || r === "author",
    items: [{ path: "/admin", label: "Overview", icon: "LayoutDashboard" }],
  },
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
  {
    label: "Charts",
    visible: (r) => r === "administrator",
    items: [
      { path: "/admin/settings/charts/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
      { path: "/admin/settings/charts/families", label: "Chart Families", icon: "FolderTree" },
      { path: "/admin/settings/charts/ingest", label: "Ingest Studio", icon: "Database" },
      { path: "/admin/settings/charts/ingest-runs", label: "Ingest Runs", icon: "ListChecks" },
      { path: "/admin/settings/charts/editions", label: "Editions", icon: "Layers" },
      { path: "/admin/settings/charts/snapshots", label: "Snapshots", icon: "Camera" },
    ],
  },
  {
    label: "Registry",
    visible: (r) => r === "administrator",
    items: [
      { path: "/admin/registry/artists", label: "Artists", icon: "Mic2" },
      { path: "/admin/registry/tracks", label: "Tracks", icon: "Music" },
      { path: "/admin/registry/releases", label: "Releases", icon: "Disc" },
      { path: "/admin/registry/labels", label: "Labels", icon: "Building2" },
      { path: "/admin/registry/genres", label: "Genres", icon: "Tags" },
    ],
  },
  {
    label: "Commerce",
    visible: () => false,
    items: [
      { path: "/admin/commerce/products", label: "Products", icon: "ShoppingBag", disabled: true },
      { path: "/admin/commerce/categories", label: "Categories", icon: "FolderTree", disabled: true },
      { path: "/admin/commerce/tags", label: "Tags", icon: "Tags", disabled: true },
    ],
  },
  {
    label: "Media",
    visible: (r) => r === "administrator" || r === "editor" || r === "author" || r === "writer",
    items: [
      { path: "/admin/media/library", label: "Media Library", icon: "Image" },
      { path: "/admin/media/missing", label: "Missing Images", icon: "ImageOff", badgeKey: "missingImages" },
      { path: "/admin/media/orphaned", label: "Orphaned Media", icon: "Unlink", disabled: true },
      { path: "/admin/media/broken", label: "Broken Links", icon: "LinkBreak", badgeKey: "brokenLinks" },
    ],
  },
  {
    label: "Relationships",
    visible: (r) => r === "administrator",
    items: [
      { path: "/admin/relationships/viewer", label: "Entity Relationships", icon: "Network" },
      { path: "/admin/relationships/duplicates", label: "Duplicate Merge", icon: "Copy" },
      { path: "/admin/relationships/content", label: "Content Relationships", icon: "FileSymlink", disabled: true },
      { path: "/admin/relationships/charts", label: "Chart Relationships", icon: "BarChart3", disabled: true },
    ],
  },
  {
    label: "Review",
    visible: (r) => r === "administrator" || r === "editor",
    items: [
      { path: "/admin/review/queue", label: "Review Queue", icon: "GitPullRequest", badgeKey: "reviewQueue" },
      { path: "/admin/review/migration", label: "Migration Issues", icon: "AlertTriangle", disabled: true },
      { path: "/admin/review/broken-links", label: "Broken Links", icon: "LinkBreak", disabled: true },
      { path: "/admin/review/missing-metadata", label: "Missing Metadata", icon: "AlertCircle", disabled: true },
      { path: "/admin/review/unresolved", label: "Unresolved Entities", icon: "HelpCircle", disabled: true },
      { path: "/admin/review/conflicts", label: "Conflicts", icon: "GitCompare", disabled: true },
    ],
  },
  {
    label: "Imports",
    visible: (r) => r === "administrator",
    items: [
      { path: "/admin/imports/jobs", label: "Import Jobs", icon: "Upload" },
      { path: "/admin/imports/upload", label: "Upload ZIP", icon: "FileUp" },
      { path: "/admin/imports/reports", label: "Import Reports", icon: "FileBarChart" },
      { path: "/admin/imports/staging", label: "Staging Records", icon: "Database" },
      { path: "/admin/imports/failed", label: "Failed Records", icon: "FileX", badgeKey: "failedImports" },
    ],
  },
  {
    label: "Settings",
    visible: (r) => r === "administrator",
    items: [
      { path: "/admin/settings", label: "Settings Hub", icon: "Settings" },
      { path: "/admin/settings/integrations", label: "Integrations", icon: "Plug" },
      { path: "/admin/settings/frontend-appearance", label: "Appearance", icon: "Palette" },
      { path: "/admin/settings/navigation", label: "Navigation", icon: "Compass" },
      { path: "/admin/settings/audit", label: "Audit Log", icon: "ClipboardList" },
    ],
  },
  {
    label: "Users",
    visible: (r) => r === "administrator",
    items: [
      { path: "/admin/users", label: "Manage Users", icon: "Users" },
    ],
  },
  {
    label: "Tools",
    visible: () => false,
    items: [
      { path: "/admin/tools/health", label: "Data Health", icon: "Activity", disabled: true },
      { path: "/admin/tools/cache", label: "Cache / Rebuild", icon: "RefreshCw", disabled: true },
      { path: "/admin/tools/slugs", label: "Slug Aliases", icon: "Type", disabled: true },
      { path: "/admin/tools/export", label: "Export / Backup", icon: "Download", disabled: true },
    ],
  },
];

function getNavBadge(key: string, counts: ReturnType<typeof useAdminBadgeCounts>): number | undefined {
  switch (key) {
    case "missingImages":
      return counts.missingImages > 0 ? counts.missingImages : undefined;
    case "brokenLinks":
      return counts.brokenLinks > 0 ? counts.brokenLinks : undefined;
    case "reviewQueue":
      return counts.reviewQueue > 0 ? counts.reviewQueue : undefined;
    case "failedImports":
      return counts.failedImports > 0 ? counts.failedImports : undefined;
    default:
      return undefined;
  }
}

function SidebarLink({
  item,
  active,
  collapsed,
  badge,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      disabled={item.disabled}
      className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-all ${
        item.disabled
          ? "cursor-not-allowed opacity-40"
          : active
          ? "bg-wk-brand-soft text-wk-brand"
          : "text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text-soft"
      }`}
    >
      <span className="flex h-5 w-5 items-center justify-center shrink-0">
        <WkIcon name={item.icon} size={16} />
      </span>
      <span
        className={`whitespace-nowrap transition-all duration-300 ${
          collapsed ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100"
        }`}
      >
        {item.label}
      </span>
      {badge !== undefined && badge > 0 && !collapsed && (
        <span className="ml-auto shrink-0 rounded-full bg-wk-danger px-1.5 py-0.5 text-[10px] font-bold text-wk-brand-on">
          {badge}
        </span>
      )}
      {badge !== undefined && badge > 0 && collapsed && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-wk-danger text-[9px] font-bold text-wk-brand-on">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {item.disabled && !collapsed && (
        <span className="ml-auto shrink-0 rounded-full bg-wk-surface-raised px-1.5 py-0.5 text-[9px] font-bold text-wk-text-faint uppercase">
          Soon
        </span>
      )}
    </button>
  );
}

/* ────────────────────────── User Profile Dropdown ────────────────────────── */

function UserProfileDropdown({ user, collapsed }: { user: ReturnType<typeof useAdminUser>; collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const roleLabel = user.role ? ROLE_LABELS[user.role] : null;

  const roleBadgeColors: Record<string, string> = {
    administrator: "bg-wk-danger/10 text-wk-danger border-wk-danger/20",
    editor: "bg-wk-brand/10 text-wk-brand border-wk-brand/20",
    author: "bg-wk-success/10 text-wk-success border-wk-success/20",
    writer: "bg-wk-warning/10 text-wk-warning border-wk-warning/20",
  };

  if (!user.id) {
    return (
      <button
        onClick={() => navigate("/auth")}
        className="flex items-center gap-2 rounded-full hover:bg-wk-surface-raised transition-colors px-3 py-2"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-wk-surface-raised text-wk-text-muted">
          <WkIcon name="LogIn" size={14} />
        </span>
        {!collapsed && (
          <span className="hidden lg:block text-[12px] font-semibold text-wk-text-muted whitespace-nowrap">
            Sign In
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full hover:bg-wk-surface-raised transition-colors px-1 py-1"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-wk-brand-soft text-wk-brand overflow-hidden">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <WkIcon name="User" size={14} />
          )}
        </div>
        {!collapsed && (
          <div className="hidden lg:flex flex-col items-start min-w-0 max-w-[120px]">
            <span className="text-[12px] font-semibold text-wk-text-soft truncate w-full text-left">
              {user.name}
            </span>
            {roleLabel && (
              <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${roleBadgeColors[user.role ?? ""] ?? "bg-wk-surface-raised text-wk-text-muted border-wk-border"}`}>
                {roleLabel}
              </span>
            )}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-wk-border bg-wk-surface shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-wk-border">
            <p className="text-[13px] font-semibold text-wk-text truncate">{user.name}</p>
            <p className="text-[11px] text-wk-text-muted truncate">{user.email}</p>
            {roleLabel && (
              <span className={`mt-1.5 inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${roleBadgeColors[user.role ?? ""] ?? ""}`}>
                {roleLabel}
              </span>
            )}
          </div>
          <div className="p-1">
            <button
              onClick={() => { navigate("/profile"); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text transition-colors"
            >
              <WkIcon name="User" size={14} />
              Public Profile
            </button>
            {user.role === "administrator" && (
              <>
                <button
                  onClick={() => { navigate("/admin/settings"); setOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text transition-colors"
                >
                  <WkIcon name="Settings" size={14} />
                  Settings
                </button>
                <button
                  onClick={() => { navigate("/admin/users"); setOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text transition-colors"
                >
                  <WkIcon name="Users" size={14} />
                  Manage Users
                </button>
              </>
            )}
          </div>
          <div className="border-t border-wk-border p-1">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold text-wk-danger hover:bg-wk-danger-soft transition-colors"
            >
              <WkIcon name="LogOut" size={14} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────── Section Header ────────────────────────── */

function SectionHeader({ label, collapsed }: { label: string; collapsed: boolean }) {
  return (
    <div
      className={`mt-4 mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-wk-text-faint transition-all ${
        collapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"
      }`}
    >
      {label}
    </div>
  );
}

/* ────────────────────────── Admin Shell ────────────────────────── */

export function AdminShell() {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const badgeCounts = useAdminBadgeCounts();
  const adminUser = useAdminUser();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("admin-sidebar-collapsed") === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentPath = location.pathname;

  // Keyboard shortcut: Cmd+K / Ctrl+K to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (!collapsed && searchInputRef.current) {
          searchInputRef.current.focus();
        } else if (collapsed) {
          setCollapsed(false);
          setTimeout(() => searchInputRef.current?.focus(), 350);
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [collapsed]);

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

  const isActive = (path: string) => currentPath === path || currentPath.startsWith(`${path}/`);

  const getPageTitle = () => {
    for (const group of NAV_GROUPS) {
      const match = group.items.find((i) => isActive(i.path));
      if (match) return match.label;
    }
    return "Admin";
  };

  const getPageGroup = () => {
    for (const group of NAV_GROUPS) {
      const match = group.items.find((i) => isActive(i.path));
      if (match) return group.label;
    }
    return "";
  };

  const filteredGroups = searchQuery
    ? NAV_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((i) =>
          i.label.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter((g) => g.items.length > 0 && g.visible(adminUser.role))
    : NAV_GROUPS.filter((g) => g.visible(adminUser.role));

  /* ──────── Sidebar Content ──────── */
  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-14 items-center gap-3 border-b border-wk-border px-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wk-brand text-wk-brand-on">
          <WkIcon name="BarChart3" size={16} />
        </div>
        <div
          className={`min-w-0 overflow-hidden transition-all duration-300 ${
            collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
          }`}
        >
          <h1 className="truncate text-[13px] font-black tracking-tight text-wk-text">
            WAKILISHA
          </h1>
          <p className="truncate text-[10px] text-wk-text-muted">Production Engine</p>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`ml-auto flex h-7 w-7 items-center justify-center rounded-full text-wk-text-muted transition-all hover:bg-wk-surface-raised hover:text-wk-text ${
            collapsed ? "mx-auto" : ""
          }`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <WkIcon name={collapsed ? "ChevronRight" : "ChevronLeft"} size={16} />
        </button>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2">
            <WkIcon name="Search" size={14} className="text-wk-text-faint" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search admin..."
              className="w-full bg-transparent text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-wk-text-faint hover:text-wk-text">
                <WkIcon name="X" size={14} />
              </button>
            )}
            {!searchQuery && (
              <span className="text-[10px] text-wk-text-faint border border-wk-border rounded px-1">⌘K</span>
            )}
          </div>
        </div>
      )}

      {/* Nav Groups */}
      <div className="flex-1 overflow-y-auto py-3">
        {filteredGroups.map((group) => (
          <div key={group.label}>
            <SectionHeader label={group.label} collapsed={collapsed} />
            <div className="space-y-0.5 px-2">
              {group.items.map((item) => (
                <SidebarLink
                  key={item.path}
                  item={item}
                  active={isActive(item.path)}
                  collapsed={collapsed}
                  badge={item.badgeKey ? getNavBadge(item.badgeKey, badgeCounts) : undefined}
                  onClick={() => {
                    if (!item.disabled) {
                      navigate(item.path);
                      setMobileOpen(false);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        ))}
        {filteredGroups.length === 0 && !collapsed && (
          <div className="px-4 py-8 text-center">
            {adminUser.role ? (
              <>
                <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl bg-wk-surface-raised mb-3">
                  <WkIcon name="Search" size={18} className="text-wk-text-faint" />
                </div>
                <div className="text-[12px] text-wk-text-muted">No results for "{searchQuery}"</div>
              </>
            ) : (
              <>
                <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl bg-wk-warning/10 mb-3">
                  <WkIcon name="ShieldAlert" size={18} className="text-wk-warning" />
                </div>
                <p className="text-[13px] font-semibold text-wk-text mb-1">No Role Assigned</p>
                <p className="text-[11px] text-wk-text-muted leading-relaxed">
                  Contact an administrator to get access to the production engine.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="border-t border-wk-border px-3 py-3">
        <div className="space-y-1">
          {[
            {
              label: "Back to Site",
              icon: "Home" as WkIconName,
              onClick: () => navigate("/"),
            },
            {
              label: theme === "dark" ? "Dark mode" : "Light mode",
              icon: (theme === "dark" ? "Moon" : "Sun") as WkIconName,
              onClick: toggle,
            },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-wk-text-muted transition-all hover:bg-wk-surface-raised hover:text-wk-text-soft ${
                collapsed ? "justify-center" : ""
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className="flex h-5 w-5 items-center justify-center shrink-0">
                <WkIcon name={item.icon} size={16} />
              </span>
              <span
                className={`whitespace-nowrap transition-all duration-300 ${
                  collapsed ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100"
                }`}
              >
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-wk-bg text-wk-text">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-wk-border bg-wk-surface transition-all duration-300 ease-[var(--wk-ease-snap)] md:flex ${
          collapsed ? "w-[68px]" : "w-[260px]"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-[var(--wk-z-modal)] bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed left-0 top-0 z-[var(--wk-z-modal)] flex h-full w-[260px] flex-col border-r border-wk-border bg-wk-surface md:hidden">
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Main Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-14 items-center justify-between gap-4 border-b border-wk-border bg-wk-surface/95 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-wk-text-muted hover:bg-wk-surface-raised md:hidden"
            >
              <WkIcon name="Menu" size={18} />
            </button>
            <div className="flex items-center gap-2 text-[13px] text-wk-text-muted">
              <span className="font-semibold text-wk-brand">Admin</span>
              {getPageGroup() && (
                <>
                  <WkIcon name="ChevronRight" size={12} />
                  <span className="text-wk-text-soft">{getPageGroup()}</span>
                </>
              )}
              <WkIcon name="ChevronRight" size={12} />
              <span className="text-wk-text-soft">{getPageTitle()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden h-8 w-8 items-center justify-center rounded-full text-wk-text-muted hover:bg-wk-surface-raised md:flex"
              title="Toggle sidebar"
            >
              <WkIcon name={collapsed ? "PanelLeftOpen" : "PanelLeftClose"} size={18} />
            </button>
            {adminUser.role === "administrator" && (
              <>
                <div className="hidden h-6 w-px bg-wk-border md:block" />
                <button
                  onClick={() => navigate("/admin/settings/charts/ingest")}
                  className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
                >
                  <WkIcon name="Plus" size={14} />
                  New Ingest
                </button>
              </>
            )}
            <UserProfileDropdown user={adminUser} collapsed={collapsed} />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[var(--wk-w-max)] px-4 py-6 md:px-6">
            <Outlet />
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-wk-border bg-wk-surface px-4 py-4 md:px-6">
          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-wk-brand text-wk-brand-on">
                <WkIcon name="BarChart3" size={12} />
              </div>
              <div>
                <p className="text-[12px] font-bold text-wk-text">
                  WAKILISHA<span className="text-wk-brand">.</span>
                </p>
                <p className="text-[10px] text-wk-text-muted">Production Engine v5</p>
              </div>
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[12px] text-wk-text-muted">
              {[
                { label: "Dashboard", path: "/admin" },
                { label: "Charts", path: "/admin/settings/charts/dashboard" },
                { label: "Settings", path: "/admin/settings" },
                { label: "Public Site", path: "/" },
              ].map((link) => (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className="hover:text-wk-text transition-colors"
                >
                  {link.label}
                </button>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-wk-text-faint">v5</span>
              <span className="inline-flex items-center rounded-full border border-wk-border bg-wk-surface-raised px-2 py-0.5 text-[10px] font-semibold text-wk-text-muted">
                {theme === "dark" ? "Dark" : "Light"}
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}