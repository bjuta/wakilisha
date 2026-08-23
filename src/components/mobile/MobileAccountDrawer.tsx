import { WakilishaAccountMark } from "@/components/brand/WakilishaAccountMark";
import {
  useEffect,
} from "react";
import {
  Link,
  useLocation,
} from "react-router-dom";
import {
  Portal,
} from "@/components/base/Portal";
import {
  WkIcon,
  type WkIconName,
} from "@/components/design-system/Icon";
import {
  useTheme,
} from "@/components/design-system/theme/ThemeProvider";
import {
  useAuthUser,
} from "@/hooks/useAuthUser";
import {
  useScrollLock,
} from "@/hooks/useScrollLock";

type DrawerLink = {
  label: string;
  to: string;
  icon: WkIconName;
};

const PRIMARY_LINKS: DrawerLink[] = [
  { label: "Music", to: "/music", icon: "AudioLines" },
  { label: "Following", to: "/following", icon: "Heart" },
  { label: "Charts", to: "/charts", icon: "BarChart3" },
  { label: "Playlists", to: "/playlists", icon: "ListMusic" },
  { label: "Artists", to: "/artists", icon: "Users" },
  { label: "Releases", to: "/releases", icon: "Disc3" },
  { label: "Posts", to: "/", icon: "NotebookText" },
];

const DISCOVER_LINKS: DrawerLink[] = [
  { label: "New This Week", to: "/music?section=new-this-week", icon: "CirclePlus" },
  { label: "On The Radar", to: "/music?section=on-the-radar", icon: "Radar" },
  { label: "Scenes", to: "/music?section=scenes", icon: "RadioTower" },
  { label: "From The Registry", to: "/music?section=registry", icon: "BadgeCheck" },
  { label: "Go Deeper", to: "/music?section=go-deeper", icon: "Compass" },
];

function DrawerNavLink({
  item,
  onNavigate,
}: {
  item: DrawerLink;
  onNavigate: () => void;
}) {
  const location = useLocation();
  const active = item.to === "/"
    ? location.pathname === "/"
    : location.pathname === item.to.split("?")[0]
      || location.pathname.startsWith(`${item.to.split("?")[0]}/`);

  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={[
        "flex min-h-12 items-center gap-4 rounded-2xl px-3.5 py-2.5 text-[15px] font-black transition-colors",
        active
          ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
          : "text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]",
      ].join(" ")}
    >
      <WkIcon name={item.icon} size={20} />
      <span>{item.label}</span>
    </Link>
  );
}

export function MobileAccountDrawer({
  open,
  onClose,
  onSearch,
}: {
  open: boolean;
  onClose: () => void;
  onSearch: () => void;
}) {
  const authUser = useAuthUser();
  const { theme, toggle } = useTheme();
  const signedIn = Boolean(authUser.id);
  const displayName = signedIn
    ? authUser.name?.trim()
      || authUser.email?.split("@")[0]
      || "WAKILISHA"
    : "Your people are here.";
  const initial =
    displayName.slice(0, 1).toUpperCase() || "W";

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[170]" role="presentation">
        <button
          type="button"
          className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
          onClick={onClose}
          aria-label="Close account menu"
        />

        <aside
          data-scroll-lock="container"
          role="dialog"
          aria-modal="true"
          aria-label="WAKILISHA Menu"
          className="absolute inset-y-0 left-0 flex w-[min(88vw,360px)] flex-col overflow-hidden border-r border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-2xl"
          style={{
            paddingTop: "max(env(safe-area-inset-top), 12px)",
            paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
            animation: "wkAccountDrawerIn 220ms cubic-bezier(.16,1,.3,1)",
          }}
        >
          <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-2">
            <div className="min-w-0">
              <div className="h-14 w-14 overflow-hidden rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] shadow-sm">
                {authUser.avatarUrl ? (
                  <img
                    src={authUser.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[19px] font-black text-[var(--wk-text)]">
                    {signedIn ? (
                  initial
                ) : (
                  <WakilishaAccountMark size={32} />
                )}
                  </span>
                )}
              </div>
              <div className="mt-3 truncate text-[18px] font-black tracking-[-0.02em] text-[var(--wk-text)]">
                {displayName}
              </div>
              <div className="mt-0.5 truncate text-[12px] font-semibold text-[var(--wk-text-muted)]">
                {authUser.email || (signedIn ? "WAKILISHA listener" : "Sign in to keep your place")}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"
              aria-label="Close account menu"
            >
              <WkIcon name="X" size={18} />
            </button>
          </div>

          <div className="border-y border-[var(--wk-divider)] px-4 py-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                onSearch();
              }}
              className="flex min-h-12 w-full items-center gap-4 rounded-2xl px-3.5 py-2.5 text-left text-[15px] font-black text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]"
            >
              <WkIcon name="Search" size={20} />
              <span>Search</span>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            <nav aria-label="WAKILISHA">
              <div className="space-y-0.5">
                {PRIMARY_LINKS.map((item) => (
                  <DrawerNavLink key={item.label} item={item} onNavigate={onClose} />
                ))}
              </div>

              <div className="mb-2 mt-5 px-3.5 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--wk-text-faint)]">
                Discover
              </div>
              <div className="space-y-0.5">
                {DISCOVER_LINKS.map((item) => (
                  <DrawerNavLink key={item.label} item={item} onNavigate={onClose} />
                ))}
              </div>
            </nav>
          </div>

          <div className="border-t border-[var(--wk-divider)] px-4 pt-3">
            <button
              type="button"
              onClick={toggle}
              className="flex min-h-12 w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-[14px] font-black text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]"
            >
              <span className="flex items-center gap-4">
                <WkIcon name={theme === "dark" ? "Sun" : "Moon"} size={20} />
                <span>Appearance</span>
              </span>
              <span className="text-[11px] font-bold text-[var(--wk-text-muted)]">
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </span>
            </button>

            <Link
              to="/settings"
              onClick={onClose}
              className="flex min-h-12 items-center gap-4 rounded-2xl px-3.5 py-2.5 text-[14px] font-black text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]"
            >
              <WkIcon name="Settings" size={20} />
              <span>Settings</span>
            </Link>

            <Link
              to={signedIn ? "/profile" : "/auth"}
              onClick={onClose}
              className="flex min-h-12 items-center gap-4 rounded-2xl px-3.5 py-2.5 text-[14px] font-black text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]"
            >
              <WkIcon name={signedIn ? "User" : "LogIn"} size={20} />
              <span>{signedIn ? "Profile" : "Sign In"}</span>
            </Link>
          </div>
        </aside>
      </div>

      <style>{`
        @keyframes wkAccountDrawerIn {
          from { transform: translateX(-18px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </Portal>
  );
}
