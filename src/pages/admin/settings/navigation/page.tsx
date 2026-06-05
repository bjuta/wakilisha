import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  getNavigationSettings,
  saveDomainSettings,
} from "@/services/adminSettings/settingsStore";
import {
  DEFAULT_NAVIGATION_SETTINGS,
  type NavigationSettings,
} from "@/services/adminSettings/settingsTypes";

export default function AdminSettingsNavigation() {
  const [settings, setSettings] = useState<NavigationSettings>(getNavigationSettings());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const updateNavItem = (index: number, updates: Partial<NavigationSettings["publicNavItems"][0]>) => {
    const next = settings.publicNavItems.map((item, i) => (i === index ? { ...item, ...updates } : item));
    setSettings((prev) => ({ ...prev, publicNavItems: next }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      saveDomainSettings("navigation", settings);
      setSaved(true);
      setSaving(false);
    }, 400);
  };

  const handleReset = () => {
    setSettings(DEFAULT_NAVIGATION_SETTINGS);
    setSaved(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <WkIcon name="Compass" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Navigation</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">Admin and public nav structure. Feeds React navigation, not old WordPress navbar logic.</p>
      </div>

      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4">Public Navigation</h2>
        <div className="space-y-2">
          {settings.publicNavItems.map((item, index) => (
            <div key={item.path} className="flex items-center gap-3 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)] text-[12px] font-bold">
                {item.order}
              </div>
              <div className="flex-1 grid gap-2 sm:grid-cols-3">
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateNavItem(index, { label: e.target.value })}
                  className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
                />
                <input
                  type="text"
                  value={item.path}
                  onChange={(e) => updateNavItem(index, { path: e.target.value })}
                  className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] font-mono focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateNavItem(index, { visible: !item.visible })}
                    className={`relative h-5 w-9 rounded-full transition-colors ${item.visible ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}
                  >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-[var(--wk-surface)] transition-transform ${item.visible ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                  </button>
                  <span className="text-[12px] text-[var(--wk-text-muted)]">{item.visible ? "Visible" : "Hidden"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4">Share Config</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5">
            <span className="text-[13px] font-semibold text-[var(--wk-text)]">Share Enabled</span>
            <button onClick={() => setSettings((s) => ({ ...s, shareConfig: { ...s.shareConfig, enabled: !s.shareConfig.enabled } }))} className={`relative h-6 w-11 rounded-full transition-colors ${settings.shareConfig.enabled ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--wk-surface)] transition-transform ${settings.shareConfig.enabled ? "translate-x-[22px]" : "translate-x-0.5"}`} />
            </button>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Platforms (comma-separated)</label>
            <input
              type="text"
              value={settings.shareConfig.platforms.join(", ")}
              onChange={(e) => setSettings((s) => ({ ...s, shareConfig: { ...s.shareConfig, platforms: e.target.value.split(",").map((p) => p.trim()).filter(Boolean) } }))}
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
            />
          </div>
        </div>
      </WkSurface>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="wk-button wk-button-primary wk-button-sm flex items-center gap-2">
          <WkIcon name={saving ? "Loader" : "Save"} size={14} /> {saving ? "Saving..." : "Save Changes"}
        </button>
        <button onClick={handleReset} className="wk-button wk-button-ghost wk-button-sm">Reset to Defaults</button>
        {saved && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--wk-success)]"><WkIcon name="Check" size={14} /> Saved</span>}
      </div>
    </div>
  );
}