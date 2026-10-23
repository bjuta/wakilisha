import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Dialog, Modal as AriaModal, ModalOverlay } from "react-aria-components";
import { WakilishaAccountMark } from "@/components/brand/WakilishaAccountMark";
import { WkIcon } from "@/components/design-system/Icon";
import { WkDisclosure } from "@/components/design-system/primitives/Disclosure";
import { WakilishaToggle } from "@/components/design-system/primitives/WakilishaToggle";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useMessagesAccess } from "@/hooks/useMessagesAccess";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useSessionSignOut } from "@/hooks/useSessionSignOut";
import {
  isWakilishaNavCurrent,
  visibleWakilishaNavigation,
  WAKILISHA_FOOT_LINKS,
  WAKILISHA_MORE_DESTINATIONS,
  type WkNavDestination,
} from "@/components/navigation/wakilishaNavigation";

function DrawerNavLink({ item, onNavigate }: {
  item: WkNavDestination;
  onNavigate: () => void;
}) {
  const location = useLocation();
  const active = isWakilishaNavCurrent(location.pathname, item.to);
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-12 items-center gap-4 rounded-xl px-3 text-[15px] transition-colors ${active
        ? "bg-[var(--wk-brand-soft)] font-bold text-[var(--wk-text)]"
        : "font-medium text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]"}`}
    >
      <WkIcon name={item.icon} size={20} />
      {item.label}
    </Link>
  );
}

export function MobileAccountDrawer({ open, onClose, onSearch, startInYou = false, rail = false }: {
  open: boolean;
  onClose: () => void;
  onSearch: () => void;
  startInYou?: boolean;
  rail?: boolean;
}) {
  const [youOpen, setYouOpen] = useState(false);
  const authUser = useAuthUser();
  const { theme, setTheme } = useTheme();
  const { signOut, signingOut, signOutError } = useSessionSignOut("/auth");
  const messagesAccess = useMessagesAccess();
  const signedIn = !authUser.loading && Boolean(authUser.id);
  const navigation = visibleWakilishaNavigation({
    signedIn,
    messagesVisible: signedIn && !messagesAccess.loading && messagesAccess.visible,
  });
  const displayName = signedIn
    ? authUser.name?.trim() || authUser.email?.split("@")[0] || "WAKILISHA"
    : "Your people are here.";
  const initial = displayName.slice(0, 1).toUpperCase() || "W";

  useScrollLock(open);
  useEffect(() => { setYouOpen(open && startInYou); }, [open, startInYou]);
  if (!open) return null;

  const close = () => {
    setYouOpen(false);
    onClose();
  };
  const footLinks = (
    <div className="flex flex-wrap gap-x-3 gap-y-2 px-3 py-3">
      {WAKILISHA_FOOT_LINKS.map((item) => (
        <Link key={item.to} to={item.to} onClick={close}
          className="text-[11px] font-medium text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]">
          {item.label}
        </Link>
      ))}
    </div>
  );
  const appearanceControls = (
    <div data-wk-appearance-controls className="flex min-h-12 items-center justify-between gap-3 border-t border-[var(--wk-divider)] px-3">
      <span className="text-[13px] font-semibold text-[var(--wk-text)]">Dark mode</span>
      <WakilishaToggle
        value={theme === "dark"}
        onChange={(isDark) => setTheme(isDark ? "dark" : "light")}
        ariaLabel="Dark mode"
        size="sm"
      />
    </div>
  );
  return (
    <ModalOverlay isOpen={open} isDismissable onOpenChange={(value) => { if (!value) close(); }}
      className="fixed inset-0 z-[170] bg-black/55 backdrop-blur-[2px]">
      <AriaModal id="wk-workbook-sidebar" data-scroll-lock="container"
        className={["absolute inset-y-0 left-0 flex w-[min(300px,90vw)] flex-col overflow-hidden border-r border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-2xl",
          startInYou ? `md:inset-y-auto md:bottom-5 md:h-[min(680px,calc(100dvh-40px))] md:rounded-2xl md:border ${rail ? "md:left-[80px]" : "md:left-[256px]"}` : ""].join(" ")}
        style={{ paddingTop: "max(env(safe-area-inset-top), 12px)", paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}>
        <Dialog aria-label={youOpen ? "You" : "WAKILISHA Menu"} className="flex min-h-0 flex-1 flex-col outline-none">
          <header className="flex min-h-[64px] items-center justify-between gap-3 px-5">
            {youOpen ? (
              <button type="button" onClick={() => setYouOpen(false)}
                className="flex h-11 items-center gap-2 text-[14px] font-bold text-[var(--wk-text)]">
                <WkIcon name="ChevronLeft" size={20} /> Menu
              </button>
            ) : (
              <Link to="/" onClick={close} aria-label="WAKILISHA home" className="flex items-center">
                <img src={theme === "dark" ? "/assets/logos/wakilisha-logo-dark.svg" : "/assets/logos/wakilisha-logo-light.svg"}
                  alt="WAKILISHA" className="h-7 w-auto max-w-[190px] object-contain" />
              </Link>
            )}
            <button type="button" onClick={close} aria-label="Close menu"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]">
              <WkIcon name="X" size={20} />
            </button>
          </header>

          {!youOpen ? (
            <>
              <nav aria-label="WAKILISHA places" className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
                {navigation.map((group) => group.items.map((item) => (
                  <DrawerNavLink key={item.to} item={item} onNavigate={close} />
                )))}
              </nav>
              <div className="border-t border-[var(--wk-divider)] px-3 pt-2">
                {signedIn ? (
                  <button type="button" onClick={() => setYouOpen(true)}
                    aria-label="Open You"
                    className="flex min-h-[64px] w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-[var(--wk-surface-raised)]">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--wk-surface-raised)] font-bold">
                      {authUser.avatarUrl ? <img src={authUser.avatarUrl} alt="" className="h-full w-full object-cover" /> : initial}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-[var(--wk-text)]">{displayName}</span>
                    <WkIcon name="ChevronDown" size={17} />
                  </button>
                ) : (
                  <>
                    <Link to="/auth" onClick={close} className="flex min-h-12 items-center gap-3 rounded-xl px-3 font-bold text-[var(--wk-text)]">
                      <WakilishaAccountMark size={22} /> Sign In
                    </Link>
                    {appearanceControls}
                    {footLinks}
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="border-b border-[var(--wk-divider)] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[var(--wk-surface-raised)] text-lg font-bold">
                    {authUser.avatarUrl ? <img src={authUser.avatarUrl} alt="" className="h-full w-full object-cover" /> : (signedIn ? (initial) : <WakilishaAccountMark size={28} />)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[17px] font-bold text-[var(--wk-text)]">{displayName}</div>
                    <p className="truncate text-[12px] text-[var(--wk-text-muted)]">
                      {authUser.email || (signedIn ? "WAKILISHA listener" : "Sign in to keep your place")}
                    </p>
                  </div>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
                <nav aria-label="Your WAKILISHA">
                  {([
                    { to: "/notifications", icon: "Bell" as const, label: "Notifications", available: signedIn },
                    { to: "/messages", icon: "MessageSquare" as const, label: "Messages", available: signedIn && !messagesAccess.loading && messagesAccess.visible },
                    { to: "/profile", icon: "UserRound" as const, label: "Profile", available: signedIn },
                    { to: "/artist-studio", icon: "Mic2" as const, label: "Artist Studio", available: signedIn },
                    { to: "/settings", icon: "Settings" as const, label: "Settings", available: signedIn },
                  ]).filter(item => item.available).map(item => (
                    <Link key={item.to} to={item.to} onClick={close}
                      className="flex min-h-12 items-center gap-4 rounded-xl px-3 text-[14px] font-semibold text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]">
                      <WkIcon name={item.icon} size={20}/>{item.label}
                    </Link>
                  ))}
                  <button type="button" onClick={() => { close(); onSearch(); }}
                    className="flex min-h-12 w-full items-center gap-4 rounded-xl px-3 text-left text-[14px] font-semibold text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]">
                    <WkIcon name="Search" size={20}/><span>Search</span>
                  </button>
                </nav>
                {appearanceControls}
                <WkDisclosure
                  summary="Browse more"
                  className="border-t border-[var(--wk-divider)] px-3 py-2"
                  triggerClassName="flex min-h-11 w-full items-center text-left text-[13px] font-semibold text-[var(--wk-text-muted)]"
                  contentClassName="flex flex-col pb-2"
                >
                  {[...WAKILISHA_MORE_DESTINATIONS, ...WAKILISHA_FOOT_LINKS].map(item => (
                    <Link key={item.to} to={item.to} onClick={close}
                      className="flex min-h-10 items-center rounded-lg px-2 text-[13px] text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]">
                      {item.label}
                    </Link>
                  ))}
                </WkDisclosure>
                <button type="button" onClick={() => { void signOut().then(success => { if (success) close(); }); }}
                  disabled={signingOut}
                  className="flex min-h-12 w-full items-center gap-4 rounded-xl px-3 text-left text-[14px] font-semibold text-[var(--wk-text)] disabled:opacity-50">
                  <WkIcon name="LogOut" size={20}/>{signingOut ? "Signing Out" : "Sign Out"}
                </button>
                {signOutError ? <p role="alert" className="px-3 text-[12px] text-[var(--wk-danger)]">{signOutError}</p> : null}
              </div>
            </>
          )}
        </Dialog>
      </AriaModal>
    </ModalOverlay>
  );
}
