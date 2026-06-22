import { useTheme, type ThemeMode } from "@/components/design-system/theme/ThemeProvider";
import type { UserAppearancePrefs } from "@/hooks/useUserSettings";

interface Props {
  appearance: UserAppearancePrefs;
  updateAppearance: (patch: Partial<UserAppearancePrefs>) => void;
}

const ACCENTS = [
  { label: "Verdant", value: "#84C241" },
  { label: "Terracotta", value: "#D6766A" },
  { label: "Sand", value: "#C7A06D" },
  { label: "Amber", value: "#E8A23A" },
  { label: "Rose", value: "#E86A8A" },
  { label: "Teal", value: "#4AB8A0" },
];

export function AppearanceSettingsPane({ appearance, updateAppearance }: Props) {
  const { setTheme } = useTheme();

  const handleThemeChange = (theme: ThemeMode) => {
    setTheme(theme);
    updateAppearance({ theme });
  };

  return (
    <div>
      {/* Theme */}
      <div className="mb-7">
        <h3 className="text-sm font-black tracking-[-0.015em] text-[var(--wk-text)] mb-1">Theme</h3>
        <p className="text-[12px] leading-relaxed text-[var(--wk-text-muted)] mb-4">
          Switches the entire WAKILISHA interface between light and dark surfaces. Changes apply instantly.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleThemeChange("dark")}
            className={`p-4 rounded-xl border text-left cursor-pointer transition-colors ${
              appearance.theme === "dark"
                ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)]"
                : "border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] hover:border-[var(--wk-border-2)]"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <i className="ri-moon-line text-base text-[var(--wk-text)]" />
              <span className="text-[13px] font-black text-[var(--wk-text)]">Dark</span>
            </div>
            <p className="text-[11px] text-[var(--wk-text-muted)]">Cinematic interface. Default WAKILISHA experience.</p>
          </button>
          <button
            onClick={() => handleThemeChange("light")}
            className={`p-4 rounded-xl border text-left cursor-pointer transition-colors ${
              appearance.theme === "light"
                ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)]"
                : "border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] hover:border-[var(--wk-border-2)]"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <i className="ri-sun-line text-base text-[var(--wk-text)]" />
              <span className="text-[13px] font-black text-[var(--wk-text)]">Light</span>
            </div>
            <p className="text-[11px] text-[var(--wk-text-muted)]">Readable daytime surface using light tokens.</p>
          </button>
        </div>
      </div>

      {/* Accent */}
      <div className="mb-7">
        <h3 className="text-sm font-black tracking-[-0.015em] text-[var(--wk-text)] mb-1">Accent color</h3>
        <p className="text-[12px] leading-relaxed text-[var(--wk-text-muted)] mb-4">
          Your personal highlight color for buttons, links, badges, and interactive surfaces.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          {ACCENTS.map((acc) => (
            <button
              key={acc.value}
              onClick={() => updateAppearance({ accent: acc.value })}
              className="relative w-11 h-11 rounded-full cursor-pointer transition-transform hover:scale-110"
              style={{ background: acc.value }}
              aria-label={`Accent: ${acc.label}`}
            >
              {appearance.accent === acc.value && (
                <span className="absolute inset-0 rounded-full border-[3px] border-[var(--wk-text)]" />
              )}
            </button>
          ))}
        </div>
        {appearance.accent && (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--wk-text-muted)]">
            <span className="w-4 h-4 rounded-full shrink-0" style={{ background: appearance.accent }} />
            <span>Active</span>
          </div>
        )}
      </div>

      {/* Density */}
      <div>
        <h3 className="text-sm font-black tracking-[-0.015em] text-[var(--wk-text)] mb-1">Interface density</h3>
        <p className="text-[12px] leading-relaxed text-[var(--wk-text-muted)] mb-4">
          Choose how tightly content rows and cards should render across the product.
        </p>
        <select
          className="h-[42px] px-4 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] text-[var(--wk-text)] text-sm font-bold focus:outline-none focus:border-[var(--wk-brand)] cursor-pointer"
          value={appearance.density}
          onChange={(e) => updateAppearance({ density: e.target.value as UserAppearancePrefs["density"] })}
        >
          <option>Comfortable</option>
          <option>Compact</option>
        </select>
      </div>
    </div>
  );
}