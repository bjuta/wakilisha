import { useMemo } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { SearchableSelect } from "@/components/design-system/primitives/SearchableSelect";
import type { ProviderName } from "@/services/chartsIngestion/ingestStudioTypes";
import type { ChartFamily } from "@/services/chartsIngestion/types";
import type { ChartFamilyDefaults, ChartFamilyDefaultsDiff } from "@/services/chartsIngestion/chartFamilyDefaultsStore";
import { Music, Disc3, Save, RotateCcw, CheckCircle2, History } from "lucide-react";
import { QuickTemplateButton, ProviderChip, KindToggle } from "./FormComponents";
import { getSortedCountryCodes, getCountryNameForIso2 } from "@/utils/countries";

const INPUT_CLASS = "w-full rounded-md border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none focus:border-wk-border-strong focus:ring-1 focus:ring-wk-brand/20";
const LABEL_CLASS = "mb-1 block text-[12px] font-semibold text-wk-text-soft";
const BTN_PRIMARY = "inline-flex items-center gap-1.5 rounded-md bg-wk-brand px-5 py-2.5 text-[13px] font-semibold text-wk-brand-on transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 whitespace-nowrap";
const BTN_GHOST = "inline-flex items-center gap-1.5 rounded-md border border-wk-border bg-wk-surface px-4 py-2.5 text-[13px] font-semibold text-wk-text-soft transition-colors hover:bg-wk-surface-raised whitespace-nowrap";

type QuickTemplateKey = "top40" | "kenyan" | "groups" | "eastAfrica";

type ProgramSetupStepProps = {
  families: ChartFamily[];
  selectedFamily: ChartFamily | null;
  existingSeriesId: string;
  setExistingSeriesId: (value: string) => void;
  newSeriesLabel: string;
  setNewSeriesLabel: (value: string) => void;
  newSeriesKey: string;
  setNewSeriesKey: (value: string) => void;
  onCreateSeries: () => void;
  chartTitle: string;
  setChartTitle: (value: string) => void;
  chartSlug: string;
  setChartSlug: (value: string) => void;
  publicUrlPreview: string | null;
  editionDate: string;
  setEditionDate: (value: string) => void;
  chartSize: number;
  setChartSize: (value: number) => void;
  market: string;
  setMarket: (value: string) => void;
  sourceUrls: string;
  setSourceUrls: (value: string) => void;
  detectedProviders: ProviderName[];
  chartKind: "tracks" | "releases";
  setChartKind: (value: "tracks" | "releases") => void;
  coverStyle: string;
  setCoverStyle: (value: string) => void;
  saveAsRecurring: boolean;
  setSaveAsRecurring: (value: boolean) => void;
  onQuickTemplate: (template: QuickTemplateKey) => void;
  onContinueToRules: () => void;
  onReset: () => void;
  familyDefaults: ChartFamilyDefaults | null;
  defaultsDiff: ChartFamilyDefaultsDiff;
  onSaveDefaults: () => void;
  onResetToDefaults: () => void;
  familiesWithDefaults: Set<string>;
};

