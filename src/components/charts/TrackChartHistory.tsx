import { useState, useEffect, useCallback } from "react";
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

const INITIAL_SHOW = 8;

function chartProgramSlugFromEditionSlug(editionSlug: string): string {
  const seriesSlug = String(editionSlug || "").replace(/-[0-9]{4}-[0-9]{2}-[0-9]{2}(-[0-9]+)?$/, "");
  return `top-songs/kenya/${seriesSlug || "kenya"}`;
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return dateStr; }
}

/**
 * Calculate movement between two appearances.
 * Returns { delta, direction } — delta is absolute rank change, direction is "up"/"down"/"new"/"same".
 */
function calcMovement(current: number, previous: number | null | undefined): { delta: number; direction: "up" | "down" | "new" | "same" } {
  if (previous == null || previous <= 0) return { delta: 0, direction: "new" };
  const d = previous - current;
  if (d > 0) return { delta: d, direction: "up" };
  if (d < 0) return { delta: Math.abs(d), direction: "down" };
  return { delta: 0, direction: "same" };
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

  const [visibleCount, setVisibleCount] = useState(INITIAL_SHOW);

  const load = useCallback(async () => {
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
  }, [trackSlug, chartAppearances, trackPeak, trackWeeks]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset visible count when data changes
  useEffect(() => {
    setVisibleCount(INITIAL_SHOW);
  }, [trackSlug]);

  if (state.status === "loading") {
    return (
      <div className={compact ? "px-5 py-4" : "px-4 py-6 lg:px-6 lg:py-8"}>
        <div className="mb-3 h-4 w-40 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 w-full rounded bg-[var(--wk-surface-raised)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={compact ? "px-5 py-4" : "px-4 py-6 lg:px-6 lg:py-8"}>
        <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
          <div className="flex items-center gap-2 text-[13px] text-[var(--wk-danger)] mb-2">
            <i className="ri-error-warning-line text-[16px]" />
            Could not load chart history
          </div>
          <p className="text-[12px] text-[var(--wk-text-muted)] mb-3">{state.error}</p>
          <button onClick={load} className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--wk-brand)] hover:opacity-80 transition-opacity">
            <i className="ri-refresh-line text-[12px]" /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (state.status === "empty") {
    return null;
  }

  const { data } = state;
  const appearances = Array.isArray(data.appearances) ? data.appearances : [];

  // Build trajectory points (chronological: oldest to newest)
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

  const totalAppearances = chartAppearanceCount || appearances.length;
  const visibleAppearances = appearances.slice(0, visibleCount);
  const hasMore = visibleCount < totalAppearances;
  const remainingCount = totalAppearances - visibleCount;

  const handleShowMore = () => {
    setVisibleCount((prev) => Math.min(prev + 10, totalAppearances));
  };

  const handleShowAll = () => {
    setVisibleCount(totalAppearances);
  };

  return (
    <div className={compact ? "px-5 py-4" : "px-4 py-6 lg:px-6 lg:py-8"}>
      {/* Trajectory visualization — only if enough data */}
      {combinedHistory.length >= 2 && (
        <div className="mb-5 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
          <ChartTrajectory
            history={combinedHistory}
            points={trajectoryPoints}
            peakPosition={trackPeak}
            currentRank={trackRank}
            weeksOnChart={trackWeeks || data.totalWeeksOnChart || combinedHistory.length}
            compact={compact}
          />
        </div>
      )}

      {/* Appearance list — scrollable, paginated */}
      {appearances.length > 0 && (
        <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
          {/* Scrollable list body */}
          <div className="max-h-[520px] overflow-y-auto divide-y divide-[var(--wk-divider)]">
            {visibleAppearances.map((appearance, idx) => {
              const prev = appearances[idx + 1] ?? null;
              const { delta, direction } = calcMovement(
                appearance.rank,
                prev?.rank ?? null,
              );
              const isLatest = idx === 0;

              return (
                <Link
                  key={appearance.editionSlug}
                  to={`/charts/${chartProgramSlugFromEditionSlug(appearance.editionSlug)}/${appearance.editionSlug}`}
                  className={`flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--wk-bg)] group ${
                    isLatest ? "bg-[var(--wk-brand-soft)]/30" : ""
                  }`}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-11 text-center">
                    <span
                      className={`font-black tabular-nums ${
                        appearance.rank <= 3
                          ? "text-[var(--wk-brand)] text-[17px]"
                          : appearance.rank <= 10
                          ? "text-[var(--wk-text)] text-[15px]"
                          : "text-[var(--wk-text-muted)] text-[14px]"
                      }`}
                    >
                      {appearance.rank}
                    </span>
                  </div>

                  {/* Edition + date */}
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-[13px] font-semibold text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors">
                      {appearance.editionLabel}
                    </div>
                    <div className="text-[10px] text-[var(--wk-text-faint)]">
                      {formatDateLabel(appearance.date)}
                    </div>
                  </div>

                  {/* Movement arrow */}
                  {direction === "new" && (
                    <span className="flex-shrink-0 inline-flex items-center gap-0.5 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[var(--wk-brand)]">
                      NEW
                    </span>
                  )}
                  {direction === "up" && (
                    <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-[12px] font-bold text-[var(--wk-success)]">
                      <i className="ri-arrow-up-line text-[12px]" />
                      {delta}
                    </span>
                  )}
                  {direction === "down" && (
                    <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-[12px] font-bold text-[var(--wk-danger)]">
                      <i className="ri-arrow-down-line text-[12px]" />
                      {delta}
                    </span>
                  )}
                  {direction === "same" && (
                    <span className="flex-shrink-0 text-[11px] text-[var(--wk-text-faint)]">—</span>
                  )}

                  {/* Chevron */}
                  <i className="ri-arrow-right-s-line flex-shrink-0 text-[var(--wk-text-faint)] text-[14px] opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              );
            })}
          </div>

          {/* Load more footer */}
          {hasMore && (
            <div className="border-t border-[var(--wk-divider)] px-4 py-3 flex items-center justify-center gap-3">
              <button
                onClick={handleShowMore}
                className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--wk-brand)] hover:opacity-80 transition-opacity cursor-pointer"
              >
                <i className="ri-arrow-down-line text-[13px]" />
                Show {Math.min(10, remainingCount)} more
              </button>
              {remainingCount > 10 && (
                <>
                  <span className="text-[var(--wk-text-faint)] text-[10px]">·</span>
                  <button
                    onClick={handleShowAll}
                    className="text-[11px] text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] transition-colors cursor-pointer"
                  >
                    Show all {remainingCount}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Summary footer when all shown */}
          {!hasMore && totalAppearances > INITIAL_SHOW && (
            <div className="border-t border-[var(--wk-divider)] px-4 py-2.5 text-center">
              <span className="text-[10px] text-[var(--wk-text-faint)]">
                All {totalAppearances} chart appearances shown
              </span>
            </div>
          )}
        </div>
      )}

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