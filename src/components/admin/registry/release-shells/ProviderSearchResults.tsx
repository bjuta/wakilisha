import type { ProviderSearchResponse, ProviderSearchResult } from "@/services/registry/provider-intake/types";
import { ProviderResultCard } from "./ProviderResultCard";
import { WkIcon } from "@/components/design-system/Icon";

interface ProviderSearchResultsProps {
  response: ProviderSearchResponse;
  onInspect: (result: ProviderSearchResult) => void;
  onCreateShell: (result: ProviderSearchResult) => void;
  onAttachToShell: (result: ProviderSearchResult) => void;
  isLoading?: boolean;
}

function ResultGroup({
  label,
  results,
  onInspect,
  onCreateShell,
  onAttachToShell,
  isLoading,
}: {
  label: string;
  results: ProviderSearchResult[];
  onInspect: (result: ProviderSearchResult) => void;
  onCreateShell: (result: ProviderSearchResult) => void;
  onAttachToShell: (result: ProviderSearchResult) => void;
  isLoading?: boolean;
}) {
  if (results.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#71796b]">
        {label} · {results.length}
      </p>
      <div className="space-y-3">
        {results.map((result) => (
          <ProviderResultCard
            key={`${result.providerEntityType}-${result.providerEntityId}`}
            result={result}
            onInspect={onInspect}
            onCreateShell={onCreateShell}
            onAttachToShell={onAttachToShell}
            isLoading={isLoading}
          />
        ))}
      </div>
    </div>
  );
}

export function ProviderSearchResults({
  response,
  onInspect,
  onCreateShell,
  onAttachToShell,
  isLoading = false,
}: ProviderSearchResultsProps) {
  const { groups } = response;
  const totalResults = groups.releases.length + groups.tracks.length + groups.artists.length;

  if (totalResults === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#dfe4d8] px-6 py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0f3ec]">
          <WkIcon name="SearchX" size={24} className="text-[#97a290]" />
        </div>
        <p className="text-[14px] font-black text-[#171712]">No results found</p>
        <p className="max-w-sm text-[12px] text-[#697062]">
          No Apple Music results found for &ldquo;{response.query}&rdquo;.
          {response.storefrontOrMarket && ` Try a different spelling or switch from storefront ${response.storefrontOrMarket.toUpperCase()}.`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-bold text-[#697062]">
          {totalResults} result{totalResults !== 1 ? "s" : ""} from {response.provider.replace("_", " ")} ·{" "}
          {response.storefrontOrMarket?.toUpperCase()}
        </p>
      </div>

      <ResultGroup
        label="Releases"
        results={groups.releases}
        onInspect={onInspect}
        onCreateShell={onCreateShell}
        onAttachToShell={onAttachToShell}
        isLoading={isLoading}
      />
      <ResultGroup
        label="Tracks"
        results={groups.tracks}
        onInspect={onInspect}
        onCreateShell={onCreateShell}
        onAttachToShell={onAttachToShell}
        isLoading={isLoading}
      />
      <ResultGroup
        label="Artists"
        results={groups.artists}
        onInspect={onInspect}
        onCreateShell={onCreateShell}
        onAttachToShell={onAttachToShell}
        isLoading={isLoading}
      />
    </div>
  );
}