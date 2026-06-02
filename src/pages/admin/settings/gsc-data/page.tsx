import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  getGscSettings,
  saveDomainSettings,
} from "@/services/adminSettings/settingsStore";
import {
  DEFAULT_GSC_SETTINGS,
  type GscSettings,
} from "@/services/adminSettings/settingsTypes";

export default function AdminSettingsGscData() {
  const [settings, setSettings] = useState<GscSettings>(getGscSettings());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const update = <K extends keyof GscSettings>(key: K, value: GscSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      saveDomainSettings("gscData", settings);
      setSaved(true);
      setSaving(false);
    }, 400);
  };

  const handleTest = () => {
    setTesting(true);
    setTestResult(null);
    setTimeout(() => {
      setTestResult(settings.oauthStatus === "connected" ? "GSC connection verified." : "GSC not connected. Connect OAuth first.");
      setTesting(false);
    }, 1200);
  };

  const handleConnect = () => {
    update("oauthStatus", "pending");
    setTimeout(() => {
      update("oauthStatus", "connected");
      setSaved(false);
    }, 2000);
  };

  const handleDisconnect = () => {
    update("oauthStatus", "disconnected");
    update("selectedProperty", null);
    setSaved(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <WkIcon name="Globe" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">GSC Data</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">
          Google Search Console data import for artist and search analytics.
          <strong className="text-[var(--wk-text)]"> GSC is used here only for data import.</strong> Content generation and draft generation are out of scope.
        </p>
      </div>

      {/* Enable / OAuth Status */}
      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4 flex items-center gap-2">
          <WkIcon name="Globe" size={16} />
          Connection
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Enable GSC Data Import</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => update("enabled", !settings.enabled)}
                className={`relative h-6 w-11 rounded-full transition-colors ${settings.enabled ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--wk-surface)] transition-transform ${settings.enabled ? "translate-x-5.5" : "translate-x-0.5"}`} />
              </button>
              <span className="text-[13px] text-[var(--wk-text)]">{settings.enabled ? "Enabled" : "Disabled"}</span>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">OAuth Status</label>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold ${
                settings.oauthStatus === "connected" ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" :
                settings.oauthStatus === "pending" ? "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]" :
                settings.oauthStatus === "error" ? "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]" :
                "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"
              }`}>
                {settings.oauthStatus === "connected" ? "Connected" : settings.oauthStatus === "pending" ? "Pending" : settings.oauthStatus === "error" ? "Error" : "Disconnected"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleConnect}
            disabled={settings.oauthStatus === "connected"}
            className="wk-button wk-button-primary wk-button-sm flex items-center gap-1.5"
          >
            <WkIcon name="Link" size={14} />
            Connect GSC
          </button>
          <button
            onClick={handleDisconnect}
            disabled={settings.oauthStatus !== "connected"}
            className="wk-button wk-button-ghost wk-button-sm flex items-center gap-1.5"
          >
            <WkIcon name="Unlink" size={14} />
            Disconnect GSC
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="wk-button wk-button-soft wk-button-sm flex items-center gap-1.5"
          >
            <WkIcon name={testing ? "Loader" : "Activity"} size={14} />
            {testing ? "Testing..." : "Test Connection"}
          </button>
          <button
            onClick={() => setTestResult("No properties found. Connect GSC first to fetch properties.")}
            disabled={settings.oauthStatus !== "connected"}
            className="wk-button wk-button-ghost wk-button-sm"
          >
            Fetch Properties
          </button>
        </div>

        {testResult && (
          <div className="mt-4 rounded-lg bg-[var(--wk-info-soft)] p-3 text-[12px] text-[var(--wk-info)]">
            {testResult}
          </div>
        )}
      </WkSurface>

      {/* Import Settings */}
      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4 flex items-center gap-2">
          <WkIcon name="Download" size={16} />
          Import Settings
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Import Schedule</label>
            <select
              value={settings.importSchedule}
              onChange={(e) => update("importSchedule", e.target.value as "manual" | "daily" | "weekly")}
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
            >
              <option value="manual">Manual</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Query Row Retention (days)</label>
            <input
              type="number"
              value={settings.queryRowRetentionDays}
              min={7}
              max={365}
              onChange={(e) => update("queryRowRetentionDays", Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Selected Property</label>
            <input
              type="text"
              value={settings.selectedProperty || ""}
              onChange={(e) => update("selectedProperty", e.target.value || null)}
              placeholder="sc-domain:example.com"
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
            />
          </div>
        </div>
      </WkSurface>

      {/* Artist Matching */}
      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4 flex items-center gap-2">
          <WkIcon name="Users" size={16} />
          Artist Matching
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Enable Artist Matching</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => update("enableArtistMatching", !settings.enableArtistMatching)}
                className={`relative h-6 w-11 rounded-full transition-colors ${settings.enableArtistMatching ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--wk-surface)] transition-transform ${settings.enableArtistMatching ? "translate-x-5.5" : "translate-x-0.5"}`} />
              </button>
              <span className="text-[13px] text-[var(--wk-text)]">{settings.enableArtistMatching ? "Enabled" : "Disabled"}</span>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Minimum Match Confidence</label>
            <input
              type="number"
              value={settings.minimumMatchConfidence}
              min={0}
              max={1}
              step={0.05}
              onChange={(e) => update("minimumMatchConfidence", Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
            />
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
        {saved && (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--wk-success)]">
            <WkIcon name="Check" size={14} /> Saved
          </span>
        )}
      </div>

      {/* Out of scope note */}
      <WkSurface className="p-4 border-l-4 border-[var(--wk-warning)]">
        <div className="flex items-start gap-3">
          <WkIcon name="AlertTriangle" size={18} className="text-[var(--wk-warning)] mt-0.5" />
          <div>
            <h3 className="text-[13px] font-bold text-[var(--wk-text)]">Out of Scope</h3>
            <p className="text-[12px] text-[var(--wk-text-muted)] mt-1">
              Content generation, draft generation, editorial radar, and bulk content generation are not part of GSC Data settings.
              This page only handles data import and artist/search analytics.
            </p>
          </div>
        </div>
      </WkSurface>
    </div>
  );
}