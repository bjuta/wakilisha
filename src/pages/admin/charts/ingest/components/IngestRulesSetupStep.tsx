import type { ChartEligibilityProfile } from "@/services/chartsEligibility/eligibilityTypes";
import type { StoredChartMarketScope } from "@/services/chartsMarkets/marketScopeStore";
import { MarketScopeStep } from "./MarketScopeStep";
import { RulesStep } from "./RulesStep";
import { StatusBanner } from "./StatusBanner";

type IngestRulesSetupStepProps = {
  marketScopes: StoredChartMarketScope[];
  selectedMarketScopeId: string;
  onSelectMarketScope: (scopeId: string) => void;
  eligibilityProfiles: ChartEligibilityProfile[];
  selectedEligibilityProfileId: string;
  onSelectEligibilityProfile: (profileId: string) => void;
  onBack: () => void;
  onContinue: () => void;
  dryRunLoading: boolean;
};

export function IngestRulesSetupStep({
  marketScopes,
  selectedMarketScopeId,
  onSelectMarketScope,
  eligibilityProfiles,
  selectedEligibilityProfileId,
  onSelectEligibilityProfile,
  onBack,
  onContinue,
  dryRunLoading,
}: IngestRulesSetupStepProps) {
  return (
    <div className="space-y-5">
      <MarketScopeStep scopes={marketScopes} selectedMarketScopeId={selectedMarketScopeId} onSelectMarketScope={onSelectMarketScope} />
      <RulesStep
        profiles={eligibilityProfiles}
        selectedEligibilityProfileId={selectedEligibilityProfileId}
        onSelectEligibilityProfile={onSelectEligibilityProfile}
        onBack={onBack}
        onContinue={onContinue}
      />
      {dryRunLoading && <StatusBanner tone="info" icon="RefreshCcw" message="Running dry run…" />}
    </div>
  );
}
