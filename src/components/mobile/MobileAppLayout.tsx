import { useEffect, useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useSessionSignOut } from "@/hooks/useSessionSignOut";
import { useMessagesAccess } from "@/hooks/useMessagesAccess";
import { WkIcon } from "@/components/design-system/Icon";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { Portal } from "@/components/base/Portal";
import { MobileTopBar } from "./MobileTopBar";
import { usePendingCommunityActionReplay } from "@/hooks/usePendingCommunityActionReplay";

type MobileNavItem = {
  label: string;
  to: string;
  icon: string;
  prominent?: boolean;
};

const SIGNED_IN_NAV: MobileNavItem[] = [
  { label: "Following", to: "/following", icon: "UserPlus" },
  { label: "Charts", to: "/charts", icon: "BarChart3" },
  { label: "Home", to: "/", icon: "Home", prominent: true },
  { label: "Notifications", to: "/notifications", icon: "Bell" },
];

const SIGNED_IN_MESSAGES_NAV: MobileNavItem[] = [
  { label: "Following", to: "/following", icon: "UserPlus" },
  { label: "Charts", to: "/charts", icon: "BarChart3" },
  { label: "Home", to: "/", icon: "Home", prominent: true },
  { label: "Messages", to: "/messages", icon: "MessageSquare" },
];

const SIGNED_OUT_NAV: MobileNavItem[] = [
  { label: "Following", to: "/following", icon: "UserPlus" },
  { label: "Charts", to: "/charts", icon: "BarChart3" },
  { label: "Home", to: "/", icon: "Home", prominent: true },
  { label: "Artists", to: "/artists", icon: "Mic2" },
];

const MORE_LINKS = [
  { label: "Artist Studio", to: "/artist-studio", icon: "ri-user-star-line" },
  { label: "Genres", to: "/genres", icon: "ri-compass-3-line" },
  { label: "Labels", to: "/labels", icon: "ri-album-line" },
  { label: "Guides", to: "/guides", icon: "ri-map-2-line" },
  { label: "About", to: "/about", icon: "ri-information-line" },
  { label: "Contact", to: "/contact", icon: "ri-mail-line" },
  { label: "FAQs", to: "/faqs", icon: "ri-question-line" },
  { label: "Privacy", to: "/privacy", icon: "ri-shield-check-line" },
  { label: "Terms", to: "/terms", icon: "ri-file-text-line" },
] as const;

const WAKILISHA_THUNDERBOLT_URL =
  "https://media.wakilisha.africa/uploads/1782585460487-2ef3876f-wakilisha-thunderbolt.png";

