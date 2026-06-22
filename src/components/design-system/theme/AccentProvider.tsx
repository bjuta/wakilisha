import { useEffect } from "react";

const LS_APPEARANCE = "wk-appearance-v2";

interface AppearancePrefs {
  theme: string;
  accent: string;
  coverColor: string;
}

function readAppearance(): AppearancePrefs | null {
  try {
    const raw = localStorage.getItem(LS_APPEARANCE);
    if (!raw) return null;
    return JSON.parse(raw) as AppearancePrefs;
  } catch {
    return null;
  }
}

/**
 * Parses a hex color like "#84C241" into its RGB channels (0-255).
 * Used to set CSS variable overrides so the accent color from settings
 * replaces the default --wk-brand token globally.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

/**
 * Listens for localStorage changes to `wk-appearance-v2` and
 * applies the accent color as CSS custom properties on :root.
 *
 * The accent is mapped to --wk-brand, --wk-brand-rgb, --wk-brand-2,
 * and --wk-brand-soft so the whole UI responds to the user's choice.
 */
export function AccentProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apply = () => {
      const prefs = readAppearance();
      if (!prefs?.accent) return;

      const rgb = hexToRgb(prefs.accent);
      if (!rgb) return;

      const root = document.documentElement;

      // Compute a lighter variant for --wk-brand-2 (lighten by blending with white)
      const lr = Math.min(255, Math.round(rgb.r + (255 - rgb.r) * 0.3));
      const lg = Math.min(255, Math.round(rgb.g + (255 - rgb.g) * 0.3));
      const lb = Math.min(255, Math.round(rgb.b + (255 - rgb.b) * 0.3));

      root.style.setProperty("--wk-brand", prefs.accent);
      root.style.setProperty("--wk-brand-rgb", `${rgb.r},${rgb.g},${rgb.b}`);
      root.style.setProperty("--wk-brand-2", `rgb(${lr},${lg},${lb})`);
      root.style.setProperty("--wk-brand-soft", `rgba(${rgb.r},${rgb.g},${rgb.b},0.15)`);

      // Also apply cover color if set
      if (prefs.coverColor) {
        root.style.setProperty("--wk-profile-cover", prefs.coverColor);
      }
    };

    // Apply on mount
    apply();

    // Listen for localStorage changes from other tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_APPEARANCE) apply();
    };
    window.addEventListener("storage", onStorage);

    // Custom event for same-tab updates (dispatched by useUserSettings on save)
    const onCustom = () => apply();
    window.addEventListener("wk-accent-changed", onCustom);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("wk-accent-changed", onCustom);
    };
  }, []);

  return <>{children}</>;
}