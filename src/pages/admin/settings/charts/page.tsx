import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  getChartSettings,
  saveDomainSettings,
} from "@/services/adminSettings/settingsStore";
import {
  DEFAULT_CHART_SETTINGS,
  type ChartSettings,
} from "@/services/adminSettings/settingsTypes";

export default function AdminSettingsCharts() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<ChartSettings>(getChartSettings());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = useCallback(<K extends keyof ChartSettings>(key: K, value: ChartSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      saveDomainSettings("charts", settings);
      setSaved(true);
      setSaving(false);
    }, 400);
  };

  const handleReset = () => {
    setSettings(DEFAULT_CHART_SETTINGS);
    setSaved(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <WkIcon name="BarChart3" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Chart Settings</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">
          Chart-specific defaults that feed into the ingest studio, editions, and public API.
        </p>
      </div>

      {/* General */}
      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4 flex items-center gap-2">
          <WkIcon name="SlidersHorizontal" size={16} />
          General Defaults
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField
            label="Default Chart Size"
            value={settings.defaultChartSize}
            onChange={(v) => update("defaultChartSize", v)}
            min={10}
            max={200}
          />
          <TextField
            label="Default Market"
            value={settings.defaultMarket}
            onChange={(v) => update("defaultMarket", v)}
          />
          <SelectField
            label="Default Period Type"
            value={settings.defaultPeriodType}
            onChange={(v) => update("defaultPeriodType", v as "weekly" | "daily" | "monthly")}
            options={[
              { value: "weekly", label: "Weekly" },
              { value: "daily", label: "Daily" },
              { value: "monthly", label: "Monthly" },
            ]}
          />
          <SelectField
            label="Default Chart Kind"
            value={settings.defaultChartKind}
            onChange={(v) => update("defaultChartKind", v as "tracks" | "releases" | "artists" | "videos")}
            options={[
              { value: "tracks", label: "Tracks" },
              { value: "releases", label: "Releases" },
              { value: "artists", label: "Artists" },
              { value: "videos", label: "Videos" },
            ]}
          />
          <SelectField
            label="Default Cover Style"
            value={settings.defaultCoverStyle}
            onChange={(v) => update("defaultCoverStyle", v as "artwork" | "photo" | "abstract")}
            options={[
              { value: "artwork", label: "Artwork" },
              { value: "photo", label: "Photo" },
              { value: "abstract", label: "Abstract" },
            ]}
          />
          <TextField
            label="Default Source Priority"
            value={settings.defaultSourceProviderPriority.join(", ")}
            onChange={(v) => update("defaultSourceProviderPriority", v.split(",").map((s) => s.trim()).filter(Boolean))}
          />
        </div>
      </WkSurface>

      {/* Ingest Rules */}
      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4 flex items-center gap-2">
          <WkIcon name="ShieldCheck" size={16} />
          Ingest Rules
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleField
            label="Default Dry Run Mode"
            value={settings.defaultDryRunMode}
            onChange={(v) => update("defaultDryRunMode", v)}
          />
          <ToggleField
            label="Allow Partial Source Success"
            value={settings.allowPartialSourceSuccess}
            onChange={(v) => update("allowPartialSourceSuccess", v)}
          />
          <ToggleField
            label="Block Commit if Review Gaps Exist"
            value={settings.blockCommitIfReviewGaps}
            onChange={(v) => update("blockCommitIfReviewGaps", v)}
          />
          <ToggleField
            label="Block Commit if Enrichment Warnings"
            value={settings.blockCommitIfEnrichmentWarnings}
            onChange={(v) => update("blockCommitIfEnrichmentWarnings", v)}
          />
          <ToggleField
            label="Block Duplicate Editions"
            value={settings.blockDuplicateEditions}
            onChange={(v) => update("blockDuplicateEditions", v)}
          />
          <SelectField
            label="Default Unresolved Row Behavior"
            value={settings.defaultUnresolvedRowBehavior}
            onChange={(v) => update("defaultUnresolvedRowBehavior", v as "shell" | "ignore" | "review")}
            options={[
              { value: "shell", label: "Create Shell" },
              { value: "ignore", label: "Ignore" },
              { value: "review", label: "Send to Review" },
            ]}
          />
        </div>
      </WkSurface>

      {/* V2 Defaults */}
      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4 flex items-center gap-2">
          <WkIcon name="Layers" size={16} />
          V2 Program Defaults
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Default Methodology Version"
            value={settings.v2ProgramDefaults.defaultMethodologyVersion}
            onChange={(v) =>
              update("v2ProgramDefaults", {
                ...settings.v2ProgramDefaults,
                defaultMethodologyVersion: v,
              })
            }
          />
          <TextField
            label="Default Eligibility Rules Version"
            value={settings.v2ProgramDefaults.defaultEligibilityRulesVersion}
            onChange={(v) =>
              update("v2ProgramDefaults", {
                ...settings.v2ProgramDefaults,
                defaultEligibilityRulesVersion: v,
              })
            }
          />
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

      {/* Links */}
      <WkSurface className="p-4 border-l-4 border-[var(--wk-brand)]">
        <h3 className="text-[13px] font-bold text-[var(--wk-text)] mb-2">Feeds</h3>
        <div className="flex flex-wrap gap-2">
          <LinkButton label="Ingest Studio" path="/admin/charts/ingest" navigate={navigate} />
          <LinkButton label="Ingest Runs" path="/admin/charts/ingest-runs" navigate={navigate} />
          <LinkButton label="Editions" path="/admin/charts/editions" navigate={navigate} />
          <LinkButton label="Public API QA" path="/admin/charts/public-api-qa" navigate={navigate} />
        </div>
      </WkSurface>
    </div>
  );
}

/* ──────── Shared Field Components ──────── */

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
      />
    </div>
  );
}

function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5">
      <span className="text-[13px] font-semibold text-[var(--wk-text)]">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition-colors ${value ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--wk-surface)] transition-transform ${value ? "translate-x-5.5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

function LinkButton({ label, path, navigate }: { label: string; path: string; navigate: (p: string) => void }) {
  return (
    <button
      onClick={() => navigate(path)}
      className="rounded-md border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] px-3 py-1.5 text-[12px] font-semibold text-[var(--wk-text-soft)] hover:text-[var(--wk-brand)] transition-colors whitespace-nowrap"
    >
      {label}
    </button>
  );
}