function MobileBottomNav({ scrollVisible }: { scrollVisible: boolean }) {
  const location = useLocation();
  const authUser = useAuthUser();
  const messagesAccess = useMessagesAccess();
  const { theme, toggle } = useTheme();
  const { signOut, signingOut, signOutError } = useSessionSignOut("/auth");
  const [moreOpen, setMoreOpen] = useState(false);
  const isLoggedIn =
    !authUser.loading
    && authUser.id.length > 0;
  const navItems =
    isLoggedIn
      ? messagesAccess.visible
        ? SIGNED_IN_MESSAGES_NAV
        : SIGNED_IN_NAV
      : SIGNED_OUT_NAV;

  const isActive = (path: string) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(path);

  const moreIsActive =
    MORE_LINKS.some(
      (item) =>
        location.pathname.startsWith(
          item.to,
        ),
    )
    || location.pathname.startsWith(
      "/profile",
    )
    || location.pathname.startsWith(
      "/search",
    );

  useScrollLock(moreOpen);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  if (location.pathname === "/auth") {
    return null;
  }

  const chromeVisible =
    scrollVisible || moreOpen;

  return (
    <>
      <nav
        className="phn-nav phn-nav--compact"
        aria-label="Primary mobile navigation"
        style={{
          visibility:
            chromeVisible
              ? "visible"
              : "hidden",
          opacity:
            chromeVisible
              ? 1
              : 0,
          transform:
            chromeVisible
              ? "translateY(0) translateZ(0)"
              : "translateY(16px) translateZ(0)",
          transition:
            "opacity 0.28s cubic-bezier(.16,1,.3,1), transform 0.28s cubic-bezier(.16,1,.3,1), visibility 0.28s",
        }}
      >
        {navItems.map((item) => {
          const active =
            isActive(item.to);

          return (
            <Link
              key={item.to}
              to={item.to}
              aria-label={
                item.prominent
                  ? item.label
                  : undefined
              }
              className={`phn-nav-tab ${
                active ? "on" : ""
              } ${
                item.prominent
                  ? "phn-nav-primary"
                  : ""
              }`}
            >
              {item.prominent ? (
                <>
                  <span className="phn-nav-primary-core">
                    <img
                      src={WAKILISHA_THUNDERBOLT_URL}
                      alt=""
                      aria-hidden="true"
                      className="h-7 w-7 object-contain"
                    />
                  </span>
                  <span className="sr-only">
                    {item.label}
                  </span>
                </>
              ) : (
                <>
                  <WkIcon
                    name={item.icon as any}
                    size={19}
                  />
                  <span className="pnl">
                    {item.label}
                  </span>
                </>
              )}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() =>
            setMoreOpen(
              (current) => !current,
            )
          }
          className={`phn-nav-tab ${
            moreIsActive || moreOpen
              ? "on"
              : ""
          }`}
          aria-label="More"
          aria-expanded={moreOpen}
          aria-controls="wk-mobile-more-menu"
        >
          <WkIcon
            name="Menu"
            size={19}
          />
          <span className="pnl">
            More
          </span>
        </button>
      </nav>

      {moreOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[83] bg-black/50"
            onClick={() =>
              setMoreOpen(false)
            }
            aria-label="Close More menu"
          />

          <section
            id="wk-mobile-more-menu"
            role="dialog"
            aria-modal="true"
            aria-label="More"
            className="fixed bottom-[calc(52px+max(env(safe-area-inset-bottom),8px)+12px)] left-3 right-3 z-[84] rounded-[24px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 shadow-2xl"
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[20px] font-black tracking-[-0.025em] text-[var(--wk-text)]">
                  More
                </h2>
                <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">
                  More ways into WAKILISHA.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setMoreOpen(false)
                }
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"
                aria-label="Close More menu"
              >
                <WkIcon
                  name="X"
                  size={17}
                />
              </button>
            </div>

            <div className={`mb-3 grid ${isLoggedIn ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
              <Link
                to="/search"
                className="flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-2 py-2 text-[11px] font-bold text-[var(--wk-text)]"
              >
                <WkIcon
                  name="Search"
                  size={18}
                />
                <span>Search</span>
              </Link>

              <Link
                to={
                  isLoggedIn
                    ? "/profile"
                    : "/auth"
                }
                className="flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-2 py-2 text-[11px] font-bold text-[var(--wk-text)]"
              >
                {authUser.avatarUrl ? (
                  <img
                    src={authUser.avatarUrl}
                    alt=""
                    className="h-[18px] w-[18px] rounded-full object-cover"
                  />
                ) : (
                  <WkIcon
                    name="User"
                    size={18}
                  />
                )}
                <span>
                  {isLoggedIn
                    ? "Profile"
                    : "Sign In"}
                </span>
              </Link>

              {isLoggedIn && (
                <Link
                  to="/artists"
                  className="flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-2 py-2 text-[11px] font-bold text-[var(--wk-text)]"
                >
                  <WkIcon
                    name="Mic2"
                    size={18}
                  />
                  <span>Artists</span>
                </Link>
              )}
            </div>

            <div className="max-h-[42dvh] overflow-y-auto overscroll-contain pr-0.5">
              <nav
                className="grid grid-cols-2 gap-2"
                aria-label="More WAKILISHA destinations"
              >
                {MORE_LINKS.map(
                  (item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex min-h-13 items-center gap-3 rounded-2xl border px-3.5 py-3 text-[13px] font-bold transition-colors ${
                        isActive(item.to)
                          ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                          : "border-[var(--wk-border)] bg-[var(--wk-bg)] text-[var(--wk-text)]"
                      }`}
                    >
                      <i
                        className={`${item.icon} text-[17px] text-[var(--wk-brand)]`}
                      />
                      <span>
                        {item.label}
                      </span>
                    </Link>
                  ),
                )}
              </nav>

              <div className="mt-4 border-t border-[var(--wk-divider)] pt-4">
                <button
                  type="button"
                  onClick={toggle}
                  className="flex min-h-13 w-full items-center justify-between gap-3 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-left"
                  aria-label={
                    theme === "dark"
                      ? "Switch to light mode"
                      : "Switch to dark mode"
                  }
                >
                  <span className="flex items-center gap-3">
                    <WkIcon
                      name={
                        theme === "dark"
                          ? "Sun"
                          : "Moon"
                      }
                      size={18}
                    />
                    <span className="text-[13px] font-bold text-[var(--wk-text)]">
                      Appearance
                    </span>
                  </span>
                  <span className="text-[12px] font-semibold text-[var(--wk-text-muted)]">
                    {theme === "dark"
                      ? "Light Mode"
                      : "Dark Mode"}
                  </span>
                </button>

                {isLoggedIn ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void signOut()}
                      disabled={signingOut}
                      className="mt-2 flex min-h-13 w-full items-center gap-3 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-left text-[13px] font-bold text-[var(--wk-text)] disabled:cursor-wait disabled:opacity-60"
                    >
                      <WkIcon name="LogOut" size={18} />
                      <span>{signingOut ? "Signing out" : "Sign out"}</span>
                    </button>
                    {signOutError ? (
                      <p role="alert" className="mt-2 px-1 text-[12px] font-semibold text-[var(--wk-danger)]">
                        {signOutError}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}

export function MobileAppLayout() {
  const location = useLocation();
  const scrollChrome = useScrollDirection();
  const { currentTrack } = usePlayer();
  const authUser = useAuthUser();
  const showMobileChrome =
    location.pathname !== "/auth";
  const showCompactPlayer =
    Boolean(currentTrack) &&
    showMobileChrome;
  usePendingCommunityActionReplay(
    !authUser.loading ? authUser.id : undefined,
    !authUser.loading && authUser.isEmailVerified
  );

  if (location.pathname === "/auth") {
    return (
      <div className="wk-app-shell min-h-[100dvh] flex flex-col">
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div
      className="wk-app-shell min-h-[100dvh] flex flex-col relative"
      style={{
        paddingBottom: showCompactPlayer
          ? "calc(52px + max(env(safe-area-inset-bottom), 8px) + 12px + 60px + 12px)"
          : "calc(52px + max(env(safe-area-inset-bottom), 8px) + 12px)",
      }}
    >
      {showMobileChrome && (
        <MobileTopBar
          scrollVisible={scrollChrome.topVisible}
        />
      )}
      <main className="flex-1">
        <Outlet />
      </main>
      {showMobileChrome && (
        <Portal>
          <MobileBottomNav
            scrollVisible={scrollChrome.visible}
          />
        </Portal>
      )}
    </div>
  );
}
