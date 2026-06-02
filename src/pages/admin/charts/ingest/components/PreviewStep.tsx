import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { ChartEligibilityProfile } from "@/services/chartsEligibility/eligibilityTypes";
import type { IngestRun } from "@/services/chartsIngestion/ingestStudioTypes";
import type { StoredChartMarketScope } from "@/services/chartsMarkets/marketScopeStore";
import { MatchSummary } from "./MatchSummary";
import { PipelinePanel } from "./PipelinePanel";
import { PublishChecklist } from "./PublishChecklist";
import { MiniChartRow, RowTableRow } from "./RowComponents";
import { RunMetadataPanel } from "./RunMetadataPanel";

const BTN_GHOST = "inline-flex items-center gap-1.5 rounded-md border border-wk-border bg-wk-surface px-4 py-2.5 text-[13px] font-semibold text-wk-text-soft transition-colors hover:bg-wk-surface-raised whitespace-nowrap";

type PreviewStepProps = {
  run: IngestRun;
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
  onBackToRules: () => void;
  onOpenRun: () => void;
};

export function PreviewStep({
  run,
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
  onBackToRules,
  onOpenRun,
}: PreviewStepProps) {
  return (
    <div className="space-y-5">
      <RunMetadataPanel run={run} />
      {selectedMarketScope && <MarketScopeSummary scope={selectedMarketScope} />}
      {selectedEligibilityProfile && <EligibilitySummary profile={selectedEligibilityProfile} />}
      <PipelinePanel run={run} />
      <MatchSummary summary={run.summary} runId={run.id} />
      <PublishChecklist run={run} onCommit={onCommit} commitLoading={commitLoading} commitError={commitError} />
      <ChartPreview run={run} />
      <ResolvedRowsTable
        rows={filteredRows}
        totalRows={run.rows.length}
        rowFilter={rowFilter}
        setRowFilter={setRowFilter}
        expandedRowId={expandedRowId}
        setExpandedRowId={setExpandedRowId}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBackToRules} className={BTN_GHOST}><WkIcon name="ArrowLeft" size={14} />Back to Rules</button>
        <button onClick={onOpenRun} className={BTN_GHOST}><WkIcon name="ExternalLink" size={14} />Open Run Detail</button>
      </div>
    </div>
  );
}

function MarketScopeSummary({ scope }: { scope: StoredChartMarketScope }) {
  return (
    <WkSurface className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-bold text-wk-text">Market Scope</h2>
          <p className="mt-1 text-[12px] text-wk-text-soft">{scope.name} · {scope.aggregationMode.replace(/_/g, " ")}</p>
          <p className="mt-1 text-[11px] text-wk-text-muted">{scope.includedMarkets.map((item) => `${item.marketSlug} (${item.countryCode})`).join(" · ")}</p>
        </div>
        <span className="rounded-full bg-wk-brand-soft px-2.5 py-1 text-[11px] font-bold text-wk-brand">{scope.primaryMarketSlug}</span>
      </div>
    </WkSurface>
  );
}

function EligibilitySummary({ profile }: { profile: ChartEligibilityProfile }) {
  return (
    <WkSurface className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-bold text-wk-text">Eligibility Profile</h2>
          <p className="mt-1 text-[12px] text-wk-text-soft">{profile.name} · {profile.slug}</p>
          <p className="mt-1 text-[11px] text-wk-text-muted">{profile.description}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${profile.visibility === "public" ? "bg-wk-success-soft text-wk-success" : "bg-wk-warning-soft text-wk-warning"}`}>{profile.visibility === "public" ? "Public label allowed" : "Admin-only rules"}</span>
      </div>
    </WkSurface>
  );
}

function ChartPreview({ run }: { run: IngestRun }) {
  return (
    <WkSurface className="overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-wk-text">Chart Preview</h2>
        <span className="text-[12px] text-wk-text-muted">Top {Math.min(10, run.rows.length)} of {run.rows.length}</span>
      </div>
      <div className="space-y-1">{run.rows.slice(0, 10).map((row, index) => <MiniChartRow key={row.id} row={row} index={index} />)}</div>
    </WkSurface>
  );
}

function ResolvedRowsTable({ rows, totalRows, rowFilter, setRowFilter, expandedRowId, setExpandedRowId }: {
  rows: IngestRun["rows"];
  totalRows: number;
  rowFilter: string;
  setRowFilter: (value: string) => void;
  expandedRowId: string | null;
  setExpandedRowId: (value: string | null) => void;
}) {
  const filters = ["all", "canonical", "shell", "no_match", "needs_review", "duplicate_candidate"];
  return (
    <WkSurface className="overflow-hidden">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[14px] font-bold text-wk-text">Resolved Rows</h2>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-wk-text-muted">{totalRows} rows</span>
          <div className="flex flex-wrap gap-1">
            {filters.map((filter) => (
              <button key={filter} onClick={() => setRowFilter(filter)} className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all ${rowFilter === filter ? "bg-wk-brand text-wk-brand-on" : "bg-wk-surface-raised text-wk-text-soft hover:bg-wk-border"}`}>
                {filter === "all" ? "All" : filter.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-wk-border">
              {["#", "Title & Artist", "Match", "Confidence", "Warnings", "Decision", ""].map((heading) => <th key={heading} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">{heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => <RowTableRow key={row.id} row={row} expanded={expandedRowId === row.id} onToggle={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)} onDecisionApplied={() => {}} />)}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-wk-text-muted">No rows match the selected filter.</div>}
    </WkSurface>
  );
}
