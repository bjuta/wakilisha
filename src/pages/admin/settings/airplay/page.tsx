import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  getAirplaySettings,
  saveDomainSettings,
} from "@/services/adminSettings/settingsStore";
import {
  DEFAULT_AIRPLAY_SETTINGS,
  type AirplaySettings,
} from "@/services/adminSettings/settingsTypes";

export default function AdminSettingsAirplay() {
  const [settings, setSettings] = useState<AirplaySettings>(getAirplaySettings());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const update = <K extends keyof AirplaySettings>(key: K, value: AirplaySettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      saveDomainSettings("airplay", settings);
      setSaved(true);
      setSaving(false);
    }, 400);
  };

  const handleTest = () => {
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      alert("Airplay test completed. Worker connection required for live sync.");
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <WkIcon name="Radio" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Airplay</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">Airplay detection and sync settings.</p>
      </div>

      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4">Connection</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Enable Airplay Sync</label>
            <div className="flex items-center gap-3">
              <button onClick={() => update("enabled", !settings.enabled)} className={`relative h-6 w-11 rounded-full transition-colors ${settings.enabled ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--wk-surface)] transition-transform ${settings.enabled ? "translate-x-5.5" : "translate-x-0.5"}`} />
              </button>
              <span className="text-[13px] text-[var(--wk-text)]">{settings.enabled ? "Enabled" : "Disabled"}</span>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Provider</label>
            <input type="text" value={settings.provider} onChange={(e) => update("provider", e.target.value)} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">API Base URL</label>
            <input type="text" value={settings.apiBaseUrl} onChange={(e) => update("apiBaseUrl", e.target.value)} placeholder="https://api.airplay-provider.com/v1" className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">API Key</label>
            <input type="password" value={settings.apiKey} onChange={(e) => update("apiKey", e.target.value)} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]" />
          </div>
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4">Sync Settings</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Sync Frequency</label>
            <select value={settings.syncFrequency} onChange={(e) => update("syncFrequency", e.target.value as "manual" | "hourly" | "daily" | "weekly")} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]">
              <option value="manual">Manual</option>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Default Market</label>
            <input type="text" value={settings.defaultMarket} onChange={(e) => update("defaultMarket", e.target.value)} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Evidence Storage Mode</label>
            <select value={settings.evidenceStorageMode} onChange={(e) => update("evidenceStorageMode", e.target.value as "local" | "s3" | "db")} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]">
              <option value="local">Local</option>
              <option value="s3">S3</option>
              <option value="db">Database</option>
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Minimum Confidence Threshold</label>
            <input type="number" value={settings.minimumConfidenceThreshold} min={0} max={1} step={0.05} onChange={(e) => update("minimumConfidenceThreshold", Number(e.target.value))} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]" />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5">
            <span className="text-[13px] font-semibold text-[var(--wk-text)]">Auto-Link Detections to Registry</span>
            <button onClick={() => update("autoLinkDetections", !settings.autoLinkDetections)} className={`relative h-6 w-11 rounded-full transition-colors ${settings.autoLinkDetections ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--wk-surface)] transition-transform ${settings.autoLinkDetections ? "translate-x-5.5" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>
      </WkSurface>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="wk-button wk-button-primary wk-button-sm flex items-center gap-2">
          <WkIcon name={saving ? "Loader" : "Save"} size={14} /> {saving ? "Saving..." : "Save Changes"}
        </button>
        <button onClick={handleTest} disabled={testing} className="wk-button wk-button-soft wk-button-sm flex items-center gap-2">
          <WkIcon name={testing ? "Loader" : "Activity"} size={14} /> {testing ? "Testing..." : "Test Connection"}
        </button>
        {saved && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--wk-success)]"><WkIcon name="Check" size={14} /> Saved</span>}
      </div>

      <WkSurface className="p-4 border-l-4 border-[var(--wk-warning)]">
        <div className="flex items-start gap-3">
          <WkIcon name="AlertTriangle" size={18} className="text-[var(--wk-warning)] mt-0.5" />
          <div>
            <h3 className="text-[13px] font-bold text-[var(--wk-text)]">Worker Required</h3>
            <p className="text-[12px] text-[var(--wk-text-muted)] mt-1">Manual sync will be available after the airplay worker is connected.</p>
          </div>
        </div>
      </WkSurface>
    </div>
  );
}