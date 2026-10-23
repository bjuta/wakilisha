import { MobileAccountDrawer } from "@/components/mobile/MobileAccountDrawer";
import { WakilishaAccountMark } from "@/components/brand/WakilishaAccountMark";
import { visibleWakilishaNavigation, isWakilishaNavCurrent } from "@/components/navigation/wakilishaNavigation";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Link,
  useLocation,
} from "react-router-dom";
import {
  WkIcon,
} from "@/components/design-system/Icon";
import {
  useTheme,
} from "@/components/design-system/theme/ThemeProvider";
import {
  getSiteIdentitySettings,
} from "@/services/adminSettings/settingsStore";
import type {
  SiteIdentitySettings,
} from "@/services/adminSettings/settingsTypes";
import { GlobalSearchSurface } from "@/components/search/GlobalSearchSurface";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useMessagesAccess } from "@/hooks/useMessagesAccess";

const MUSIC_APP_PREFIXES = [
  "/music",
  "/following",
  "/charts",
  "/playlists",
  "/artists",
  "/releases",
  "/tracks",
  "/genres",
  "/labels",
  "/magazine",
  "/artist-studio",
  "/search",
] as const;

const MUSIC_SIDEBAR_COLLAPSED_KEY =
  "wk-music-sidebar-collapsed";
export function isMusicAppPath(
  pathname: string,
) {
  if (
    pathname.includes("/manage") ||
    pathname.includes("/lyrics/contribute")
  ) {
    return false;
  }

  return MUSIC_APP_PREFIXES.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(`${prefix}/`),
  );
}

function useSiteIdentity() {
  const [identity, setIdentity] =
    useState<SiteIdentitySettings>(
      getSiteIdentitySettings,
    );

  useEffect(() => {
    const refresh = () =>
      setIdentity(
        getSiteIdentitySettings(),
      );

    window.addEventListener(
      "wk_settings_changed",
      refresh,
    );

    return () =>
      window.removeEventListener(
        "wk_settings_changed",
        refresh,
      );
  }, []);

  return identity;
}

function AppNavLink({
  to,
  label,
  icon,
  active,
  collapsed,
}: {
  to: string;
  label: string;
  icon: Parameters<typeof WkIcon>[0]["name"];
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={[
        "relative flex min-h-11 items-center rounded-xl text-[13px] font-semibold transition-colors",
        collapsed
          ? "justify-center px-0"
          : "gap-3 px-3",
        active
          ? "bg-[var(--wk-surface-raised)] text-[var(--wk-text)]"
          : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]",
      ].join(" ")}
    >
      {active ? (
        <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--wk-brand)]" />
      ) : null}
      <WkIcon
        name={icon}
        size={17}
        className={
          active
            ? "text-[var(--wk-brand)]"
            : "text-[var(--wk-text-faint)]"
        }
      />
      {!collapsed ? (
        <span>{label}</span>
      ) : null}
    </Link>
  );
}

function DiscoveryLink({
  to,
  label,
  icon,
  collapsed,
}: {
  to: string;
  label: string;
  icon: Parameters<typeof WkIcon>[0]["name"];
  collapsed: boolean;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={collapsed ? label : undefined}
      className={[
        "flex h-11 items-center rounded-full text-[12px] font-semibold text-[var(--wk-text-muted)] transition-colors hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]",
        collapsed
          ? "justify-center px-0"
          : "gap-3 px-3",
      ].join(" ")}
    >
      <WkIcon
        name={icon}
        size={15}
        className="text-[var(--wk-text-faint)]"
      />
      {!collapsed ? (
        <span>{label}</span>
      ) : null}
    </Link>
  );
}

