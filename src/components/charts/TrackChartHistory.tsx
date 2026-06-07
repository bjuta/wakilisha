import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getTrackChartHistory } from "@/services/chartsPublic/client";
import { toChartTrackHistoryViewModel } from "@/services/chartsPublic/viewModels";
import { ChartTrajectory, type ChartTrajectoryPoint } from "./ChartTrajectory";
import { WkIcon } from "@/components/design-system/Icon";

interface TrackChartAppearance {
  editionSlug: string;
  editionLabel: string;
  date: string;
  rank: number;
  previousRank?: number | null;
  movement?: string;
  weeksOnChart?: number;
}

type ChartSeriesMeta = {
  slug: string;
  label: string;
  colorVar: string;
};

const SERIES_META: Record<string, ChartSeriesMeta> = {
  rnb: { slug: "rnb", label: "R&B", colorVar: "var(--wk-brand)" },
  kenya: { slug: "kenya", label: "Top 100", colorVar: "var(--wk-info)" },
  "2026": { slug: "2026", label: "2026 Releases", colorVar: "var(--wk-success)" },
  gengetone: { slug: "gengetone", label: "Gengetone", colorVar: "var(--wk-warning)" },
};

function seriesFromAppearance(appearance: { editionSlug?: string; editionLabel?: string }): ChartSeriesMeta {
  const editionSlug = String(appearance.editionSlug || "");
  const editionLabel = String(appearance.editionLabel || "");

  const prefix = editionSlug.split("-2026-")[0] || editionSlug.split("-")[0];

  if (SERIES_META[prefix]) return SERIES_META[prefix];

  if (/r&b|rnb/i.test(editionLabel)) return SERIES_META.rnb;
  if (/top 100|kenya/i.test(editionLabel)) return SERIES_META.kenya;
  if (/2026/i.test(editionLabel)) return SERIES_META["2026"];
  if (/gengetone/i.test(editionLabel)) return SERIES_META.gengetone;

  return { slug: prefix || "other", label: prefix || "Other", colorVar: "var(--wk-text-muted)" };
}

interface TrackChartHistoryProps {
  trackSlug: string;
  trackRank: number;
  trackPeak: number;
  trackWeeks: number;
  trackHistory?: number[];
  chartAppearances?: TrackChartAppearance[];
  chartAppearanceCount?: number;
  compact?: boolean;
}


function chartProgramSlugFromEditionSlug(editionSlug: string): string {
  const seriesSlug = String(editionSlug || "").replace(/-[0-9]{4}-[0-9]{2}-[0-9]{2}(-[0-9]+)?$/, "");
  return `top-songs/kenya/${seriesSlug || "kenya"}`;
}

export function TrackChartHistorySection({
  trackSlug,
  trackRank,
  trackPeak,
  trackWeeks,
  trackHistory,
  chartAppearances,
  chartAppearanceCount,
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

    if (chartAppearances && chartAppearances.length > 0) {
      const appearances = chartAppearances.map((appearance, idx) => ({
        editionSlug: appearance.editionSlug,
        editionLabel: appearance.editionLabel || appearance.editionSlug,
        date: appearance.date,
        rank: Number(appearance.rank || 0),
        previousRank: appearance.previousRank ?? null,
        movement: appearance.movement || "same",
        weeksOnChart: appearance.weeksOnChart ?? idx + 1,
      }));

      setState({
        status: "loaded",
        data: {
          appearances,
          peakPosition: trackPeak,
          totalWeeksOnChart: trackWeeks,
        } as ReturnType<typeof toChartTrackHistoryViewModel>,
        meta: {
          source: "wordpress",
          fetchedAt: new Date().toISOString(),
        },
      });
      return;
    }

    try {
      const result = await getTrackChartHistory(trackSlug);
      if (!result.data || !Array.isArray(result.data.appearances) || result.data.appearances.length === 0) {
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
  }, [trackSlug, chartAppearances, trackPeak, trackWeeks]);

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
  const appearances = Array.isArray(data.appearances) ? data.appearances : [];

  // API appearances are latest-first for the table.
  // Trajectory charts need oldest-to-current so "current" is the right edge.
  const chronologicalAppearances = [...appearances].reverse();
  const trajectoryPoints: ChartTrajectoryPoint[] = chronologicalAppearances
    .map((appearance, index) => {
      const series = seriesFromAppearance(appearance);
      const rank = Number(appearance.rank || 0);

      return {
        rank,
        weekLabel: `W${index + 1}`,
        editionSlug: appearance.editionSlug,
        editionLabel: appearance.editionLabel,
        date: appearance.date,
        seriesSlug: series.slug,
        seriesLabel: series.label,
        colorVar: series.colorVar,
      };
    })
    .filter((point) => point.rank > 0);

  const historyRanks = trajectoryPoints.map((point) => point.rank);

  const combinedHistory = historyRanks.length > 0
    ? historyRanks
    : trackHistory && trackHistory.length > 0
    ? trackHistory
    : [];

  const latestAppearance = appearances[0] ?? null;
  const displayedCurrentRank = Number(trackRank || latestAppearance?.rank || 0);
  const currentRank = displayedCurrentRank;
  const peakRank = trackPeak || data.peakPosition || (combinedHistory.length ? Math.min(...combinedHistory) : 0);

  return (
    <div className={compact ? "px-5 py-4" : "px-4 py-6 lg:px-6 lg:py-8"}>
      <div className="mb-3 flex items-center gap-2 text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">
        <WkIcon name="BarChart3" size={14} className="text-[var(--wk-brand)]" />
        Chart history
        {(chartAppearanceCount || appearances.length) > 0 && (
          <span className="text-[10px] font-bold text-[var(--wk-text-faint)]">· {chartAppearanceCount || appearances.length} appearances</span>
        )}
      </div>

      {/* Trajectory visualization */}
      {combinedHistory.length >= 2 && (
        <div className="mb-6 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
          <ChartTrajectory
            history={combinedHistory}
            points={trajectoryPoints}
            peakPosition={peakRank}
            currentRank={displayedCurrentRank}
            weeksOnChart={trackWeeks || data.totalWeeksOnChart || combinedHistory.length}
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
          {appearances.map((appearance, idx) => {
            const prev = idx > 0 ? data.appearances[idx - 1] : null;
            const move = prev ? prev.rank - appearance.rank : 0;
            return (
              <Link
                key={appearance.editionSlug}
                to={`/charts/${chartProgramSlugFromEditionSlug(appearance.editionSlug)}/${appearance.editionSlug}`}
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
          : "From WAKILISHA API"}
        {" · "}
        {new Date(state.meta.fetchedAt).toLocaleTimeString()}
      </div>
    </div>
  );
}