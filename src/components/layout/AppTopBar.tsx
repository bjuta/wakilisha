import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { getSiteIdentitySettings } from "@/services/adminSettings/settingsStore";
import type { SiteIdentitySettings } from "@/services/adminSettings/settingsTypes";

function useSiteIdentity(): SiteIdentitySettings {
  const [identity, setIdentity] = useState<SiteIdentitySettings>(getSiteIdentitySettings);

  useEffect(() => {
    const handler = () => setIdentity(getSiteIdentitySettings());
    window.addEventListener("wk_settings_changed", handler);
    return () => window.removeEventListener("wk_settings_changed", handler);
  }, []);

  return identity;
}

const MAIN_LINKS = [
  { label: "Charts", to: "/charts" },
  { label: "Guides", to: "/guides" },
  { label: "Artists", to: "/artists" },
  { label: "Magazine", to: "/magazine" },
];

const VERTICALS = [
  { label: "Music", to: "/charts", color: "var(--wk-v-music)", status: "active" as const },
  { label: "Guides", to: "/guides", color: "var(--wk-v-intel)", status: "new" as const },
  { label: "Film", to: "/film", color: "var(--wk-v-film)", status: "coming" as const },
  { label: "Fashion", to: "/fashion", color: "var(--wk-v-fashion)", status: "coming" as const },
  { label: "Food", to: "/food", color: "var(--wk-v-food)", status: "coming" as const },
  { label: "Language", to: "/language", color: "var(--wk-v-language)", status: "coming" as const },
  { label: "Places", to: "/places", color: "var(--wk-v-places)", status: "coming" as const },
];

function StatusBadge({ status }: { status: "active" | "new" | "coming" }) {
  if (status === "active") {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-success)]"><span className="w-1.5 h-1.5 rounded-full bg-[var(--wk-success)]" />Active</span>;
  }
  if (status === "new") {
    return <span className="inline-flex items-center rounded-full bg-[var(--wk-v-intel)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--wk-v-intel)]">New</span>;
  }
  return <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--wk-text-faint)]">Coming</span>;
}