const FIELD_LABELS: Record<string, string> = {
  chartTitle: "Title",
  chartSlug: "Slug",
  chartSize: "Chart size",
  market: "Market",
  chartKind: "Chart kind",
  coverStyle: "Cover style",
  eligibilityProfileId: "Eligibility profile",
  marketScopeId: "Market scope",
  sourceUrlsTemplate: "Source URLs",
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function ProgramSetupStep(props: ProgramSetupStepProps) {
  const {
    families,
    selectedFamily,
    existingSeriesId,
    setExistingSeriesId,
    newSeriesLabel,
    setNewSeriesLabel,
    newSeriesKey,
    setNewSeriesKey,
    onCreateSeries,
    chartTitle,
    setChartTitle,
    chartSlug,
    setChartSlug,
    publicUrlPreview,
    editionDate,
    setEditionDate,
    chartSize,
    setChartSize,
    market,
    setMarket,
    sourceUrls,
    setSourceUrls,
    detectedProviders,
    chartKind,
    setChartKind,
    coverStyle,
    setCoverStyle,
    saveAsRecurring,
    setSaveAsRecurring,
    onQuickTemplate,
    onContinueToRules,
    onReset,
    familyDefaults,
    defaultsDiff,
    onSaveDefaults,
    onResetToDefaults,
    familiesWithDefaults,
  } = props;

  const hasDefaults = defaultsDiff.hasDefaults;
  const hasChanges = hasDefaults && defaultsDiff.changedCount > 0;
  const changedFieldNames = hasDefaults
    ? Object.entries(defaultsDiff.fields)
        .filter(([, changed]) => changed)
        .map(([key]) => FIELD_LABELS[key] ?? key)
    : [];

  const countryOptions = useMemo(
    () =>
      getSortedCountryCodes().map((code) => ({
        value: code,
        label: getCountryNameForIso2(code),
      })),
    [],
  );

  return (
    <WkSurface className="p-5">
      <h2 className="mb-4 text-[16px] font-bold text-wk-text">Program & Sources</h2>

      <div className="mb-5">
        <label className={LABEL_CLASS}>Quick Start</label>
        <div className="flex flex-wrap gap-2">
          <QuickTemplateButton label="Top 40 Kenya" onClick={() => onQuickTemplate("top40")} />
          <QuickTemplateButton label="Kenyan Artists Only" onClick={() => onQuickTemplate("kenyan")} />
          <QuickTemplateButton label="Groups Only" onClick={() => onQuickTemplate("groups")} />
          <QuickTemplateButton label="EA Artists" onClick={() => onQuickTemplate("eastAfrica")} />
        </div>
      </div>

      <div className="mb-4">
        <label className={LABEL_CLASS}>Chart Family *</label>
        <select value={existingSeriesId} onChange={(event) => setExistingSeriesId(event.target.value)} className={INPUT_CLASS}>
          <option value="">— Select a family —</option>
          {families.map((family) => (
            <option key={family.id} value={family.id}>
              {family.label} ({family.familyKey}){familiesWithDefaults.has(family.id) ? " *" : ""}
            </option>
          ))}
          <option value="__new__">+ Create new family…</option>
        </select>

        {selectedFamily && (
          <div className="mt-2 rounded-lg border border-wk-border bg-wk-surface-raised p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[12px] font-bold text-wk-text">{selectedFamily.label}</span>
              <span className="rounded bg-wk-bg-subtle px-1.5 py-0.5 text-[10px] font-semibold text-wk-text-muted">{selectedFamily.editionFrequency}</span>
              <span className="rounded bg-wk-bg-subtle px-1.5 py-0.5 text-[10px] font-semibold text-wk-text-muted">{selectedFamily.defaultRegion}</span>
            </div>
            <p className="text-[11px] text-wk-text-muted">{selectedFamily.description}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-wk-text-soft">
              <span>Default size: <strong className="text-wk-text">{selectedFamily.defaultChartSize}</strong></span>
              <span>Ruleset: <strong className="text-wk-text">{selectedFamily.defaultRuleset}</strong></span>
              <span>Scoring: <strong className="text-wk-text">{selectedFamily.defaultScoringModel}</strong></span>
            </div>
          </div>
        )}

        {existingSeriesId === "__new__" && (
          <div className="mt-2 rounded-lg border border-wk-brand/20 bg-wk-brand-soft p-3">
            <p className="mb-2 text-[12px] font-semibold text-wk-brand">Create New Family</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={newSeriesLabel}
                onChange={(event) => {
                  setNewSeriesLabel(event.target.value);
                  setNewSeriesKey(event.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""));
                }}
                placeholder="Family name"
                className={INPUT_CLASS}
              />
              <input type="text" value={newSeriesKey} onChange={(event) => setNewSeriesKey(event.target.value)} placeholder="family-key" className={INPUT_CLASS} />
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={onCreateSeries} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">Create Family</button>
              <button onClick={() => { setExistingSeriesId(""); setNewSeriesLabel(""); setNewSeriesKey(""); }} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Family Defaults Card ── */}
      {selectedFamily && (
        <div className="mb-4 rounded-lg border p-3 transition-all" style={{
          borderColor: hasDefaults ? "var(--wk-success)" : "var(--wk-border)",
          backgroundColor: hasDefaults ? "var(--wk-success-soft)" : "var(--wk-surface-raised)",
        }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md mt-0.5" style={{
                backgroundColor: hasDefaults ? "var(--wk-success)" : "var(--wk-text-faint)/15",
                color: hasDefaults ? "#fff" : "var(--wk-text-muted)",
              }}>
                {hasDefaults ? <CheckCircle2 size={14} /> : <Save size={14} />}
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-wk-text">
                  {hasDefaults ? "Family defaults loaded" : "No saved defaults"}
                </p>
                {hasDefaults && familyDefaults ? (
                  <div className="mt-0.5 text-[11px] text-wk-text-muted">
                    <span>Last saved <strong className="text-wk-text-soft">{formatDate(familyDefaults.updatedAt)}</strong></span>
                    {familyDefaults.updatedBy && (
                      <span> by <strong className="text-wk-text-soft">{familyDefaults.updatedBy}</strong></span>
                    )}
                  </div>
                ) : (
                  <p className="mt-0.5 text-[11px] text-wk-text-muted">
                    Save your current configuration to reuse for future editions of this family.
                  </p>
                )}
                {hasChanges && (
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 rounded-full bg-wk-warning-soft px-2 py-0.5 text-[10px] font-semibold text-wk-warning">
                      <History size={10} />
                      {defaultsDiff.changedCount} field{defaultsDiff.changedCount !== 1 ? "s" : ""} modified
                    </span>
                    <span className="text-[10px] text-wk-text-muted truncate max-w-[240px]">
                      {changedFieldNames.slice(0, 3).join(", ")}{changedFieldNames.length > 3 ? ` +${changedFieldNames.length - 3} more` : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {hasChanges && (
                <button
                  onClick={onResetToDefaults}
                  className="inline-flex items-center gap-1 rounded-md border border-wk-border bg-wk-surface px-2.5 py-1.5 text-[11px] font-semibold text-wk-text-soft transition-colors hover:bg-wk-surface-raised whitespace-nowrap"
                  title="Reset all fields to saved defaults"
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
              )}
              <button
                onClick={onSaveDefaults}
                className="inline-flex items-center gap-1 rounded-md bg-wk-success px-2.5 py-1.5 text-[11px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.97] whitespace-nowrap"
                title="Save current configuration as defaults for this chart family"
              >
                <Save size={12} />
                {hasDefaults ? "Update defaults" : "Save as defaults"}
              </button>
            </div>
          </div>

          {hasDefaults && familyDefaults && (
            <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {[
                { label: "Chart size", value: familyDefaults.chartSize, changed: defaultsDiff.fields.chartSize },
                { label: "Market", value: familyDefaults.market, changed: defaultsDiff.fields.market },
                { label: "Kind", value: familyDefaults.chartKind === "tracks" ? "Tracks" : "Releases", changed: defaultsDiff.fields.chartKind },
                { label: "Cover", value: familyDefaults.coverStyle, changed: defaultsDiff.fields.coverStyle },
              ].map((item) => (
                <div key={item.label} className="rounded-md bg-wk-surface px-2 py-1.5 border border-wk-border/50">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-wk-text-faint">{item.label}</p>
                  <p className={`text-[11px] font-semibold truncate ${item.changed ? "text-wk-warning line-through" : "text-wk-text"}`}>
                    {item.value}
                    {item.changed && (
                      <span className="ml-1 text-[10px] text-wk-text-muted no-underline">(modified)</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* ── end Family Defaults Card ── */}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL_CLASS}>Chart Title *</label>
          <input type="text" value={chartTitle} onChange={(event) => setChartTitle(event.target.value)} placeholder="e.g. WAKILISHA Top 40 — Week 22" className={INPUT_CLASS} />
        </div>
        <div>
          <label className={LABEL_CLASS}>Chart Slug *</label>
          <input type="text" value={chartSlug} onChange={(event) => setChartSlug(event.target.value)} placeholder="wakilisha-top-40-week-22" className={INPUT_CLASS} />
          {publicUrlPreview && <p className="mt-1 text-[11px] text-wk-text-muted">Public URL: <span className="font-semibold text-wk-brand">{publicUrlPreview}</span></p>}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={LABEL_CLASS}>Edition Date *</label>
          <input type="date" value={editionDate} onChange={(event) => setEditionDate(event.target.value)} className={INPUT_CLASS} />
          <p className="mt-1 text-[11px] text-wk-text-muted">Usually the chart week (Monday)</p>
        </div>
        <div>
          <label className={LABEL_CLASS}>Chart Size *</label>
          <div className="flex items-center gap-2">
            <input type="range" min={10} max={100} step={10} value={chartSize} onChange={(event) => setChartSize(Number(event.target.value))} className="flex-1 accent-wk-brand" />
            <span className="w-10 text-right text-[13px] font-bold text-wk-text">{chartSize}</span>
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS}>Market *</label>
          <SearchableSelect
            options={countryOptions}
            value={market}
            onChange={setMarket}
            placeholder="Search countries..."
          />
        </div>
      </div>

      <div className="mb-4">
        <label className={LABEL_CLASS}>Source URLs * (one per line)</label>
        <textarea value={sourceUrls} onChange={(event) => setSourceUrls(event.target.value)} rows={3} placeholder="https://open.spotify.com/playlist/...&#10;https://music.apple.com/..." className={`${INPUT_CLASS} resize-none`} />
        {detectedProviders.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {detectedProviders.map((provider) => <ProviderChip key={provider} provider={provider} />)}
          </div>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL_CLASS}>Chart Kind</label>
          <div className="flex gap-2">
            <KindToggle active={chartKind === "tracks"} onClick={() => setChartKind("tracks")} icon={Music} label="Tracks" />
            <KindToggle active={chartKind === "releases"} onClick={() => setChartKind("releases")} icon={Disc3} label="Releases" />
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS}>Cover Style</label>
          <select value={coverStyle} onChange={(event) => setCoverStyle(event.target.value)} className={INPUT_CLASS}>
            <option value="default">Default</option>
            <option value="genre">Genre</option>
            <option value="minimal">Minimal</option>
            <option value="editorial">Editorial</option>
          </select>
        </div>
      </div>

      <div className="mb-5">
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 transition-colors hover:bg-wk-surface-raised">
          <input type="checkbox" checked={saveAsRecurring} onChange={(event) => setSaveAsRecurring(event.target.checked)} className="h-4 w-4 rounded border-wk-border accent-wk-brand" />
          <span className="text-[13px] text-wk-text-soft">Save as recurring family</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-wk-divider pt-2">
        <button onClick={onContinueToRules} className={BTN_PRIMARY}><WkIcon name="SlidersHorizontal" size={14} />Continue to Rules</button>
        <button onClick={onReset} className={BTN_GHOST}><WkIcon name="RotateCcw" size={14} />Reset</button>
      </div>
    </WkSurface>
  );
}