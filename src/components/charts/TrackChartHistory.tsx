import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getTrackChartHistory } from "@/services/chartsPublic/client";
import { toChartTrackHistoryViewModel } from "@/services/chartsPublic/viewModels";
import { ChartTrajectory } from "./ChartTrajectory";
import { WkIcon } from "@/components/design-system/Icon";

interface TrackChartHistoryProps {
  trackSlug: string;
  trackRank: number;
  trackPeak: number;
  trackWeeks: number;
  trackHistory?: number[];
  compact?: boolean;
}

export function TrackChartHistorySection({
  trackSlug,
  trackRank,
  trackPeak,
  trackWeeks,
  trackHistory,
  compact = false,
}: TrackChartHistoryProps) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "empty" }
    | { status: "error"; error: string }
    | {
        status: "loaded";
        data: ReturnType<typeof toChartTrackHistoryViewModel>;
        meta: { source: "mock" | "wordpress" | "cache"; fetchedAt: string };
      }
  >({ status: "loading" });

  const load = async () => {
    setState({ status: "loading" });
    try {
      const result = await getTrackChartHistory(trackSlug);
      if (!result.data || result.data.appearances.length === 0) {
        setState({ status: "empty" });
        return;
      }
      const vm = toChartTrackHistoryViewModel(result.data);
      setState({
        status: "loaded",
        data: vm,
        meta: {
          source: result.meta.source,
          fetchedAt: result.meta.fetchedAt,
        },
      });
    } catch (err) {
      setState({
        status: "error",
        error: err instanceof Error ? err.message : "Failed to load chart history",
      });
    }
  };

  useEffect(() => {
    load();
  }, [trackSlug]);

  if (state.status === "loading") {
    return (
      <div className={compact ? "px-5 py-4" : "px-4 py-6 lg:px-6 lg:py-8"}>
        <div className="mb-3 h-4 w-40 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
        <div className="mb-4 flex gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 w-6 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 w-full rounded bg-[var(--wk-surface-raised)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={compact ? "px-5 py-4" : "px-4 py-6 lg:px-6 lg:py-8"}>
        <div className="mb-3 flex items-center gap-2 text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">
          <WkIcon name="BarChart3" size={14} className="text-[var(--wk-brand)]" />
          Chart history
        </div>
        <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
          <div className="flex items-center gap-2 text-[13px] text-[var(--wk-danger)] mb-2">
            <WkIcon name="AlertTriangle" size={16} />
            Could not load chart history
          </div>
          <p className="text-[12px] text-[var(--wk-text-muted)] mb-3">{state.error}</p>
          <button onClick={load} className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--wk-brand)]">
            <WkIcon name="RefreshCw" size={12} /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className={compact ? "px-5 py-4" : "px-4 py-6 lg:px-6 lg:py-8"}>
        <div className="mb-3 flex items-center gap-2 text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">
          <WkIcon name="BarChart3" size={14} className="text-[var(--wk-brand)]" />
          Chart history
        </div>
        <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 text-center">
          <WkIcon name="BarChart3" size={28} className="mx-auto mb-2 text-[var(--wk-text-faint)]" />
          <p className="text-[13px] font-bold text-[var(--wk-text)]">No chart history yet</p>
          <p className="text-[12px] text-[var(--wk-text-muted)] mt-1">
            This track has not appeared on any chart edition.
          </p>
        </div>
      </div>
    );
  }

  const { data } = state;
  const historyRanks = data.appearances.map((a) => a.rank);
  // Merge with local trackHistory if available and longer
  const combinedHistory = trackHistory && trackHistory.length > historyRanks.length
    ? trackHistory
    : historyRanks.length > 0
    ? historyRanks
    : trackHistory ?? [];

  return (
    <div className={compact ? "px-5 py-4" : "px-4 py-6 lg:px-6 lg:py-8"}>
      <div className="mb-3 flex items-center gap-2 text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">
        <WkIcon name="BarChart3" size={14} className="text-[var(--wk-brand)]" />
        Chart history
        {data.appearances.length > 0 && (
          <span className="text-[10px] font-bold text-[var(--wk-text-faint)]">· {data.appearances.length} appearances</span>
        )}
      </div>

      {/* Trajectory visualization */}
      {combinedHistory.length >= 2 && (
        <div className="mb-6 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
          <ChartTrajectory
            history={combinedHistory}
            peakPosition={data.peakPosition || trackPeak}
            currentRank={data.appearances[data.appearances.length - 1]?.rank || trackRank}
            weeksOnChart={data.totalWeeksOnChart || trackWeeks}
            compact={compact}
          />
        </div>
      )}

      {/* Appearance list */}
      <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
        <div className="grid grid-cols-[60px_1fr_80px_60px] gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] border-b border-[var(--wk-divider)]">
          <div>Rank</div>
          <div>Edition</div>
          <div className="text-right">Move</div>
          <div className="text-right">Weeks</div>
        </div>
        <div className="divide-y divide-[var(--wk-divider)]">
          {data.appearances.map((appearance, idx) => {
            const prev = idx > 0 ? data.appearances[idx - 1] : null;
            const move = prev ? prev.rank - appearance.rank : 0;
            return (
              <Link
                key={appearance.editionSlug}
                to={`/charts/weekly-top-40/${appearance.editionSlug}`}
                className="grid grid-cols-[60px_1fr_80px_60px] gap-2 items-center px-4 py-3 transition-colors hover:bg-[var(--wk-bg)]"
              >
                <div className="text-[16px] font-black text-[var(--wk-brand)]">#{appearance.rank}</div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-bold text-[var(--wk-text)]">{appearance.editionLabel}</div>
                  <div className="text-[10px] text-[var(--wk-text-muted)]">{appearance.date}</div>
                </div>
                <div className="text-right text-[12px] font-bold">
                  {appearance.movement === "new" && <span className="text-[var(--wk-brand)]">NEW</span>}
                  {appearance.movement === "up" && <span className="text-[var(--wk-success)]">+{move}</span>}
                  {appearance.movement === "down" && <span className="text-[var(--wk-danger)]">{move}</span>}
                  {appearance.movement === "same" && <span className="text-[var(--wk-text-faint)]">—</span>}
                  {appearance.movement === "re_entry" && <span className="text-[var(--wk-info)]">RE</span>}
                </div>
                <div className="text-right text-[12px] font-bold text-[var(--wk-text)]">{appearance.weeksOnChart}</div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Meta footer */}
      <div className="mt-2 text-[10px] text-[var(--wk-text-faint)]">
        {state.meta.source === "mock"
          ? "From mock data"
          : state.meta.source === "cache"
          ? "From cache"
          : "From WordPress API"}
        {" · "}
        {new Date(state.meta.fetchedAt).toLocaleTimeString()}
      </div>
    </div>
  );
}