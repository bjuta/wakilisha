import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  createMarketScope,
  getMarketScopes,
  resetMarketScopes,
  updateMarketScope,
  type StoredChartMarketScope,
} from "@/services/chartsMarkets/marketScopeStore";

const INPUT_CLASS = "w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]";
const LABEL_CLASS = "mb-1.5 block text-[12px] font-semibold text-[var(--wk-text-muted)]";

type MarketDraft = {
  marketSlug: string;
  countryCode: string;
  weight: string;
};

type ScopeDraft = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  visibility: "public" | "admin_only";
  primaryMarketSlug: string;
  aggregationMode: StoredChartMarketScope["aggregationMode"];
  includedMarkets: MarketDraft[];
};

const blankDraft: ScopeDraft = {
  name: "",
  slug: "",
  description: "",
  visibility: "admin_only",
  primaryMarketSlug: "",
  aggregationMode: "combined",
  includedMarkets: [{ marketSlug: "", countryCode: "", weight: "" }],
};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function toDraft(scope: StoredChartMarketScope): ScopeDraft {
  return {
    id: scope.id,
    name: scope.name,
    slug: scope.slug,
    description: scope.description,
    visibility: scope.visibility,
    primaryMarketSlug: scope.primaryMarketSlug,
    aggregationMode: scope.aggregationMode,
    includedMarkets: scope.includedMarkets.map((market) => ({
      marketSlug: market.marketSlug,
      countryCode: market.countryCode,
      weight: market.weight ? String(market.weight) : "",
    })),
  };
}

function toScopePayload(draft: ScopeDraft) {
  const includedMarkets = draft.includedMarkets
    .filter((market) => market.marketSlug.trim() && market.countryCode.trim())
    .map((market) => ({
      marketSlug: slugify(market.marketSlug),
      countryCode: market.countryCode.trim().toUpperCase(),
      ...(market.weight.trim() ? { weight: Number(market.weight) } : {}),
    }));

  return {
    id: draft.id,
    name: draft.name.trim(),
    slug: slugify(draft.slug || draft.name),
    description: draft.description.trim(),
    visibility: draft.visibility,
    primaryMarketSlug: slugify(draft.primaryMarketSlug || includedMarkets[0]?.marketSlug || draft.name),
    aggregationMode: draft.aggregationMode,
    includedMarkets,
  };
}

