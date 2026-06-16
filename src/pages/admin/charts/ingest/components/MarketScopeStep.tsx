import { useEffect, useMemo, useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  createMarketScope,
  getMarketScopes,
  type StoredChartMarketScope,
} from "@/services/chartsMarkets/marketScopeStore";
import { setCurrentIngestMarketScopeSelection } from "@/services/chartsMarkets/marketScopePersistence";
import {
  getSortedCountryCodes,
  getCountryNameForIso2,
  iso2ToCountrySlug,
} from "@/utils/countries";

const INPUT_CLASS = "w-full rounded-md border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none focus:border-wk-border-strong focus:ring-1 focus:ring-wk-brand/20";
const LABEL_CLASS = "mb-1 block text-[12px] font-semibold text-wk-text-soft";

type MarketScopeStepProps = {
  scopes: StoredChartMarketScope[];
  selectedMarketScopeId: string;
  onSelectMarketScope: (scopeId: string) => void;
};

function formatAggregation(value: StoredChartMarketScope["aggregationMode"]): string {
  return value.replace(/_/g, " ");
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function toScopePatch(scope: StoredChartMarketScope) {
  return {
    marketScopeId: scope.id,
    marketScopeSnapshot: {
      id: scope.id,
      name: scope.name,
      slug: scope.slug,
      primaryMarketSlug: scope.primaryMarketSlug,
      includedMarkets: scope.includedMarkets,
      aggregationMode: scope.aggregationMode,
      artistOriginCountries: scope.artistOriginCountries ?? [],
      artistOriginUnknownMode: scope.artistOriginUnknownMode ?? "exclude",
    },
  };
}

export function MarketScopeStep({ scopes, selectedMarketScopeId, onSelectMarketScope }: MarketScopeStepProps) {
  const [localScopes, setLocalScopes] = useState<StoredChartMarketScope[]>(() => scopes.length ? scopes : getMarketScopes());
  const [showCreate, setShowCreate] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftSlug, setDraftSlug] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftMarkets, setDraftMarkets] = useState<string[]>(["KE"]);
  const [draftAggregation, setDraftAggregation] = useState<StoredChartMarketScope["aggregationMode"]>("combined");
  const [draftVisibility, setDraftVisibility] = useState<StoredChartMarketScope["visibility"]>("admin_only");
  const [draftArtistOriginCountries, setDraftArtistOriginCountries] = useState<string[]>([]);
  const [draftArtistOriginUnknownMode, setDraftArtistOriginUnknownMode] = useState<"exclude" | "warn" | "include">("exclude");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (scopes.length) setLocalScopes(scopes);
  }, [scopes]);

  const selectedScope = useMemo(
    () => localScopes.find((scope) => scope.id === selectedMarketScopeId || scope.slug === selectedMarketScopeId) ?? localScopes[0],
    [localScopes, selectedMarketScopeId]
  );

  useEffect(() => {
    if (selectedScope) setCurrentIngestMarketScopeSelection(toScopePatch(selectedScope));
  }, [selectedScope]);

  function handleSelection(scopeId: string) {
    const scope = localScopes.find((item) => item.id === scopeId || item.slug === scopeId);
    if (scope) setCurrentIngestMarketScopeSelection(toScopePatch(scope));
    onSelectMarketScope(scopeId);
  }

  function toggleCountry(countryCode: string) {
    setDraftMarkets((current) => {
      if (current.includes(countryCode)) return current.filter((item) => item !== countryCode);
      return [...current, countryCode];
    });
  }

  function resetDraft() {
    setDraftName("");
    setDraftSlug("");
    setDraftDescription("");
    setDraftMarkets(["KE"]);
    setDraftAggregation("combined");
    setDraftVisibility("admin_only");
    setDraftArtistOriginCountries([]);
    setDraftArtistOriginUnknownMode("exclude");
    setError(null);
  }

  function createScopeFromDraft() {
    const name = draftName.trim();
    const slug = slugify(draftSlug || name);
    if (!name) { setError("Scope name is required."); return; }
    if (!slug) { setError("Scope slug is required."); return; }
    if (draftMarkets.length === 0) { setError("Select at least one included country."); return; }

    const includedMarkets = draftMarkets
      .map((countryCode) => ({ marketSlug: iso2ToCountrySlug(countryCode), countryCode: countryCode.toUpperCase(), weight: 1 }));

    try {
      const created = createMarketScope({
        name,
        slug,
        description: draftDescription.trim() || `${name} market scope created from Ingest Studio.`,
        visibility: draftVisibility,
        primaryMarketSlug: includedMarkets.length === 1 ? includedMarkets[0].marketSlug : slug,
        includedMarkets,
        aggregationMode: draftAggregation,
        artistOriginCountries: draftArtistOriginCountries,
        artistOriginUnknownMode: draftArtistOriginUnknownMode,
      });
      const next = getMarketScopes();
      setLocalScopes(next);
      setCurrentIngestMarketScopeSelection(toScopePatch(created));
      onSelectMarketScope(created.id);
      setShowCreate(false);
      resetDraft();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create market scope.");
    }
  }

  return (
    <WkSurface className="p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-bold text-wk-text">Market Scope</h3>
          <p className="mt-1 text-[12px] text-wk-text-soft">
            Choose or tune the market logic for this ingest. Multi-country scopes preserve each country separately for analytics instead of flattening them into one vague region.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((value) => !value)}
          className="rounded-full bg-wk-brand-soft px-2.5 py-1 text-[11px] font-bold text-wk-brand"
        >
          {showCreate ? "Close tuner" : "+ Tune scope"}
        </button>
      </div>

      <div className="mb-4">
        <label className={LABEL_CLASS}>Scope</label>
        <select value={selectedMarketScopeId} onChange={(event) => handleSelection(event.target.value)} className={INPUT_CLASS}>
          {localScopes.map((scope) => (
            <option key={scope.id} value={scope.id}>{scope.name} ({scope.slug})</option>
          ))}
        </select>
      </div>

      {showCreate && (
        <div className="mb-4 rounded-xl border border-wk-brand/20 bg-wk-brand-soft/40 p-4">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-bold text-wk-text">
            <WkIcon name="SlidersHorizontal" size={14} className="text-wk-brand" />
            Create ingest-specific market scope
          </div>
          {error && <div className="mb-3 rounded-lg border border-wk-danger/20 bg-wk-danger-soft p-2 text-[11px] font-semibold text-wk-danger">{error}</div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL_CLASS}>Scope name *</label>
              <input value={draftName} onChange={(event) => { setDraftName(event.target.value); if (!draftSlug) setDraftSlug(slugify(event.target.value)); }} className={INPUT_CLASS} placeholder="Kenya + Uganda + Tanzania" />
            </div>
            <div>
              <label className={LABEL_CLASS}>Slug *</label>
              <input value={draftSlug} onChange={(event) => setDraftSlug(event.target.value)} className={INPUT_CLASS} placeholder="east-africa-ke-ug-tz" />
            </div>
            <div>
              <label className={LABEL_CLASS}>Aggregation</label>
              <select value={draftAggregation} onChange={(event) => setDraftAggregation(event.target.value as StoredChartMarketScope["aggregationMode"])} className={INPUT_CLASS}>
                <option value="combined">Combined</option>
                <option value="separate_then_combined">Separate then combined</option>
                <option value="weighted">Weighted</option>
                <option value="minimum_presence">Minimum presence</option>
                <option value="editorial">Editorial</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Visibility</label>
              <select value={draftVisibility} onChange={(event) => setDraftVisibility(event.target.value as StoredChartMarketScope["visibility"])} className={INPUT_CLASS}>
                <option value="admin_only">Admin analytics only</option>
                <option value="public">Public scope</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className={LABEL_CLASS}>Description</label>
            <textarea value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} rows={2} className={`${INPUT_CLASS} resize-none`} placeholder="Describe what this scope is for and how it should be interpreted." />
          </div>
          <div className="mt-3">
            <label className={LABEL_CLASS}>Included countries *</label>
            <div className="flex flex-wrap gap-2">
              {getSortedCountryCodes().map((countryCode) => {
                const active = draftMarkets.includes(countryCode);
                return (
                  <button key={countryCode} type="button" onClick={() => toggleCountry(countryCode)} className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-all ${active ? "border-wk-brand bg-wk-brand text-wk-brand-on" : "border-wk-border bg-wk-surface text-wk-text-soft"}`}>
                    {getCountryNameForIso2(countryCode)} · {countryCode.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-wk-accent/30 bg-wk-accent-soft/30 p-4">
            <div className="mb-2 flex items-center gap-2 text-[12px] font-bold text-wk-text">
              <WkIcon name="MapPin" size={14} className="text-wk-accent" />
              Artist Origin Filter
            </div>
            <p className="mb-3 text-[11px] text-wk-text-soft">
              Restrict this chart to only include artists whose verified country of origin matches one of the selected countries. Artists without origin data are handled by the unknown-origin rule below.
            </p>
            <div className="mb-3">
              <label className={LABEL_CLASS}>Allowed artist origins</label>
              <div className="flex flex-wrap gap-2">
                {getSortedCountryCodes().map((countryCode) => {
                  const active = draftArtistOriginCountries.includes(countryCode);
                  return (
                    <button key={`origin-${countryCode}`} type="button" onClick={() => setDraftArtistOriginCountries((current) => current.includes(countryCode) ? current.filter((c) => c !== countryCode) : [...current, countryCode])} className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-all ${active ? "border-wk-accent bg-wk-accent text-wk-accent-on" : "border-wk-border bg-wk-surface text-wk-text-soft"}`}>
                      {getCountryNameForIso2(countryCode)} · {countryCode.toUpperCase()}
                    </button>
                  );
                })}
              </div>
              {draftArtistOriginCountries.length === 0 && (
                <p className="mt-1 text-[11px] text-wk-text-muted">Leave empty to allow artists from any country (no origin filter applied).</p>
              )}
            </div>
            <div>
              <label className={LABEL_CLASS}>When artist origin is unknown</label>
              <select value={draftArtistOriginUnknownMode} onChange={(event) => setDraftArtistOriginUnknownMode(event.target.value as "exclude" | "warn" | "include")} className={INPUT_CLASS}>
                <option value="exclude">Exclude — remove tracks by artists with unknown origin</option>
                <option value="warn">Warn — keep but flag for manual review</option>
                <option value="include">Include — let unknown-origin artists through</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={createScopeFromDraft} className="rounded-md bg-wk-brand px-4 py-2 text-[12px] font-bold text-wk-brand-on">Save scope for this ingest</button>
            <button type="button" onClick={() => { resetDraft(); setShowCreate(false); }} className="rounded-md border border-wk-border bg-wk-surface px-4 py-2 text-[12px] font-bold text-wk-text-soft">Cancel</button>
          </div>
        </div>
      )}

      {selectedScope && (
        <div className="rounded-xl border border-wk-border bg-wk-surface-raised p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h4 className="text-[13px] font-bold text-wk-text">{selectedScope.name}</h4>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${selectedScope.visibility === "public" ? "bg-wk-success-soft text-wk-success" : "bg-wk-warning-soft text-wk-warning"}`}>
              {selectedScope.visibility === "public" ? "Public scope" : "Admin analytics scope"}
            </span>
            <span className="rounded-full bg-wk-bg px-2 py-0.5 text-[10px] font-semibold text-wk-text-soft capitalize">
              {formatAggregation(selectedScope.aggregationMode)}
            </span>
          </div>
          <p className="mb-3 text-[12px] text-wk-text-soft">{selectedScope.description}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {selectedScope.includedMarkets.map((market) => (
              <div key={`${market.marketSlug}-${market.countryCode}`} className="flex items-center justify-between rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px]">
                <span className="font-semibold text-wk-text-soft">{market.marketSlug}</span>
                <span className="font-mono text-wk-brand">{market.countryCode}{market.weight ? ` · ${market.weight}x` : ""}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg bg-wk-bg p-3 text-[11px] text-wk-text-muted">
            <WkIcon name="Info" size={12} className="mr-1 inline text-wk-brand" />
            This scope is stored with the ingest run as a snapshot so future analytics can preserve exactly which countries and aggregation rules were used.
          </div>
          {(selectedScope.artistOriginCountries?.length ?? 0) > 0 && (
            <div className="mt-3 rounded-lg border border-wk-accent/30 bg-wk-accent-soft/20 p-3 text-[11px]">
              <div className="mb-1 flex items-center gap-1.5 font-bold text-wk-accent">
                <WkIcon name="MapPin" size={12} />
                Artist origin filtered to:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedScope.artistOriginCountries!.map((cc) => (
                  <span key={cc} className="rounded-full bg-wk-accent/15 px-2 py-0.5 text-[10px] font-semibold text-wk-accent">{getCountryNameForIso2(cc)} · {cc.toUpperCase()}</span>
                ))}
              </div>
              <div className="mt-1.5 text-wk-text-muted">
                Unknown origins: <span className="font-semibold">{selectedScope.artistOriginUnknownMode ?? "exclude"}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </WkSurface>
  );
}
