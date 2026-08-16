import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Link,
  useLocation,
  useNavigate,
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
import {
  useAuthUser,
} from "@/hooks/useAuthUser";
import {
  listMyArtistRepresentations,
} from "@/services/artists/artistRepresentationChoices";
import {
  getArtistRepresentationState,
} from "@/services/artists/claimedArtist";

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
] as const;

const MUSIC_SIDEBAR_COLLAPSED_KEY =
  "wk-music-sidebar-collapsed";
const ARTIST_STUDIO_MEMORY_KEY =
  "wk-artist-studio-last-artist";

type ArtistStudioIntent =
  | "home"
  | "music";

type StudioArtistChoice = {
  id: string;
  slug: string;
  name: string;
  imageUrl?: string | null;
  country?: string | null;
  canSubmitMusic?: boolean;
};

function readStudioArtistMemory():
  StudioArtistChoice | null {
  try {
    const raw =
      window.localStorage.getItem(
        ARTIST_STUDIO_MEMORY_KEY,
      );

    if (!raw) return null;

    const parsed =
      JSON.parse(raw) as
        Partial<StudioArtistChoice>;

    if (
      typeof parsed.id !== "string" ||
      typeof parsed.slug !== "string" ||
      typeof parsed.name !== "string" ||
      !parsed.id ||
      !parsed.slug ||
      !parsed.name
    ) {
      return null;
    }

    return {
      id: parsed.id,
      slug: parsed.slug,
      name: parsed.name,
      imageUrl:
        typeof parsed.imageUrl ===
        "string"
          ? parsed.imageUrl
          : null,
      country:
        typeof parsed.country ===
        "string"
          ? parsed.country
          : null,
    };
  } catch {
    return null;
  }
}

function rememberStudioArtist(
  artist: StudioArtistChoice,
) {
  try {
    window.localStorage.setItem(
      ARTIST_STUDIO_MEMORY_KEY,
      JSON.stringify({
        id: artist.id,
        slug: artist.slug,
        name: artist.name,
        imageUrl:
          artist.imageUrl ?? null,
        country:
          artist.country ?? null,
      }),
    );
  } catch {
    // Direct navigation still works if storage is unavailable.
  }
}