export default function AdminSettingsChartMarketScopes() {
  const navigate = useNavigate();
  const [scopes, setScopes] = useState<StoredChartMarketScope[]>(getMarketScopes());
  const [draft, setDraft] = useState<ScopeDraft>(blankDraft);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedScope = useMemo(() => scopes.find((scope) => scope.id === selectedId) ?? null, [scopes, selectedId]);

  function refresh() {
    setScopes(getMarketScopes());
  }

  function selectScope(scope: StoredChartMarketScope) {
    setSelectedId(scope.id);
    setDraft(toDraft(scope));
    setSaved(false);
    setError(null);
  }

  function newScope() {
    setSelectedId(null);
    setDraft(blankDraft);
    setSaved(false);
    setError(null);
  }

  function patch<K extends keyof ScopeDraft>(key: K, value: ScopeDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function patchMarket(index: number, key: keyof MarketDraft, value: string) {
    setDraft((prev) => ({
      ...prev,
      includedMarkets: prev.includedMarkets.map((market, i) => (i === index ? { ...market, [key]: value } : market)),
    }));
    setSaved(false);
  }

  function addMarket() {
    setDraft((prev) => ({ ...prev, includedMarkets: [...prev.includedMarkets, { marketSlug: "", countryCode: "", weight: "" }] }));
  }

  function removeMarket(index: number) {
    setDraft((prev) => ({ ...prev, includedMarkets: prev.includedMarkets.filter((_, i) => i !== index) }));
  }

  function saveScope() {
    setError(null);
    const payload = toScopePayload(draft);
    if (!payload.name) return setError("Scope name is required.");
    if (!payload.slug) return setError("Scope slug is required.");
    if (!payload.includedMarkets.length) return setError("Add at least one included market.");
    if (payload.includedMarkets.some((market) => market.countryCode.length !== 2)) return setError("Country codes must be ISO2 codes such as KE, UG, TZ, NG.");

    try {
      if (draft.id) updateMarketScope({ ...payload, id: draft.id });
      else createMarketScope(payload);
      refresh();
      setSaved(true);
      if (!draft.id) setDraft(blankDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save market scope.");
    }
  }

  function resetDefaults() {
    setScopes(resetMarketScopes());
    setSelectedId(null);
    setDraft(blankDraft);
    setSaved(false);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <WkIcon name="Globe2" size={20} className="text-[var(--wk-brand)]" />
            <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Chart Market Scopes</h1>
          </div>
          <p className="max-w-3xl text-[13px] text-[var(--wk-text-muted)]">
            Admin-tunable market logic for ingest setup. Use this to define single-country scopes, multi-country scopes, weighting, and whether a scope is public-facing or internal analytics only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate("/admin/charts/ingest")} className="wk-button wk-button-ghost wk-button-sm">Open Ingest Studio</button>
          <button onClick={newScope} className="wk-button wk-button-primary wk-button-sm">New Scope</button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--wk-danger)]/20 bg-[var(--wk-danger-soft)] p-3 text-[13px] font-semibold text-[var(--wk-danger)]">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-lg border border-[var(--wk-success)]/20 bg-[var(--wk-success-soft)] p-3 text-[13px] font-semibold text-[var(--wk-success)]">
          Market scope saved. It is now available in the Ingest Studio Rules step.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <WkSurface className="p-4 lg:col-span-1">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Configured Scopes</h2>
            <span className="rounded-full bg-[var(--wk-surface-raised)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-text-muted)]">{scopes.length}</span>
          </div>
          <div className="space-y-2">
            {scopes.map((scope) => (
              <button
                key={scope.id}
                onClick={() => selectScope(scope)}
                className={`w-full rounded-xl border p-3 text-left transition-all ${selectedScope?.id === scope.id ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)]" : "border-[var(--wk-border)] bg-[var(--wk-bg)] hover:bg-[var(--wk-surface-raised)]"}`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold text-[var(--wk-text)]">{scope.name}</span>
                  <span className="text-[10px] font-bold uppercase text-[var(--wk-text-faint)]">{scope.visibility === "public" ? "public" : "admin"}</span>
                </div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">{scope.includedMarkets.map((m) => m.countryCode).join(" + ")} · {scope.aggregationMode.replace(/_/g, " ")}</div>
              </button>
            ))}
          </div>
          <button onClick={resetDefaults} className="mt-4 w-full rounded-lg border border-[var(--wk-border)] px-3 py-2 text-[12px] font-semibold text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]">
            Reset scopes to defaults
          </button>
        </WkSurface>

        <WkSurface className="p-5 lg:col-span-2">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold text-[var(--wk-text)]">{draft.id ? "Edit Market Scope" : "Create Market Scope"}</h2>
              <p className="text-[12px] text-[var(--wk-text-muted)]">These values feed the Ingest Studio, dry-run diagnostics, and future country-level chart coverage reporting.</p>
            </div>
            {draft.id && <span className="rounded-full bg-[var(--wk-surface-raised)] px-2.5 py-1 text-[11px] font-semibold text-[var(--wk-text-muted)]">{draft.id}</span>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Scope Name" value={draft.name} onChange={(value) => { patch("name", value); if (!draft.slug) patch("slug", slugify(value)); }} />
            <TextField label="Slug" value={draft.slug} onChange={(value) => patch("slug", slugify(value))} />
            <TextField label="Primary Market Slug" value={draft.primaryMarketSlug} onChange={(value) => patch("primaryMarketSlug", slugify(value))} />
            <SelectField
              label="Visibility"
              value={draft.visibility}
              onChange={(value) => patch("visibility", value as ScopeDraft["visibility"])}
              options={[{ value: "public", label: "Public-facing" }, { value: "admin_only", label: "Admin analytics only" }]}
            />
            <SelectField
              label="Aggregation Mode"
              value={draft.aggregationMode}
              onChange={(value) => patch("aggregationMode", value as ScopeDraft["aggregationMode"])}
              options={[
                { value: "combined", label: "Combined" },
                { value: "separate_then_combined", label: "Separate then combined" },
                { value: "weighted", label: "Weighted" },
                { value: "minimum_presence", label: "Minimum presence" },
                { value: "editorial", label: "Editorial" },
              ]}
            />
            <div className="sm:col-span-2">
              <TextAreaField label="Description" value={draft.description} onChange={(value) => patch("description", value)} />
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-[13px] font-bold text-[var(--wk-text)]">Included Markets</h3>
              <button onClick={addMarket} className="rounded-lg border border-[var(--wk-border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]">Add Market</button>
            </div>
            <div className="space-y-2">
              {draft.includedMarkets.map((market, index) => (
                <div key={index} className="grid gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3 sm:grid-cols-[1fr_110px_110px_auto]">
                  <TextField label="Market Slug" value={market.marketSlug} onChange={(value) => patchMarket(index, "marketSlug", value)} />
                  <TextField label="ISO2" value={market.countryCode} onChange={(value) => patchMarket(index, "countryCode", value.toUpperCase())} />
                  <TextField label="Weight" value={market.weight} onChange={(value) => patchMarket(index, "weight", value)} />
                  <button onClick={() => removeMarket(index)} disabled={draft.includedMarkets.length === 1} className="self-end rounded-lg border border-[var(--wk-border)] px-3 py-2 text-[12px] font-semibold text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] disabled:opacity-40">Remove</button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--wk-border)] pt-4">
            <button onClick={saveScope} className="wk-button wk-button-primary wk-button-sm flex items-center gap-2">
              <WkIcon name="Save" size={14} /> Save Market Scope
            </button>
            <button onClick={newScope} className="wk-button wk-button-ghost wk-button-sm">Clear Form</button>
          </div>
        </WkSurface>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      <input value={value} onChange={(event) => onChange(event.target.value)} className={INPUT_CLASS} />
    </div>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className={`${INPUT_CLASS} resize-none`} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={INPUT_CLASS}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}