export function MusicDesktopShell({
  children,
}: {
  children: ReactNode;
}) {
  const location = useLocation();
  const identity = useSiteIdentity();
  const { theme, toggle } = useTheme();
  const authUser = useAuthUser();
  const isSignedIn = !authUser.loading && authUser.id.length > 0;
  const messagesAccess = useMessagesAccess();
  const navigation = visibleWakilishaNavigation({
    signedIn: isSignedIn,
    messagesVisible: !messagesAccess.loading && messagesAccess.visible,
  });
  const [logoError, setLogoError] =
    useState(false);
  const [
    sidebarCollapsed,
    setSidebarCollapsed,
  ] = useState(() => {
    try {
      return (
        window.localStorage.getItem(
          MUSIC_SIDEBAR_COLLAPSED_KEY,
        ) === "1"
      );
    } catch {
      return false;
    }
  });
  const [
    globalSearchOpen,
    setGlobalSearchOpen,
  ] = useState(false);
  const [smallScreenMenuOpen, setSmallScreenMenuOpen] = useState(false);
  const [menuStartsInYou, setMenuStartsInYou] = useState(false);
  // Workbook: 768 to 1279px uses the permanent 80px icon rail.
  // Keep the user’s expanded desktop preference at widths of 1280px and above.
  const [tabletRail, setTabletRail] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 768px) and (max-width: 1279px)").matches
  );
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px) and (max-width: 1279px)");
    const update = () => setTabletRail(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const compactSidebar = sidebarCollapsed || tabletRail;

  const selectedLogoUrl =
    theme === "dark"
      ? (
          identity.darkLogoUrl ||
          identity.logoUrl
        )
      : (
          identity.lightLogoUrl ||
          identity.logoUrl
        );

  const displayName =
    identity.siteName.trim() ||
    "WAKILISHA";

  const resolvedLogoUrl =
    !logoError && selectedLogoUrl.trim()
      ? selectedLogoUrl
      : theme === "dark"
        ? "/assets/logos/wakilisha-logo-dark.svg"
        : "/assets/logos/wakilisha-logo-light.svg";

  useEffect(() => {
    setLogoError(false);
  }, [selectedLogoUrl]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        MUSIC_SIDEBAR_COLLAPSED_KEY,
        sidebarCollapsed ? "1" : "0",
      );
    } catch {
      // Sidebar state remains session-local if storage is unavailable.
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!location.hash) return;

    const id =
      location.hash.slice(1);

    const frame =
      window.requestAnimationFrame(
        () => {
          document
            .getElementById(id)
            ?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
        },
      );

    return () =>
      window.cancelAnimationFrame(
        frame,
      );
  }, [
    location.hash,
    location.pathname,
  ]);

  const activeSection =
    useMemo(() => {
      const pathname =
        location.pathname;

      if (pathname === "/") {
        return "magazine";
      }

      if (
        pathname.startsWith(
          "/search",
        )
      ) {
        return "search";
      }

      if (
        pathname.startsWith(
          "/notifications",
        )
      ) {
        return "notifications";
      }

      if (
        pathname.startsWith(
          "/following",
        )
      ) {
        return "following";
      }

      if (
        pathname.startsWith(
          "/charts",
        )
      ) {
        return "charts";
      }

      if (
        pathname.startsWith(
          "/playlists",
        )
      ) {
        return "playlists";
      }

      if (
        pathname.startsWith(
          "/artists",
        )
      ) {
        return "artists";
      }

      if (
        pathname.startsWith(
          "/releases",
        ) ||
        pathname.startsWith(
          "/tracks",
        )
      ) {
        return "releases";
      }

      if (
        pathname.startsWith(
          "/genres",
        ) ||
        pathname.startsWith(
          "/labels",
        )
      ) {
        return "scenes";
      }

      if (
        pathname.startsWith(
          "/magazine",
        )
      ) {
        return "magazine";
      }

      if (
        pathname.startsWith(
          "/artist-studio",
        )
      ) {
        return "artist-studio";
      }

      return "music";
    }, [location.pathname]);

  return (
    <div className="wk-music-app-shell min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)] md:flex">
      <aside
        className={[
          "sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto overscroll-contain border-r border-[var(--wk-border)] bg-[var(--wk-surface)] transition-[width] duration-200 ease-out [scrollbar-width:thin] md:flex",
          compactSidebar
            ? "w-[80px]"
            : "w-[256px]",
        ].join(" ")}
      >
        <div
          className={[
            "sticky top-0 z-10 flex min-h-[82px] shrink-0 items-center border-b border-[var(--wk-border)] bg-[var(--wk-surface)]/95 backdrop-blur",
            compactSidebar
              ? "justify-center px-2"
              : "justify-between gap-3 px-5",
          ].join(" ")}
        >
          {!compactSidebar ? (
            <Link
              to="/music"
              aria-label={displayName}
              className="flex min-w-0 items-center"
            >
              {<img
                  src={resolvedLogoUrl}
                  alt={displayName}
                  onError={() =>
                    setLogoError(true)
                  }
                  className="h-8 max-w-[158px] object-contain object-left"
                />}
            </Link>
          ) : null}

          <Link to="/" aria-label="WAKILISHA home" className="flex h-11 w-11 items-center justify-center lg:hidden">
            <WakilishaAccountMark size={30} />
          </Link>
          <button
            type="button"
            onClick={() =>
              setSidebarCollapsed(
                (value) => !value,
              )
            }
            aria-label={
              compactSidebar
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            title={
              compactSidebar
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--wk-border)] text-[var(--wk-text-muted)] transition-colors hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)] lg:flex"
          >
            <WkIcon
              name={
                compactSidebar
                  ? "ChevronRight"
                  : "ChevronLeft"
              }
              size={16}
            />
          </button>
        </div>

        <nav className="space-y-1 px-3">
          <button
            type="button"
            onClick={() => setGlobalSearchOpen(true)}
            aria-label="Search"
            title={compactSidebar ? "Search" : undefined}
            className={[
              "relative flex min-h-11 w-full items-center rounded-xl text-[13px] font-semibold transition-colors",
              compactSidebar
                ? "justify-center px-0"
                : "gap-3 px-3",
              activeSection === "search"
                ? "bg-[var(--wk-surface-raised)] text-[var(--wk-text)]"
                : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]",
            ].join(" ")}
          >
            {activeSection === "search" ? (
              <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--wk-brand)]" />
            ) : null}
            <WkIcon
              name="Search"
              size={17}
              className={
                activeSection === "search"
                  ? "text-[var(--wk-brand)]"
                  : "text-[var(--wk-text-faint)]"
              }
            />
            {!compactSidebar ? <span>Search</span> : null}
          </button>

          {navigation.map((group) => (
            <div key={group.label}>
              {group.items.map((item) => (
                <AppNavLink
                  key={item.to}
                  {...item}
                  collapsed={compactSidebar}
                  active={isWakilishaNavCurrent(location.pathname, item.to)}
                />
              ))}
            </div>
          ))}
        </nav>
        <div
          className={[
            "mt-auto",
            compactSidebar
              ? "px-3 pb-4"
              : "p-4",
          ].join(" ")}
        >
          <div className="border-t border-[var(--wk-divider)] px-2 pt-3">
            {isSignedIn ? (
              <button
                type="button"
                onClick={() => { setMenuStartsInYou(true); setSmallScreenMenuOpen(true); }}
                aria-label="Open You"
                title="You"
                className={["flex min-h-12 w-full items-center rounded-xl text-left text-[13px] font-semibold text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]",
                  compactSidebar ? "justify-center" : "gap-3 px-2"].join(" ")}
              >
                {authUser.avatarUrl ? (
                  <img src={authUser.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]">
                    <WakilishaAccountMark size={21} />
                  </span>
                )}
                {!compactSidebar ? <span className="min-w-0 flex-1 truncate">
                  {authUser.name || authUser.email || "You"}
                </span> : null}
                {!compactSidebar ? <WkIcon name="ChevronDown" size={16} /> : null}
              </button>
            ) : (
              <div className={["flex items-center gap-1", compactSidebar ? "flex-col" : ""].join(" ")}>
                <Link to="/auth" aria-label="Sign In"
                  className={["flex min-h-11 min-w-11 items-center rounded-xl text-[13px] font-semibold text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]",
                    compactSidebar ? "justify-center" : "flex-1 gap-3 px-2"].join(" ")}>
                  <WakilishaAccountMark size={21} />
                  {!compactSidebar ? "Sign In" : null}
                </Link>
                <button type="button" onClick={toggle}
                  aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  title={theme === "dark" ? "Light mode" : "Dark mode"}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]">
                  <WkIcon name={theme === "dark" ? "Sun" : "Moon"} size={20} />
                </button>
                <Link to="/settings" aria-label="Settings" title="Settings"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]">
                  <WkIcon name="Settings" size={20} />
                </Link>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 pb-24">
        <div className="sticky top-0 z-40 flex h-[64px] items-center gap-3 border-b border-[var(--wk-border)] bg-[var(--wk-overlay)] px-4 backdrop-blur-xl md:hidden">
          <button
            type="button"
            aria-label="Open WAKILISHA menu"
            aria-expanded={smallScreenMenuOpen}
            aria-controls="wk-workbook-sidebar"
            onClick={() => { setMenuStartsInYou(false); setSmallScreenMenuOpen(true); }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--wk-border)] text-[var(--wk-text)]"
          >
            <WkIcon name="Menu" size={20} />
          </button>
          <Link to="/music" aria-label={displayName} className="min-w-0 flex-1">
            {<img
                src={resolvedLogoUrl}
                alt={displayName}
                onError={() => setLogoError(true)}
                className="h-7 max-w-[128px] object-contain object-left"
              />}
          </Link>

          <button
            type="button"
            onClick={() => setGlobalSearchOpen(true)}
            aria-label="Search"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text-muted)]"
          >
            <WkIcon name="Search" size={16} />
          </button>


        </div>

        <div className="min-h-screen">
          {children}
        </div>
      </div>
      <MobileAccountDrawer
        open={smallScreenMenuOpen}
        onClose={() => setSmallScreenMenuOpen(false)}
        onSearch={() => setGlobalSearchOpen(true)}
        startInYou={menuStartsInYou && isSignedIn}
        rail={compactSidebar}
      />
      <GlobalSearchSurface
        open={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
      />

    </div>
  );
}