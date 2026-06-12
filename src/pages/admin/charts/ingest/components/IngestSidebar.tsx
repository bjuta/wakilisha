import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { ChartEligibilityProfile } from "@/services/chartsEligibility/eligibilityTypes";
import type { IngestRun, RecentIngestActivity, ResourceGuardStatus } from "@/services/chartsIngestion/ingestStudioTypes";
import type { StoredChartMarketScope } from "@/services/chartsMarkets/marketScopeStore";
import { AlertCircle, FolderPlus, GitPullRequest, XCircle } from "lucide-react";
import { ActivityItem } from "./ActivityItem";
import { NavButton } from "./NavButton";
import { PipelinePanel } from "./PipelinePanel";
import { ProviderHealthPanel } from "./ProviderHealthPanel";
import { ResourceGuardPanel } from "./ResourceGuardPanel";
import { RunCard } from "./RunCard";

const ADMIN_CHARTS_BASE = "/admin/charts";

type IngestSidebarProps = {
  activeRun?: IngestRun;
  dryRunResult: IngestRun | null;
  selectedMarketScope: StoredChartMarketScope | null;
  selectedEligibilityProfile: ChartEligibilityProfile | null;
  guardStatus: ResourceGuardStatus | null;
  runs: IngestRun[];
  activity: RecentIngestActivity[];
  cancelLoading: string | null;
  retryLoading: string | null;
  onNavigate: (path: string) => void;
  onCancelRun: (runId: string) => void;
  onRetryRun: (runId: string) => void;
};

export function IngestSidebar({
  activeRun,
  dryRunResult,
  selectedMarketScope,
  selectedEligibilityProfile,
  guardStatus,
  runs,
  activity,
  cancelLoading,
  retryLoading,
  onNavigate,
  onCancelRun,
  onRetryRun,
}: IngestSidebarProps) {
  const activeRuns = runs.filter((run) => run.status === "running" || run.status === "draft" || run.status === "dry_run_complete").slice(0, 4);

  return (
    <div className="space-y-5">
      <ProviderHealthPanel />
      {selectedMarketScope && (
        <SelectedSidebarCard
          title="Selected Market Scope"
          main={selectedMarketScope.name}
          sub={`${selectedMarketScope.includedMarkets.map((item) => item.countryCode).join(" + ")} · ${selectedMarketScope.aggregationMode.replace(/_/g, " ")}`}
        />
      )}
      {selectedEligibilityProfile && <SelectedSidebarCard title="Selected Rules" main={selectedEligibilityProfile.name} sub={selectedEligibilityProfile.description} />}
      {activeRun && !dryRunResult && (
        <WkSurface className="border-l-4 border-l-wk-brand p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-wk-text">Running Now</h2>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-wk-brand"><span className="inline-block h-2 w-2 animate-pulse rounded-full bg-wk-brand" />In progress</span>
          </div>
          <PipelinePanel run={activeRun} compact />
          <button onClick={() => onNavigate(`${ADMIN_CHARTS_BASE}/ingest-runs/${activeRun.id}`)} className="mt-3 w-full rounded-md bg-wk-brand-soft px-3 py-2 text-[12px] font-semibold text-wk-brand transition-colors hover:bg-wk-brand/20">Monitor Run →</button>
        </WkSurface>
      )}
      {(guardStatus || dryRunResult) && <ResourceGuardPanel guard={guardStatus} run={dryRunResult} />}
      <WkSurface className="p-4">
        <h2 className="mb-3 text-[14px] font-bold text-wk-text">Active Runs</h2>
        <div className="space-y-2">
          {activeRuns.map((run) => <RunCard key={run.id} run={run} onClick={() => onNavigate(`${ADMIN_CHARTS_BASE}/ingest-runs/${run.id}`)} onCancel={() => onCancelRun(run.id)} onRetry={() => onRetryRun(run.id)} cancelLoading={cancelLoading === run.id} retryLoading={retryLoading === run.id} />)}
          {activeRuns.length === 0 && <p className="text-[13px] text-wk-text-muted">No active runs</p>}
        </div>
      </WkSurface>
      <WkSurface className="p-4">
        <h2 className="mb-3 text-[14px] font-bold text-wk-text">Recent Activity</h2>
        <div className="space-y-3">
          {activity.slice(0, 6).map((item) => <ActivityItem key={item.id} activity={item} onClick={() => item.runId && onNavigate(`${ADMIN_CHARTS_BASE}/ingest-runs/${item.runId}`)} />)}
          {activity.length === 0 && <p className="text-[13px] text-wk-text-muted">No recent activity</p>}
        </div>
      </WkSurface>
      <WkSurface className="p-4">
        <h2 className="mb-3 text-[14px] font-bold text-wk-text">Operations</h2>
        <div className="space-y-1">
          <NavButton icon={GitPullRequest} label="Review Queue" path={`${ADMIN_CHARTS_BASE}/review-queue`} />
          <NavButton icon={XCircle} label="No-match Releases" path={`${ADMIN_CHARTS_BASE}/no-match`} />
          <NavButton icon={FolderPlus} label="Release Shells" path={`${ADMIN_CHARTS_BASE}/release-shells`} />
          <NavButton icon={AlertCircle} label="Canon Gaps" path={`${ADMIN_CHARTS_BASE}/canon-gaps`} />
        </div>
      </WkSurface>
    </div>
  );
}

function SelectedSidebarCard({ title, main, sub }: { title: string; main: string; sub: string }) {
  return (
    <WkSurface className="border-l-4 border-l-wk-brand p-4">
      <h2 className="mb-2 text-[14px] font-bold text-wk-text">{title}</h2>
      <p className="text-[12px] font-semibold text-wk-text-soft">{main}</p>
      <p className="mt-1 text-[11px] text-wk-text-muted">{sub}</p>
    </WkSurface>
  );
}
