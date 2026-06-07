import { useMemo, useState } from "react";

export interface ChartTrajectoryPoint {
  rank: number;
  weekLabel: string;
  editionSlug?: string;
  editionLabel?: string;
  date?: string;
  seriesSlug: string;
  seriesLabel: string;
  colorVar: string;
}

interface ChartTrajectoryProps {
  history: number[];
  points?: ChartTrajectoryPoint[];
  peakPosition: number;
  currentRank: number;
  weeksOnChart: number;
  compact?: boolean;
}

const DEFAULT_COLOR = "var(--wk-brand)";
const MUTED_COLOR = "var(--wk-text-muted)";

export function ChartTrajectory({
  history,
  points,
  peakPosition,
  currentRank,
  weeksOnChart,
  compact = false,
}: ChartTrajectoryProps) {
  const [focusedSeries, setFocusedSeries] = useState<string | null>(null);

  const data = useMemo<ChartTrajectoryPoint[]>(() => {
    if (points && points.length >= 2) return points;

    if (!history || history.length < 2) return [];

    return history.map((rank, index) => ({
      rank,
      weekLabel: `W${index + 1}`,
      seriesSlug: "chart-history",
      seriesLabel: "Chart history",
      colorVar: DEFAULT_COLOR,
    }));
  }, [history, points]);

  const series = useMemo(() => {
    const seen = new Map<string, { label: string; colorVar: string }>();

    data.forEach((point) => {
      if (!seen.has(point.seriesSlug)) {
        seen.set(point.seriesSlug, {
          label: point.seriesLabel,
          colorVar: point.colorVar,
        });
      }
    });

    return Array.from(seen.entries()).map(([slug, value]) => ({
      slug,
      ...value,
    }));
  }, [data]);

  if (data.length < 2) return null;

  const ranks = data.map((point) => point.rank).filter((rank) => rank > 0);
  const maxRank = Math.max(...ranks, 1);
  const minRank = Math.min(...ranks, 1);
  const range = Math.max(maxRank - minRank, 1);

  const barHeight = compact ? 48 : 80;
  const barWidth = compact ? 24 : 40;
  const gap = compact ? 2 : 6;
  const w = data.length * (barWidth + gap) + gap;
  const h = barHeight + 24;

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">Peak</div>
          <div className="text-[18px] font-black text-[var(--wk-brand)]">#{peakPosition}</div>
        </div>
        <div className="h-6 w-px bg-[var(--wk-divider)]" />
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">Current</div>
          <div className="text-[18px] font-black text-[var(--wk-text)]">#{currentRank}</div>
        </div>
        <div className="h-6 w-px bg-[var(--wk-divider)]" />
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">Weeks</div>
          <div className="text-[18px] font-black text-[var(--wk-text)]">{weeksOnChart}</div>
        </div>
      </div>

      {series.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {series.map((item) => {
            const active = !focusedSeries || focusedSeries === item.slug;

            return (
              <button
                key={item.slug}
                type="button"
                onMouseEnter={() => setFocusedSeries(item.slug)}
                onMouseLeave={() => setFocusedSeries(null)}
                onFocus={() => setFocusedSeries(item.slug)}
                onBlur={() => setFocusedSeries(null)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-opacity"
                style={{ opacity: active ? 1 : 0.35 }}
                title={`Focus ${item.label}`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: item.colorVar }} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: compact ? 64 : 104 }}>
        {data.map((point, i) => {
          const rank = point.rank;
          const normalized = (rank - minRank) / range;
          const height = Math.max(4, (1 - normalized) * (barHeight - 4));
          const x = gap + i * (barWidth + gap);
          const y = barHeight - height;
          const isPeak = rank === peakPosition;
          const isCurrent = i === data.length - 1;
          const isFocusedOut = Boolean(focusedSeries && point.seriesSlug !== focusedSeries);
          const fill = isFocusedOut ? MUTED_COLOR : point.colorVar || DEFAULT_COLOR;

          return (
            <g
              key={`${point.editionSlug || point.weekLabel}-${i}`}
              onMouseEnter={() => setFocusedSeries(point.seriesSlug)}
              onMouseLeave={() => setFocusedSeries(null)}
              onFocus={() => setFocusedSeries(point.seriesSlug)}
              onBlur={() => setFocusedSeries(null)}
              tabIndex={0}
              role="img"
              aria-label={`${point.seriesLabel}, ${point.editionLabel || point.date || point.weekLabel}, rank ${rank}`}
              style={{ cursor: "pointer" }}
            >
              <title>{`${point.seriesLabel}${point.editionLabel ? ` · ${point.editionLabel}` : ""} · #${rank}`}</title>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={height}
                rx={compact ? 2 : 4}
                fill={fill}
                opacity={isFocusedOut ? 0.22 : isPeak || isCurrent ? 1 : 0.72}
              />
              <text
                x={x + barWidth / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize={compact ? 8 : 10}
                fontWeight={700}
                fill={isFocusedOut ? "var(--wk-text-faint)" : isPeak || isCurrent ? "var(--wk-text)" : "var(--wk-text-muted)"}
              >
                #{rank}
              </text>
              <text
                x={x + barWidth / 2}
                y={barHeight + 14}
                textAnchor="middle"
                fontSize={compact ? 7 : 9}
                fill={isFocusedOut ? "var(--wk-text-faint)" : "var(--wk-text-muted)"}
              >
                {point.weekLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
