import { WkIcon } from "@/components/design-system/Icon";
import {
  useEffect,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import {
  GlobalSearchSurface,
} from "@/components/search/GlobalSearchSurface";
import {
  MobileAccountDrawer,
} from "./MobileAccountDrawer";


export function MobileTopBar() {
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);

  useEffect(() => {
    // One real app header, not a simulated browser toolbar. Begin visible
    // on each route and while either navigation overlay is in use.
    setHeaderVisible(true);
    let lastY = Math.max(0, window.scrollY);
    let direction = 0;
    let travelled = 0;

    const onScroll = () => {
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY;
      lastY = y;

      if (accountOpen || searchOpen || y <= 8) {
        travelled = 0;
        setHeaderVisible(true);
        return;
      }

      // Ignore sub-pixel scroll noise. Accumulate small real movements so
      // a deliberate upward gesture reveals the controls promptly.
      if (Math.abs(delta) < 1) return;
      const nextDirection = delta > 0 ? 1 : -1;
      if (nextDirection !== direction) {
        direction = nextDirection;
        travelled = 0;
      }
      travelled += Math.abs(delta);

      if (nextDirection < 0 && travelled >= 6) {
        setHeaderVisible(true);
      } else if (nextDirection > 0 && y > 96 && travelled >= 18) {
        setHeaderVisible(false);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [location.pathname, accountOpen, searchOpen]);

  if (location.pathname === "/auth") return null;

  return (
    <>
      <header
        className={`pointer-events-none fixed inset-x-0 top-0 z-[78] flex h-14 w-full items-center justify-between gap-3 border-b border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] px-4 shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none ${headerVisible ? "translate-y-0" : "-translate-y-full"}`}
        data-wk-mobile-app-header="v4"
        data-wk-mobile-header-visible={headerVisible ? "true" : "false"}
        onFocusCapture={() => setHeaderVisible(true)}
        style={{ paddingTop: "env(safe-area-inset-top)", height: "calc(56px + env(safe-area-inset-top))" }}
      >
        <button
          type="button"
          onClick={() => setAccountOpen(true)}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-transparent text-[var(--wk-text)] transition-colors hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-brand)]"
          aria-label="Open WAKILISHA menu"
          aria-controls="wk-workbook-sidebar"
          aria-expanded={accountOpen}
        >
          <WkIcon name="Menu" size={21} />
        </button>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-transparent text-[var(--wk-text)] transition-colors hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-brand)]"
        >
          <WkIcon name="Search" size={20} />
        </button>
      </header>

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
