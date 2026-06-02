import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { StoredChartMarketScope } from "@/services/chartsMarkets/marketScopeStore";

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

export function MarketScopeStep({ scopes, selectedMarketScopeId, onSelectMarketScope }: MarketScopeStepProps) {
  const selectedScope = scopes.find((scope) => scope.id === selectedMarketScopeId || scope.slug === selectedMarketScopeId) ?? scopes[0];

  return (
    <WkSurface className="p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-bold text-wk-text">Market Scope</h3>
          <p className="mt-1 text-[12px] text-wk-text-soft">
            Choose how the chart represents markets. Multi-country scopes preserve each country separately for analytics instead of flattening them into one vague region.
          </p>
        </div>
        <span className="rounded-full bg-wk-brand-soft px-2.5 py-1 text-[11px] font-bold text-wk-brand">Market logic</span>
      </div>

      <div className="mb-4">
        <label className={LABEL_CLASS}>Scope</label>
        <select value={selectedMarketScopeId} onChange={(event) => onSelectMarketScope(event.target.value)} className={INPUT_CLASS}>
          {scopes.map((scope) => (
            <option key={scope.id} value={scope.id}>{scope.name} ({scope.slug})</option>
          ))}
        </select>
      </div>

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
            Stored market scopes will later power source weighting, country-level coverage diagnostics, and public/private market breakdown controls.
          </div>
        </div>
      )}
    </WkSurface>
  );
}
