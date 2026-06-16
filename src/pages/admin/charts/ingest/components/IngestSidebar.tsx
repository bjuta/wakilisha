import { useState, useRef, useEffect } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { ChartEligibilityProfile } from "@/services/chartsEligibility/eligibilityTypes";
import type { IngestRun, RecentIngestActivity, ResourceGuardStatus } from "@/services/chartsIngestion/ingestStudioTypes";
import type { StoredChartMarketScope } from "@/services/chartsMarkets/marketScopeStore";
import { AlertCircle, FolderPlus, GitPullRequest, Wrench, XCircle } from "lucide-react";
import { fixChartArtistSlugs } from "@/services/chartsIngestion/client";
import type { FixArtistSlugsResult } from "@/services/chartsIngestion/client";
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

  // ── Fix Artist Slugs state ──
  const [fixSlugsOpen, setFixSlugsOpen] = useState(false);
  const [fixSlugsLoading, setFixSlugsLoading] = useState(false);
  const [fixSlugsResult, setFixSlugsResult] = useState<FixArtistSlugsResult | null>(null);
  const [fixSlugsError, setFixSlugsError] = useState<string | null>(null);
  const fixSlugsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (fixSlugsRef.current && !fixSlugsRef.current.contains(e.target as Node) && fixSlugsOpen) {
        setFixSlugsOpen(false);
      }
    }
    if (fixSlugsOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [fixSlugsOpen]);

  async function handleFixArtistSlugs() {
    setFixSlugsLoading(true);
    setFixSlugsError(null);
    setFixSlugsResult(null);
    try {
      const result = await fixChartArtistSlugs({ dryRun: true });
      setFixSlugsResult(result);
    } catch (err) {
      setFixSlugsError(err instanceof Error ? err.message : "Fix artist slugs failed");
    } finally {
      setFixSlugsLoading(false);
    }
  }

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
          <button
            onClick={() => { setFixSlugsOpen(true); setFixSlugsResult(null); setFixSlugsError(null); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-wk-text-soft transition-colors hover:bg-wk-bg-subtle whitespace-nowrap cursor-pointer"
          >
            <Wrench size={14} />
            Fix Artist Slugs
          </button>
        </div>

        {/* Fix Artist Slugs result */}
        {fixSlugsResult && (
          <div className="mt-3 rounded-lg border border-wk-success/20 bg-wk-success-soft p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[12px] font-bold text-wk-success">
                {fixSlugsResult.dry_run ? "Dry Run Preview" : "Fix Complete"}
              </span>
              <span className="text-[11px] text-wk-text-muted">
                {fixSlugsResult.to_fix ?? fixSlugsResult.fixed ?? 0} to fix · {fixSlugsResult.skipped} skipped
              </span>
            </div>
            {fixSlugsResult.fix_preview && fixSlugsResult.fix_preview.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {fixSlugsResult.fix_preview.slice(0, 6).map((item) => (
                  <div key={item.id} className="rounded bg-wk-surface-raised border border-wk-border px-2 py-1.5 text-[11px]">
                    <span className="font-semibold text-wk-text">{item.track_title}</span>
                    <span className="text-wk-text-muted"> by </span>
                    <span className="text-wk-text-soft">{item.artist_name}</span>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <code className="text-[10px] bg-wk-danger-soft text-wk-danger px-1 rounded">{item.current_slug.slice(0, 30)}</code>
                      <span className="text-[10px] text-wk-text-faint">→</span>
                      <code className="text-[10px] bg-wk-success-soft text-wk-success px-1 rounded">{item.correct_slug}</code>
                      <span className="text-[10px] text-wk-text-faint ml-auto">{item.method}</span>
                    </div>
                  </div>
                ))}
                {fixSlugsResult.fix_preview.length > 6 && (
                  <p className="text-[11px] text-wk-text-muted text-center">
                    +{fixSlugsResult.fix_preview.length - 6} more
                  </p>
                )}
              </div>
            )}
            <button
              onClick={() => setFixSlugsResult(null)}
              className="mt-2 text-[11px] font-semibold text-wk-text-muted hover:text-wk-text transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {fixSlugsError && (
          <div className="mt-3 rounded-lg border border-wk-danger/20 bg-wk-danger-soft p-3">
            <p className="text-[12px] font-semibold text-wk-danger">{fixSlugsError}</p>
            <button
              onClick={() => setFixSlugsError(null)}
              className="mt-1 text-[11px] font-semibold text-wk-text-muted hover:text-wk-text transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}
      </WkSurface>

      {/* Fix Artist Slugs confirm dialog */}
      {fixSlugsOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50">
          <div ref={fixSlugsRef} className="w-full max-w-sm rounded-xl border border-wk-border bg-wk-surface p-6 shadow-lg">
            <div className="flex items-center gap-2">
              <Wrench size={18} className="text-wk-brand" />
              <h3 className="text-[15px] font-bold text-wk-text">Fix Artist Slugs</h3>
            </div>
            <p className="mt-2 text-[13px] text-wk-text-muted">
              This will scan all chart entries for corrupt artist slugs (track slugs mistakenly stored in the artist_slug column) and resolve them through the registry. Running as a dry run first to preview changes.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setFixSlugsOpen(false)}
                disabled={fixSlugsLoading}
                className="inline-flex items-center gap-1.5 rounded-md border border-wk-border-2 bg-wk-surface px-4 py-2 text-[13px] font-semibold text-wk-text transition-colors hover:bg-wk-surface-raised disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleFixArtistSlugs}
                disabled={fixSlugsLoading}
                className="inline-flex items-center gap-1.5 rounded-md bg-wk-brand px-4 py-2 text-[13px] font-semibold text-wk-brand-on transition-colors hover:opacity-90 disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                {fixSlugsLoading && <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                {fixSlugsLoading ? "Scanning…" : "Run Dry Run"}
              </button>
            </div>
          </div>
        </div>
      )}
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