export function AppTopBar() {
  const location = useLocation();
  const identity = useSiteIdentity();
  const { theme, toggle } = useTheme();
  const [logoError, setLogoError] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [verticalsOpen, setVerticalsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileVerticalsOpen, setMobileVerticalsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayName = identity.siteName.trim() || "WAKILISHA";
  const selectedLogoUrl = theme === "dark" ? (identity.darkLogoUrl || identity.logoUrl) : (identity.lightLogoUrl || identity.logoUrl);
  const showCustomLogo = selectedLogoUrl.trim().length > 0 && !logoError;
  const isHome = location.pathname === "/";
  const isHeroPage = !isHome && (
    /^\/artists\/[^/]+$/.test(location.pathname) ||
    /^\/charts\/[^/]+\/[^/]+\/[^/]+/.test(location.pathname) ||
    /^\/genres\/[^/]+$/.test(location.pathname) ||
    /^\/labels\/[^/]+$/.test(location.pathname)
  );

  useEffect(() => { setLogoError(false); }, [selectedLogoUrl]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setVerticalsOpen(false);
    setMobileOpen(false);
    setMobileVerticalsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!verticalsOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setVerticalsOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [verticalsOpen]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const isActive = (to: string) => {
    if (to === "/charts") return location.pathname.startsWith("/charts");
    if (to === "/guides") return location.pathname.startsWith("/guides");
    return location.pathname === to;
  };

  const navBg = scrolled
    ? "bg-[var(--wk-surface)] border-b border-[var(--wk-border)]"
    : "bg-transparent";
  const navTextColor = (isHome || isHeroPage) && !scrolled ? "text-white" : "text-[var(--wk-text-soft)]";
  const navTextHover = (isHome || isHeroPage) && !scrolled ? "hover:text-white" : "hover:text-[var(--wk-text)]";
  const logoColor = (isHome || isHeroPage) && !scrolled ? "text-white" : "text-[var(--wk-text)]";
  const iconColor = (isHome || isHeroPage) && !scrolled
    ? "text-white/80 hover:text-white hover:bg-white/10"
    : "text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]";

  return (
    <header className={`sticky top-0 z-[60] transition-all duration-300 ${navBg} ${scrolled ? "backdrop-blur-xl" : "backdrop-blur-none"}`}>
      {(isHome || isHeroPage) && !scrolled && <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent pointer-events-none" />}

      <div className="wk-container-max flex items-center justify-between gap-6 px-6 py-4">
        <Link to="/" className="group relative shrink-0 flex items-center gap-2.5 no-underline" aria-label={displayName}>
          {showCustomLogo ? (
            <img src={selectedLogoUrl} alt={displayName} onError={() => setLogoError(true)} className={`h-8 max-w-[160px] object-contain transition-opacity duration-300 ${(isHome || isHeroPage) && !scrolled ? "brightness-0 invert" : ""}`} />
          ) : (
            <span className={`hidden sm:block text-base font-black tracking-tight transition-colors duration-300 ${logoColor}`}>{displayName}</span>
          )}
        </Link>

        <nav className="hidden lg:flex items-center gap-0.5">
          {MAIN_LINKS.map((link) => {
            const active = isActive(link.to);
            return <Link key={link.to} to={link.to} className={`relative px-3.5 py-2 text-[13px] font-semibold rounded-full transition-all duration-200 whitespace-nowrap ${active ? "text-[var(--wk-brand)]" : `${navTextColor} ${navTextHover}`} ${(isHome || isHeroPage) && !scrolled ? "hover:bg-white/10" : "hover:bg-[var(--wk-surface-raised)]"}`}>{link.label}{active && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--wk-brand)]" />}</Link>;
          })}
          <div ref={dropdownRef} className="relative">
            <button onClick={() => setVerticalsOpen(!verticalsOpen)} className={`flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold rounded-full transition-all duration-200 whitespace-nowrap cursor-pointer ${verticalsOpen ? "text-[var(--wk-brand)]" : `${navTextColor} ${navTextHover}`} ${(isHome || isHeroPage) && !scrolled ? "hover:bg-white/10" : "hover:bg-[var(--wk-surface-raised)]"}`}>Verticals<i className={`ri-arrow-down-s-line text-[10px] transition-transform duration-200 ${verticalsOpen ? "rotate-180" : ""}`} /></button>
            {verticalsOpen && <div className="absolute top-full mt-2 right-0 w-[340px] rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-lg p-3 animate-[fadeIn_150ms_ease-out] z-[70]"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--wk-text-faint)] px-3 py-2 mb-1">Seven Pillars</div><div className="flex flex-col gap-0.5">{VERTICALS.map((v) => <Link key={v.label} to={v.to} className="flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors duration-150 hover:bg-[var(--wk-surface-raised)] group"><div className="flex items-center gap-3"><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: v.color }} /><span className="text-[13px] font-semibold text-[var(--wk-text)] group-hover:text-[var(--wk-text)]">{v.label}</span></div><StatusBadge status={v.status} /></Link>)}</div></div>}
          </div>
        </nav>

        <div className="flex items-center gap-1.5">
          <Link to="/search" aria-label="Search" className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 ${isActive("/search") ? "text-[var(--wk-brand)] bg-[var(--wk-brand-soft)]" : iconColor}`}>
            <i className="ri-search-line text-[17px]" />
          </Link>
          <button onClick={toggle} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 ${iconColor}`}>
            <i className={theme === "dark" ? "ri-sun-line text-[17px]" : "ri-moon-line text-[17px]"} />
          </button>
          <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu" className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 lg:hidden cursor-pointer ${iconColor}`}>
            <i className={mobileOpen ? "ri-close-line text-lg" : "ri-menu-line text-lg"} />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-[55] bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
          <div className="absolute top-full left-0 right-0 z-[56] lg:hidden max-h-[80vh] overflow-y-auto bg-[var(--wk-surface)] border-b border-[var(--wk-border)]">
            <div className="px-6 py-5">
              <nav className="flex flex-col gap-1">
                {MAIN_LINKS.map((link) => {
                  const active = isActive(link.to);
                  return <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)} className={`flex items-center justify-between rounded-xl px-4 py-3.5 text-[15px] font-semibold transition-all duration-150 active:scale-[0.98] whitespace-nowrap ${active ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" : "text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"}`}>{link.label}{active && <i className="ri-check-line" />}</Link>;
                })}
                <button onClick={() => setMobileVerticalsOpen(!mobileVerticalsOpen)} className="flex items-center justify-between rounded-xl px-4 py-3.5 text-[15px] font-semibold transition-all duration-150 active:scale-[0.98] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)] cursor-pointer"><span>Verticals</span><i className={`ri-arrow-down-s-line transition-transform duration-200 ${mobileVerticalsOpen ? "rotate-180" : ""}`} /></button>
                {mobileVerticalsOpen && <div className="ml-4 border-l-2 border-[var(--wk-border)] pl-4 flex flex-col gap-0.5">{VERTICALS.map((v) => <Link key={v.label} to={v.to} onClick={() => setMobileOpen(false)} className="flex items-center justify-between rounded-lg px-3 py-3 text-[14px] font-medium text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)] transition-all duration-150 active:scale-[0.98]"><div className="flex items-center gap-2.5"><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: v.color }} />{v.label}</div><StatusBadge status={v.status} /></Link>)}</div>}
              </nav>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </header>
  );
}
