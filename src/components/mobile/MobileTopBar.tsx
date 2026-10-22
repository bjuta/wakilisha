import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { WkIcon } from "@/components/design-system/Icon";
import {
  useState,
} from "react";
import {
  Link,
  useLocation,
} from "react-router-dom";
import {
  GlobalSearchSurface,
} from "@/components/search/GlobalSearchSurface";
import {
  MobileAccountDrawer,
} from "./MobileAccountDrawer";


export function MobileTopBar() {
  const location = useLocation();
  const { theme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  if (location.pathname === "/auth") return null;

  return (
    <>
      <header
        className="sticky top-0 z-[78] flex h-14 w-full items-center justify-between gap-3 border-b border-[var(--wk-border)] bg-[var(--wk-bg)]/95 px-4 backdrop-blur-xl"
        data-wk-mobile-app-header="v4"
      >
        <button
          type="button"
          onClick={() => setAccountOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]"
          aria-label="Open WAKILISHA menu"
          aria-controls="wk-workbook-sidebar"
          aria-expanded={accountOpen}
        >
          <WkIcon name="Menu" size={21} />
        </button>
        <Link to="/" aria-label="WAKILISHA home" className="flex min-w-0 flex-1 justify-center">
          <img src={theme === "dark" ? "/assets/logos/wakilisha-logo-dark.svg" : "/assets/logos/wakilisha-logo-light.svg"} alt="WAKILISHA" className="h-7 w-auto max-w-[160px] object-contain" />
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--wk-text)]"
          >
            <WkIcon name="Search" size={20} />
          </button>
        </div>
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
