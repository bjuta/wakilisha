import type { ChartEligibilityProfile } from "@/services/chartsEligibility/eligibilityTypes";
import type { IngestRun, ProviderName } from "@/services/chartsIngestion/ingestStudioTypes";
import type { ChartFamily } from "@/services/chartsIngestion/types";
import type { BackendCommitResponse } from "@/services/backendContract/backendTypes";
import type { StoredChartMarketScope } from "@/services/chartsMarkets/marketScopeStore";
import { CommitResultPanel } from "./CommitResultPanel";
import { IngestRulesSetupStep } from "./IngestRulesSetupStep";
import { PreviewStep } from "./PreviewStep";
import { ProgramSetupStep } from "./ProgramSetupStep";
import type { IngestStudioStep } from "./Stepper";

export type QuickTemplateKey = "top40" | "kenyan" | "groups" | "eastAfrica";

type IngestMainPanelProps = {
  step: IngestStudioStep;
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
  marketScopes: StoredChartMarketScope[];
  selectedMarketScopeId: string;
  onSelectMarketScope: (scopeId: string) => void;
  eligibilityProfiles: ChartEligibilityProfile[];
  selectedEligibilityProfileId: string;
  onSelectEligibilityProfile: (profileId: string) => void;
  onBackToProgram: () => void;
  onDryRun: () => void;
  dryRunLoading: boolean;
  dryRunResult: IngestRun | null;
  selectedMarketScope: StoredChartMarketScope | null;
  selectedEligibilityProfile: ChartEligibilityProfile | null;
  filteredRows: IngestRun["rows"];
  rowFilter: string;
  setRowFilter: (value: string) => void;
  expandedRowId: string | null;
  setExpandedRowId: (value: string | null) => void;
  onCommit: () => void;
  commitLoading: boolean;
  commitError: string | null;
  onOpenRun: () => void;
  commitResult: BackendCommitResponse | null;
};

export function IngestMainPanel(props: IngestMainPanelProps) {
  const {
    step,
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
    marketScopes,
    selectedMarketScopeId,
    onSelectMarketScope,
    eligibilityProfiles,
    selectedEligibilityProfileId,
    onSelectEligibilityProfile,
    onBackToProgram,
    onDryRun,
    dryRunLoading,
    dryRunResult,
    selectedMarketScope,
    selectedEligibilityProfile,
    filteredRows,
    rowFilter,
    setRowFilter,
    expandedRowId,
    setExpandedRowId,
    onCommit,
    commitLoading,
    commitError,
    onOpenRun,
    commitResult,
  } = props;

  return (
    <div className="space-y-6 lg:col-span-2">
      {step === "configure" && (
        <ProgramSetupStep
          families={families}
          selectedFamily={selectedFamily}
          existingSeriesId={existingSeriesId}
          setExistingSeriesId={setExistingSeriesId}
          newSeriesLabel={newSeriesLabel}
          setNewSeriesLabel={setNewSeriesLabel}
          newSeriesKey={newSeriesKey}
          setNewSeriesKey={setNewSeriesKey}
          onCreateSeries={onCreateSeries}
          chartTitle={chartTitle}
          setChartTitle={setChartTitle}
          chartSlug={chartSlug}
          setChartSlug={setChartSlug}
          publicUrlPreview={publicUrlPreview}
          editionDate={editionDate}
          setEditionDate={setEditionDate}
          chartSize={chartSize}
          setChartSize={setChartSize}
          market={market}
          setMarket={setMarket}
          sourceUrls={sourceUrls}
          setSourceUrls={setSourceUrls}
          detectedProviders={detectedProviders}
          chartKind={chartKind}
          setChartKind={setChartKind}
          coverStyle={coverStyle}
          setCoverStyle={setCoverStyle}
          saveAsRecurring={saveAsRecurring}
          setSaveAsRecurring={setSaveAsRecurring}
          onQuickTemplate={onQuickTemplate}
          onContinueToRules={onContinueToRules}
          onReset={onReset}
        />
      )}

      {step === "rules" && (
        <IngestRulesSetupStep
          marketScopes={marketScopes}
          selectedMarketScopeId={selectedMarketScopeId}
          onSelectMarketScope={onSelectMarketScope}
          eligibilityProfiles={eligibilityProfiles}
          selectedEligibilityProfileId={selectedEligibilityProfileId}
          onSelectEligibilityProfile={onSelectEligibilityProfile}
          onBack={onBackToProgram}
          onContinue={onDryRun}
          dryRunLoading={dryRunLoading}
        />
      )}

      {step === "preview" && dryRunResult && (
        <PreviewStep
          run={dryRunResult}
          selectedMarketScope={selectedMarketScope}
          selectedEligibilityProfile={selectedEligibilityProfile}
          filteredRows={filteredRows}
          rowFilter={rowFilter}
          setRowFilter={setRowFilter}
          expandedRowId={expandedRowId}
          setExpandedRowId={setExpandedRowId}
          onCommit={onCommit}
          commitLoading={commitLoading}
          commitError={commitError}
          onBackToRules={onBackToProgram}
          onOpenRun={onOpenRun}
        />
      )}

      {step === "commit" && commitResult && <CommitResultPanel result={commitResult} onNewIngest={onReset} />}
    </div>
  );
}
