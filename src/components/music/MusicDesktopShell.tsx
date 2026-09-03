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
      title={collapsed ? label : undefined}
      className={[
        "relative flex h-10 items-center rounded-lg text-[13px] font-semibold transition-colors",
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
        "flex h-9 items-center rounded-lg text-[12px] font-semibold text-[var(--wk-text-muted)] transition-colors hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]",
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
  const {
    theme,
    toggle,
  } = useTheme();
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

  const showLogo =
    selectedLogoUrl
      .trim()
      .length > 0 &&
    !logoError;

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
    <div className="wk-music-app-shell min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)] lg:flex">
      <aside
        className={[
          "sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto overscroll-contain border-r border-[var(--wk-border)] bg-[var(--wk-surface)] transition-[width] duration-200 ease-out [scrollbar-width:thin] lg:flex",
          sidebarCollapsed
            ? "w-[72px]"
            : "w-[270px]",
        ].join(" ")}
      >
        <div
          className={[
            "sticky top-0 z-10 flex min-h-[82px] shrink-0 items-center border-b border-[var(--wk-border)] bg-[var(--wk-surface)]/95 backdrop-blur",
            sidebarCollapsed
              ? "justify-center px-2"
              : "justify-between gap-3 px-5",
          ].join(" ")}
        >
          {!sidebarCollapsed ? (
            <Link
              to="/music"
              aria-label={displayName}
              className="flex min-w-0 items-center"
            >
              {showLogo ? (
                <img
                  src={selectedLogoUrl}
                  alt={displayName}
                  onError={() =>
                    setLogoError(true)
                  }
                  className="h-8 max-w-[158px] object-contain object-left"
                />
              ) : (
                <span className="text-[22px] font-black tracking-[-0.045em] text-[var(--wk-text)]">
                  {displayName}
                </span>
              )}
            </Link>
          ) : null}

          <button
            type="button"
            onClick={() =>
              setSidebarCollapsed(
                (value) => !value,
              )
            }
            aria-label={
              sidebarCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            title={
              sidebarCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--wk-border)] text-[var(--wk-text-muted)] transition-colors hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
          >
            <WkIcon
              name={
                sidebarCollapsed
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
            title={sidebarCollapsed ? "Search" : undefined}
            className={[
              "relative flex h-10 w-full items-center rounded-lg text-[13px] font-semibold transition-colors",
              sidebarCollapsed
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
            {!sidebarCollapsed ? <span>Search</span> : null}
          </button>

          <AppNavLink
            to="/music"
            icon="AudioLines"
            label="Music"
            collapsed={sidebarCollapsed}
            active={
              activeSection ===
              "music"
            }
          />
          <AppNavLink
            to="/following"
            icon="Heart"
            label="Following"
            collapsed={sidebarCollapsed}
            active={
              activeSection ===
              "following"
            }
          />
          <AppNavLink
            to="/charts"
            icon="ChartNoAxesColumnIncreasing"
            label="Charts"
            collapsed={sidebarCollapsed}
            active={
              activeSection ===
              "charts"
            }
          />
          <AppNavLink
            to="/playlists"
            icon="ListMusic"
            label="Playlists"
            collapsed={sidebarCollapsed}
            active={
              activeSection ===
              "playlists"
            }
          />
          <AppNavLink
            to="/artists"
            icon="Users"
            label="Artists"
            collapsed={sidebarCollapsed}
            active={
              activeSection ===
              "artists"
            }
          />
          <AppNavLink
            to="/releases"
            icon="Disc3"
            label="Releases"
            collapsed={sidebarCollapsed}
            active={
              activeSection ===
              "releases"
            }
          />
          <AppNavLink
            to="/magazine"
            icon="NotebookText"
            label="Magazine"
            collapsed={sidebarCollapsed}
            active={
              activeSection ===
              "magazine"
            }
          />
        </nav>

        {!sidebarCollapsed ? (
          <div className="mt-6 px-6 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--wk-text-faint)]">
            Discover
          </div>
        ) : (
          <div className="mx-4 mt-5 h-px bg-[var(--wk-divider)]" />
        )}

        <nav className="mt-2 space-y-0.5 px-3">
          <DiscoveryLink
            to="/music#fresh-arrivals"
            icon="PlusCircle"
            label="New This Week"
            collapsed={sidebarCollapsed}
          />
          <DiscoveryLink
            to="/music#on-the-radar"
            icon="Radar"
            label="On The Radar"
            collapsed={sidebarCollapsed}
          />
          <DiscoveryLink
            to="/genres"
            icon="Radio"
            label="Scenes"
            collapsed={sidebarCollapsed}
          />
          <DiscoveryLink
            to="/artists"
            icon="BadgeCheck"
            label="From The Registry"
            collapsed={sidebarCollapsed}
          />
          <DiscoveryLink
            to="/music#go-deeper"
            icon="Compass"
            label="Go Deeper"
            collapsed={sidebarCollapsed}
          />
        </nav>

        <div
          className={[
            "mt-auto",
            sidebarCollapsed
              ? "px-3 pb-4"
              : "p-4",
          ].join(" ")}
        >
          {!sidebarCollapsed ? (
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-4">
              <div className="text-[11px] font-black text-[var(--wk-brand)]">
                Are you an Artist?
              </div>
              <p className="mt-2 text-[11px] font-medium leading-relaxed text-[var(--wk-text-muted)]">
                Put your music in front of people discovering WAKILISHA.
              </p>
              <Link
                to="/artist-studio"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--wk-surface-raised)] px-3 py-2 text-[11px] font-bold text-[var(--wk-text)] transition-colors hover:bg-[var(--wk-surface-strong)]"
              >
                Artist Studio
                <WkIcon
                  name="ArrowUpRight"
                  size={13}
                />
              </Link>
            </div>
          ) : null}

          <div
            className={[
              "border-t border-[var(--wk-divider)] pt-4",
              sidebarCollapsed
                ? "flex flex-col items-center gap-2"
                : "mt-5 flex items-center gap-2",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={toggle}
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--wk-border)] text-[var(--wk-text-muted)] transition-colors hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
            >
              <WkIcon
                name={
                  theme === "dark"
                    ? "Sun"
                    : "Moon"
                }
                size={15}
              />
            </button>

            <Link
              to="/settings"
              aria-label="Settings"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--wk-border)] text-[var(--wk-text-muted)] transition-colors hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
            >
              <WkIcon
                name="Settings"
                size={15}
              />
            </Link>

            <Link
              to="/profile"
              aria-label="Profile"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--wk-border)] text-[var(--wk-text-muted)] transition-colors hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
            >
              <WkIcon
                name="UserRound"
                size={15}
              />
            </Link>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 pb-24">
        <div className="sticky top-0 z-40 flex h-[64px] items-center gap-3 border-b border-[var(--wk-border)] bg-[var(--wk-overlay)] px-4 backdrop-blur-xl lg:hidden">
          <Link to="/music" aria-label={displayName} className="min-w-0 flex-1">
            {showLogo ? (
              <img
                src={selectedLogoUrl}
                alt={displayName}
                onError={() => setLogoError(true)}
                className="h-7 max-w-[128px] object-contain object-left"
              />
            ) : (
              <span className="truncate text-[17px] font-black tracking-[-0.04em] text-[var(--wk-text)]">
                {displayName}
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={() => setGlobalSearchOpen(true)}
            aria-label="Search"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text-muted)]"
          >
            <WkIcon name="Search" size={16} />
          </button>

          <Link
            to="/profile"
            aria-label="Profile"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text-muted)]"
          >
            <WkIcon name="UserRound" size={16} />
          </Link>
        </div>

        <div className="min-h-screen">
          {children}
        </div>
      </div>
      <GlobalSearchSurface
        open={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
      />

    </div>
  );
}