import { WakilishaAccountMark } from "@/components/brand/WakilishaAccountMark";
import {
  Link,
  useLocation,
} from "react-router-dom";
import { Dialog, Modal as AriaModal, ModalOverlay } from "react-aria-components";
import { WkIcon } from "@/components/design-system/Icon";
import { WAKILISHA_NAVIGATION, isWakilishaNavCurrent, type WkNavDestination } from "@/components/navigation/wakilishaNavigation";
import {
  useTheme,
} from "@/components/design-system/theme/ThemeProvider";
import {
  useAuthUser,
} from "@/hooks/useAuthUser";
import { useSessionSignOut } from "@/hooks/useSessionSignOut";

function DrawerNavLink({
  item,
  onNavigate,
}: {
  item: WkNavDestination;
  onNavigate: () => void;
}) {
  const location = useLocation();
  const active = isWakilishaNavCurrent(location.pathname, item.to);

  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={[
        "flex min-h-12 items-center gap-4 rounded-2xl px-3.5 py-2.5 text-[15px] font-bold transition-colors",
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
  const { signOut, signingOut, signOutError } = useSessionSignOut("/auth");
  const signedIn = Boolean(authUser.id);
  const displayName = signedIn
    ? authUser.name?.trim()
      || authUser.email?.split("@")[0]
      || "WAKILISHA"
    : "Your people are here.";
  const initial =
    displayName.slice(0, 1).toUpperCase() || "W";

  if (!open) return null;

  return (
    <ModalOverlay
      isOpen={open}
      isDismissable
      onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}
      className="fixed inset-0 z-[170] bg-black/50 backdrop-blur-[2px]"
    >
      <AriaModal
        data-scroll-lock="container"
        id="wk-workbook-sidebar"
        className="absolute inset-y-0 left-0 flex w-[min(82vw,360px)] flex-col overflow-hidden border-r border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-2xl"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 12px)",
          paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
          animation: "wkAccountDrawerIn 220ms cubic-bezier(.16,1,.3,1)",
        }}
      >
        <Dialog aria-label="WAKILISHA Menu" className="flex min-h-0 flex-1 flex-col outline-none">
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
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"
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
              {WAKILISHA_NAVIGATION.map((group) => (
                <div key={group.label}>
                  <div className="mb-2 mt-5 px-3.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--wk-text-faint)]">
                    {group.label}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <DrawerNavLink key={item.to} item={item} onNavigate={onClose} />
                    ))}
                  </div>
                </div>
              ))}
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
            {signedIn ? (
              <>
                <button
                  type="button"
                  onClick={() => void signOut().then((success) => { if (success) onClose(); })}
                  disabled={signingOut}
                  className="flex min-h-12 w-full items-center gap-4 rounded-2xl px-3.5 py-2.5 text-left text-[14px] font-semibold text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)] disabled:cursor-wait disabled:opacity-60"
                >
                  <WkIcon name="LogOut" size={20} />
                  <span>{signingOut ? "Signing out" : "Sign out"}</span>
                </button>
                {signOutError ? <p role="alert" className="px-3.5 pb-2 text-[12px] text-[var(--wk-danger)]">{signOutError}</p> : null}
              </>
            ) : null}
          </div>
        </Dialog>
      </AriaModal>
    </ModalOverlay>
  );
}
