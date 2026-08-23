import { WakilishaAccountMark } from "@/components/brand/WakilishaAccountMark";
import {
  useState,
} from "react";
import {
  useLocation,
} from "react-router-dom";
import {
  NotificationBell,
} from "@/components/feature/community/NotificationBell";
import {
  GlobalSearchSurface,
} from "@/components/search/GlobalSearchSurface";
import {
  useAuthUser,
} from "@/hooks/useAuthUser";
import {
  MobileAccountDrawer,
} from "./MobileAccountDrawer";


export function MobileTopBar({ scrollVisible }: { scrollVisible: boolean }) {
  const location = useLocation();
  const authUser = useAuthUser();
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const signedIn = Boolean(authUser.id);
  const displayName = authUser.name?.trim()
    || authUser.email?.split("@")[0]
    || "Listener";
  const initial = displayName.slice(0, 1).toUpperCase() || "W";
  const visible = scrollVisible || searchOpen || accountOpen;

  if (location.pathname === "/auth") return null;

  return (
    <>
      <div
        className="pointer-events-none sticky top-0 z-[78] w-full px-4"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 12px)",
          visibility: visible ? "visible" : "hidden",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) translateZ(0)" : "translateY(-16px) translateZ(0)",
          transition: "opacity 0.28s cubic-bezier(.16,1,.3,1), transform 0.28s cubic-bezier(.16,1,.3,1), visibility 0.28s",
        }}
      >
        <div className="relative mx-auto h-12 w-full max-w-[980px]">
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            className="pointer-events-auto absolute left-0 top-0 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-[var(--wk-surface)]/88 text-[var(--wk-text)] shadow-[0_8px_28px_rgba(0,0,0,0.16)] backdrop-blur-xl"
            aria-label="Open account menu"
            aria-expanded={accountOpen}
          >
            {authUser.avatarUrl ? (
              <img
                src={authUser.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-[14px] font-black">{authUser.id ? (
              initial
            ) : (
              <WakilishaAccountMark size={24} />
            )}</span>
            )}
          </button>

          <div className="pointer-events-auto absolute right-0 top-0">

            {signedIn ? (
              <NotificationBell
                userId={authUser.id}
                className="h-11 w-11 border border-white/25 bg-[var(--wk-surface)]/88 shadow-[0_8px_28px_rgba(0,0,0,0.16)] backdrop-blur-xl"
              />
            ) : null}
          </div>
        </div>
      </div>

      <MobileAccountDrawer
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        onSearch={() => setSearchOpen(true)}
      />

      <GlobalSearchSurface
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </>
  );
}
