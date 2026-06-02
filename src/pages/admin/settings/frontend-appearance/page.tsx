import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  getFrontendAppearanceSettings,
  saveDomainSettings,
} from "@/services/adminSettings/settingsStore";
import {
  DEFAULT_FRONTEND_APPEARANCE_SETTINGS,
  type FrontendAppearanceSettings,
} from "@/services/adminSettings/settingsTypes";

export default function AdminSettingsFrontendAppearance() {
  const [settings, setSettings] = useState<FrontendAppearanceSettings>(getFrontendAppearanceSettings());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof FrontendAppearanceSettings>(key: K, value: FrontendAppearanceSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      saveDomainSettings("frontendAppearance", settings);
      setSaved(true);
      setSaving(false);
    }, 400);
  };

  const handleReset = () => {
    setSettings(DEFAULT_FRONTEND_APPEARANCE_SETTINGS);
    setSaved(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <WkIcon name="Palette" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Frontend Appearance</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">
          Platform-wide accent colors, theme defaults, and hero fallbacks. Not chart-specific.
        </p>
      </div>

      {/* Colors */}
      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4 flex items-center gap-2">
          <WkIcon name="Palette" size={16} />
          Accent Colors
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Light Mode Accent</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.lightModeAccent}
                onChange={(e) => update("lightModeAccent", e.target.value)}
                className="h-10 w-10 rounded-lg border border-[var(--wk-border)] cursor-pointer"
              />
              <input
                type="text"
                value={settings.lightModeAccent}
                onChange={(e) => update("lightModeAccent", e.target.value)}
                className="flex-1 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] font-mono focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
              />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Dark Mode Accent</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.darkModeAccent}
                onChange={(e) => update("darkModeAccent", e.target.value)}
                className="h-10 w-10 rounded-lg border border-[var(--wk-border)] cursor-pointer"
              />
              <input
                type="text"
                value={settings.darkModeAccent}
                onChange={(e) => update("darkModeAccent", e.target.value)}
                className="flex-1 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] font-mono focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
              />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Theme Default</label>
            <select
              value={settings.themeDefault}
              onChange={(e) => update("themeDefault", e.target.value as "system" | "light" | "dark")}
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>
      </WkSurface>

      {/* Hero Fallbacks */}
      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4 flex items-center gap-2">
          <WkIcon name="Image" size={16} />
          Hero Fallbacks
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Default Chart Hero Image URL</label>
            <input
              type="text"
              value={settings.defaultChartHeroImage}
              onChange={(e) => update("defaultChartHeroImage", e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Default Artist Hero Fallback</label>
            <input
              type="text"
              value={settings.defaultArtistHeroFallback}
              onChange={(e) => update("defaultArtistHeroFallback", e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Default Genre Hero Fallback</label>
            <input
              type="text"
              value={settings.defaultGenreHeroFallback}
              onChange={(e) => update("defaultGenreHeroFallback", e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Default Label Hero Fallback</label>
            <input
              type="text"
              value={settings.defaultLabelHeroFallback}
              onChange={(e) => update("defaultLabelHeroFallback", e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Default Login Background</label>
            <input
              type="text"
              value={settings.defaultLoginBackground}
              onChange={(e) => update("defaultLoginBackground", e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Archive Filter Behavior</label>
            <select
              value={settings.archiveFilterBehavior}
              onChange={(e) => update("archiveFilterBehavior", e.target.value as "show_all" | "collapse_by_year")}
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
            >
              <option value="show_all">Show All</option>
              <option value="collapse_by_year">Collapse by Year</option>
            </select>
          </div>
        </div>
      </WkSurface>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="wk-button wk-button-primary wk-button-sm flex items-center gap-2"
        >
          <WkIcon name={saving ? "Loader" : "Save"} size={14} />
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button
          onClick={handleReset}
          className="wk-button wk-button-ghost wk-button-sm"
        >
          Reset to Defaults
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--wk-success)]">
            <WkIcon name="Check" size={14} /> Saved
          </span>
        )}
      </div>
    </div>
  );
}