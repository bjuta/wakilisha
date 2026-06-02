import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  getRegistrySettings,
  saveDomainSettings,
} from "@/services/adminSettings/settingsStore";
import {
  DEFAULT_REGISTRY_SETTINGS,
  type RegistrySettings,
} from "@/services/adminSettings/settingsTypes";

export default function AdminSettingsRegistry() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<RegistrySettings>(getRegistrySettings());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof RegistrySettings>(key: K, value: RegistrySettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      saveDomainSettings("registry", settings);
      setSaved(true);
      setSaving(false);
    }, 400);
  };

  const handleReset = () => {
    setSettings(DEFAULT_REGISTRY_SETTINGS);
    setSaved(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <WkIcon name="Database" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Registry Settings</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">Registry schema, thresholds, and quality controls.</p>
      </div>

      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4">Schema & Status</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Schema Version</label>
            <input type="text" value={settings.schemaVersion} readOnly className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] font-mono opacity-60" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">DB Status</label>
            <select value={settings.dbStatus} onChange={(e) => update("dbStatus", e.target.value as "connected" | "disconnected" | "unknown")} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]">
              <option value="connected">Connected</option>
              <option value="disconnected">Disconnected</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Materialized Stats Status</label>
            <select value={settings.materializedStatsStatus} onChange={(e) => update("materializedStatsStatus", e.target.value as "fresh" | "stale" | "unknown")} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]">
              <option value="fresh">Fresh</option>
              <option value="stale">Stale</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4">Thresholds</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Quality Threshold</label>
            <input type="number" value={settings.qualityThreshold} min={0} max={1} step={0.01} onChange={(e) => update("qualityThreshold", Number(e.target.value))} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Duplicate Candidate Threshold</label>
            <input type="number" value={settings.duplicateCandidateThreshold} min={0} max={1} step={0.01} onChange={(e) => update("duplicateCandidateThreshold", Number(e.target.value))} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Canonical Match Confidence Threshold</label>
            <input type="number" value={settings.canonicalMatchConfidenceThreshold} min={0} max={1} step={0.01} onChange={(e) => update("canonicalMatchConfidenceThreshold", Number(e.target.value))} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]" />
          </div>
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4">Automation</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5">
            <span className="text-[13px] font-semibold text-[var(--wk-text)]">Auto-Create Release Shells</span>
            <button onClick={() => update("autoCreateReleaseShells", !settings.autoCreateReleaseShells)} className={`relative h-6 w-11 rounded-full transition-colors ${settings.autoCreateReleaseShells ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--wk-surface)] transition-transform ${settings.autoCreateReleaseShells ? "translate-x-5.5" : "translate-x-0.5"}`} />
            </button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5">
            <span className="text-[13px] font-semibold text-[var(--wk-text)]">Auto-Send No-Match Rows to Review</span>
            <button onClick={() => update("autoSendNoMatchRowsToReview", !settings.autoSendNoMatchRowsToReview)} className={`relative h-6 w-11 rounded-full transition-colors ${settings.autoSendNoMatchRowsToReview ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--wk-surface)] transition-transform ${settings.autoSendNoMatchRowsToReview ? "translate-x-5.5" : "translate-x-0.5"}`} />
            </button>
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

      <WkSurface className="p-4 border-l-4 border-[var(--wk-brand)]">
        <h3 className="text-[13px] font-bold text-[var(--wk-text)] mb-2">Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate("/admin/charts/review-queue")} className="rounded-md border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] px-3 py-1.5 text-[12px] font-semibold text-[var(--wk-text-soft)] hover:text-[var(--wk-brand)] transition-colors whitespace-nowrap">Open Review Queue</button>
          <button onClick={() => navigate("/admin/charts/release-shells")} className="rounded-md border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] px-3 py-1.5 text-[12px] font-semibold text-[var(--wk-text-soft)] hover:text-[var(--wk-brand)] transition-colors whitespace-nowrap">Open Release Shells</button>
          <button onClick={() => navigate("/admin/charts/canon-gaps")} className="rounded-md border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] px-3 py-1.5 text-[12px] font-semibold text-[var(--wk-text-soft)] hover:text-[var(--wk-brand)] transition-colors whitespace-nowrap">Open Canon Gaps</button>
        </div>
      </WkSurface>
    </div>
  );
}