function forgetStudioArtist() {
  try {
    window.localStorage.removeItem(
      ARTIST_STUDIO_MEMORY_KEY,
    );
  } catch {
    // No-op.
  }
}

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
  const navigate = useNavigate();
  const user = useAuthUser();
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
    studioLauncherOpen,
    setStudioLauncherOpen,
  ] = useState(false);
  const [
    studioIntent,
    setStudioIntent,
  ] =
    useState<ArtistStudioIntent>(
      "home",
    );
  const [
    studioArtists,
    setStudioArtists,
  ] = useState<StudioArtistChoice[]>([]);
  const [
    studioSearch,
    setStudioSearch,
  ] = useState("");
  const [
    studioArtistsLoading,
    setStudioArtistsLoading,
  ] = useState(false);
  const [
    studioBusyArtistId,
    setStudioBusyArtistId,
  ] = useState<string | null>(
    null,
  );
  const [
    studioMessage,
    setStudioMessage,
  ] = useState<string | null>(
    null,
  );
  const [
    studioAccessArtist,
    setStudioAccessArtist,
  ] =
    useState<StudioArtistChoice | null>(
      null,
    );

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

  const filteredStudioArtists =
    useMemo(() => {
      const query =
        studioSearch
          .trim()
          .toLowerCase();

      const availableArtists =
        studioIntent === "music"
          ? studioArtists.filter(
              (artist) =>
                artist.canSubmitMusic,
            )
          : studioArtists;

      const candidates =
        query
          ? availableArtists.filter(
              (artist) =>
                artist.name
                  .toLowerCase()
                  .includes(query) ||
                artist.slug
                  .toLowerCase()
                  .includes(query) ||
                (
                  artist.country ??
                  ""
                )
                  .toLowerCase()
                  .includes(query),
            )
          : availableArtists;

      return candidates.slice(0, 8);
    }, [
      studioArtists,
      studioSearch,
      studioIntent,
    ]);

  function studioManagePath(
    artist: StudioArtistChoice,
    intent: ArtistStudioIntent,
  ) {
    const base =
      `/artists/${artist.slug}/manage`;

    return intent === "music"
      ? `${base}?section=music`
      : base;
  }

  async function loadStudioArtists() {
    if (
      studioArtists.length ||
      studioArtistsLoading
    ) {
      return;
    }

    setStudioArtistsLoading(true);

    try {
      const representations =
        await listMyArtistRepresentations();

      setStudioArtists(
        representations
          .filter(
            (item) =>
              item.status === "active",
          )
          .map(
            (item) => ({
              id: item.artist.id,
              slug: item.artist.slug,
              name: item.artist.name,
              imageUrl:
                item.artist.imageUrl,
              country: null,
              canSubmitMusic:
                item.permissions.releases,
            }),
          ),
      );
    } catch {
      setStudioMessage(
        "We could not load your Artists right now.",
      );
    } finally {
      setStudioArtistsLoading(false);
    }
  }

  function showStudioLauncher(
    intent: ArtistStudioIntent,
    message?: string,
  ) {
    setStudioIntent(intent);
    setStudioMessage(
      message ?? null,
    );
    setStudioAccessArtist(null);
    setStudioSearch("");
    setStudioLauncherOpen(true);
    void loadStudioArtists();
  }

  async function openStudioArtist(
    artist: StudioArtistChoice,
    intent: ArtistStudioIntent,
  ) {
    setStudioBusyArtistId(
      artist.id,
    );
    setStudioMessage(null);
    setStudioAccessArtist(null);

    try {
      const state =
        await getArtistRepresentationState(
          artist.id,
        );

      const representation =
        state.representation?.status ===
        "active"
          ? state.representation
          : null;

      if (!representation) {
        forgetStudioArtist();
        setStudioIntent(intent);
        setStudioAccessArtist(
          artist,
        );
        setStudioMessage(
          `This account does not currently manage ${artist.name}. Open the Artist page to claim it or accept an invitation.`,
        );
        setStudioLauncherOpen(
          true,
        );
        void loadStudioArtists();
        return;
      }

      if (
        intent === "music" &&
        !representation.permissions
          .releases
      ) {
        setStudioIntent(intent);
        setStudioAccessArtist(
          artist,
        );
        setStudioMessage(
          `Your access to ${artist.name} does not include Music submissions.`,
        );
        setStudioLauncherOpen(
          true,
        );
        void loadStudioArtists();
        return;
      }

      rememberStudioArtist(
        artist,
      );
      setStudioLauncherOpen(
        false,
      );
      navigate(
        studioManagePath(
          artist,
          intent,
        ),
      );
    } catch {
      setStudioMessage(
        "We could not confirm your Artist Studio access.",
      );
    } finally {
      setStudioBusyArtistId(
        null,
      );
    }
  }

  async function beginStudio(
    intent: ArtistStudioIntent,
  ) {
    if (user.loading) {
      return;
    }

    if (!user.id) {
      const returnTo =
        location.pathname ||
        "/music";

      navigate(
        `/auth?returnTo=${encodeURIComponent(
          returnTo,
        )}`,
      );
      return;
    }

    const remembered =
      readStudioArtistMemory();

    if (remembered) {
      await openStudioArtist(
        remembered,
        intent,
      );
      return;
    }

    if (!remembered) {
      showStudioLauncher(
        intent,
      );
    }
  }

  const activeSection =
    useMemo(() => {
      const pathname =
        location.pathname;

      if (pathname === "/") {
        return "posts";
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
        return "posts";
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
            label="Posts"
            collapsed={sidebarCollapsed}
            active={
              activeSection ===
              "posts"
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
              <button
  type="button"
  onClick={() =>
    void beginStudio(
      "home",
    )
  }
  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--wk-surface-raised)] px-3 py-2 text-[11px] font-bold text-[var(--wk-text)] transition-colors hover:bg-[var(--wk-surface-strong)]"
>
                Artist Studio
                <WkIcon
                  name="ArrowUpRight"
                  size={13}
                />
              </button>
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
        <div className="sticky top-0 z-40 flex h-[76px] items-center gap-4 border-b border-[var(--wk-border)] bg-[var(--wk-overlay)] px-4 backdrop-blur-xl sm:px-6 xl:px-8">
          <Link
            to="/music"
            aria-label={displayName}
            className="shrink-0 lg:hidden"
          >
            {showLogo ? (
              <img
                src={selectedLogoUrl}
                alt={displayName}
                onError={() =>
                  setLogoError(true)
                }
                className="h-7 max-w-[128px] object-contain object-left"
              />
            ) : (
              <span className="text-[17px] font-black tracking-[-0.04em] text-[var(--wk-text)]">
                {displayName}
              </span>
            )}
          </Link>

          <Link
            to="/search"
            className="flex h-11 min-w-0 max-w-[660px] flex-1 items-center gap-3 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 text-[12px] font-medium text-[var(--wk-text-muted)] transition-colors hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text-soft)]"
          >
            <WkIcon
              name="Search"
              size={16}
            />
            <span className="truncate">
              Search artists, songs, albums, scenes...
            </span>
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
  type="button"
  onClick={() =>
    void beginStudio(
      "music",
    )
  }
  className="hidden h-10 items-center gap-2 rounded-full border border-[var(--wk-border-2)] bg-[var(--wk-surface)] px-4 text-[11px] font-bold text-[var(--wk-text)] transition-colors hover:bg-[var(--wk-surface-raised)] sm:inline-flex"
>
              <WkIcon
                name="Upload"
                size={14}
              />
              Upload Music
            </button>

            <button
              type="button"
              onClick={toggle}
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text-muted)] transition-colors hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
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
              to="/profile"
              aria-label="Profile"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text-muted)]"
            >
              <WkIcon
                name="UserRound"
                size={16}
              />
            </Link>
          </div>
        </div>

        <div className="min-h-[calc(100vh-76px)]">
          {children}
        </div>
      </div>
      {studioLauncherOpen ? (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setStudioLauncherOpen(
                false,
              );
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="artist-studio-launcher-title"
            className="max-h-[min(720px,88vh)] w-full max-w-[620px] overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--wk-border)] p-5">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
                  {studioIntent ===
                  "music"
                    ? "Music Submission"
                    : "Artist Access"}
                </div>
                <h2
                  id="artist-studio-launcher-title"
                  className="mt-1 text-[22px] font-black tracking-[-0.035em] text-[var(--wk-text)]"
                >
                  {studioIntent ===
                  "music"
                    ? "Upload Music"
                    : "Artist Studio"}
                </h2>
                <p className="mt-2 text-[12px] font-medium leading-relaxed text-[var(--wk-text-muted)]">
                  Choose the Artist you represent on WAKILISHA.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setStudioLauncherOpen(
                    false,
                  )
                }
                aria-label="Close Artist Studio launcher"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--wk-border)] text-[var(--wk-text-muted)] transition-colors hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
              >
                ×
              </button>
            </div>

            <div className="p-5">
              <label className="flex h-11 items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3">
                <WkIcon
                  name="Search"
                  size={15}
                  className="text-[var(--wk-text-faint)]"
                />
                <input
                  value={
                    studioSearch
                  }
                  onChange={(event) =>
                    setStudioSearch(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Search the Registry"
                  className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-[var(--wk-text)] outline-none placeholder:text-[var(--wk-text-faint)]"
                />
              </label>

              {studioMessage ? (
                <div className="mt-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-3">
                  <p className="text-[11px] font-semibold leading-relaxed text-[var(--wk-text-muted)]">
                    {studioMessage}
                  </p>

                  {studioAccessArtist ? (
                    <button
                      type="button"
                      onClick={() => {
                        setStudioLauncherOpen(
                          false,
                        );
                        navigate(
                          `/artists/${studioAccessArtist.slug}`,
                        );
                      }}
                      className="mt-3 inline-flex items-center gap-2 text-[11px] font-black text-[var(--wk-brand)]"
                    >
                      Open {studioAccessArtist.name}
                      <WkIcon
                        name="ArrowRight"
                        size={13}
                      />
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 max-h-[430px] space-y-2 overflow-y-auto pr-1">
                {studioArtistsLoading ? (
                  <div className="py-10 text-center text-[11px] font-semibold text-[var(--wk-text-muted)]">
                    Loading the Registry...
                  </div>
                ) : null}

                {!studioArtistsLoading &&
                filteredStudioArtists
                  .length === 0 ? (
                  <div className="py-10 text-center text-[11px] font-semibold text-[var(--wk-text-muted)]">
                    No Artists match that search.
                  </div>
                ) : null}

                {filteredStudioArtists.map(
                  (artist) => {
                    const busy =
                      studioBusyArtistId ===
                      artist.id;

                    return (
                      <button
                        key={
                          artist.id
                        }
                        type="button"
                        disabled={
                          Boolean(
                            studioBusyArtistId,
                          )
                        }
                        onClick={() =>
                          void openStudioArtist(
                            artist,
                            studioIntent,
                          )
                        }
                        className="flex w-full items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-3 text-left transition-colors hover:bg-[var(--wk-surface-raised)] disabled:opacity-60"
                      >
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                          {artist.imageUrl ? (
                            <img
                              src={
                                artist.imageUrl
                              }
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[14px] font-black text-[var(--wk-brand)]">
                              {artist.name
                                .slice(
                                  0,
                                  1,
                                )
                                .toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-black text-[var(--wk-text)]">
                            {artist.name}
                          </div>
                          <div className="mt-1 truncate text-[10px] font-semibold text-[var(--wk-text-muted)]">
                            {artist.country ||
                              "WAKILISHA Registry"}
                          </div>
                        </div>

                        <span className="shrink-0 text-[10px] font-black text-[var(--wk-brand)]">
                          {busy
                            ? "Checking..."
                            : studioIntent ===
                                "music"
                              ? "Add Music"
                              : "Open"}
                        </span>
                      </button>
                    );
                  },
                )}
              </div>

              <p className="mt-4 text-[10px] font-medium leading-relaxed text-[var(--wk-text-faint)]">
                Artist access is checked against WAKILISHA representation authority before Studio opens.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
