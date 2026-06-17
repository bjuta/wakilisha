import { useMemo } from "react";
import { WkIcon } from "@/components/design-system/Icon";

export interface SparklinePoint {
  rank: number;
  weekLabel: string;
  editionLabel?: string;
  date?: string;
}

interface TrackChartSparklineProps {
  history: number[];
  points?: SparklinePoint[];
  peakPosition: number;
  currentRank: number;
  weeksOnChart: number;
  compact?: boolean;
}

export function TrackChartSparkline({
  history,
  points,
  peakPosition,
  currentRank,
  weeksOnChart,
  compact = false,
}: TrackChartSparklineProps) {
  const data = useMemo<SparklinePoint[]>(() => {
    if (points && points.length >= 2) return points;
    if (!history || history.length < 2) return [];
    return history.map((rank, index) => ({
      rank,
      weekLabel: `W${index + 1}`,
    }));
  }, [history, points]);

  const ranks = data.map((d) => d.rank).filter((r) => r > 0);
  const maxRank = ranks.length > 0 ? Math.max(...ranks, 1) : 1;
  const minRank = ranks.length > 0 ? Math.min(...ranks, 1) : 1;
  const range = Math.max(maxRank - minRank, 1);

  const width = compact ? 280 : 400;
  const height = compact ? 60 : 80;
  const padding = { top: 8, right: 8, bottom: 20, left: 8 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const getX = (i: number) => padding.left + (i / Math.max(data.length - 1, 1)) * chartW;
  const getY = (rank: number) => {
    const normalized = (rank - minRank) / range;
    return padding.top + (1 - normalized) * chartH;
  };

  // Build smooth path
  const pathD = useMemo(() => {
    if (data.length < 2) return "";
    const pts = data.map((d, i) => [getX(i), getY(d.rank)]);
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpx1 = prev[0] + (curr[0] - prev[0]) * 0.4;
      const cpx2 = curr[0] - (curr[0] - prev[0]) * 0.4;
      d += ` C ${cpx1} ${prev[1]}, ${cpx2} ${curr[1]}, ${curr[0]} ${curr[1]}`;
    }
    return d;
  }, [data, minRank, range, chartW, chartH, padding.left, padding.top]);

  // Area fill path
  const areaD = useMemo(() => {
    if (data.length < 2) return "";
    const bottomY = padding.top + chartH;
    const pts = data.map((d, i) => [getX(i), getY(d.rank)]);
    let d = `M ${pts[0][0]} ${bottomY}`;
    d += ` L ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpx1 = prev[0] + (curr[0] - prev[0]) * 0.4;
      const cpx2 = curr[0] - (curr[0] - prev[0]) * 0.4;
      d += ` C ${cpx1} ${prev[1]}, ${cpx2} ${curr[1]}, ${curr[0]} ${curr[1]}`;
    }
    d += ` L ${pts[pts.length - 1][0]} ${bottomY} Z`;
    return d;
  }, [data, minRank, range, chartW, chartH, padding.left, padding.top]);

  if (data.length < 2) return null;

  const peakIndex = data.findIndex((d) => d.rank === peakPosition);
  const currentIndex = data.length - 1;

  return (
    <div className="w-full">
      {/* KPI strip */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--wk-brand)]/10 flex items-center justify-center">
            <WkIcon name="TrendingUp" size={14} className="text-[var(--wk-brand)]" />
          </div>
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
              Peak
            </div>
            <div className="text-[16px] font-black text-[var(--wk-brand)] leading-none">
              #{peakPosition}
            </div>
          </div>
        </div>
        <div className="h-6 w-px bg-[var(--wk-border)]" />
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
            Current
          </div>
          <div className="text-[16px] font-black text-[var(--wk-text)] leading-none">
            #{currentRank > 0 ? currentRank : "—"}
          </div>
        </div>
        <div className="h-6 w-px bg-[var(--wk-border)]" />
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
            Weeks
          </div>
          <div className="text-[16px] font-black text-[var(--wk-text)] leading-none">
            {weeksOnChart}
          </div>
        </div>
      </div>

      {/* Sparkline SVG */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height: compact ? 60 : 80 }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--wk-brand)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--wk-brand)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={areaD} fill="url(#sparklineGradient)" />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="var(--wk-brand)"
          strokeWidth={compact ? 2 : 2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Peak point */}
        {peakIndex >= 0 && (
          <g>
            <circle
              cx={getX(peakIndex)}
              cy={getY(data[peakIndex].rank)}
              r={compact ? 4 : 5}
              fill="var(--wk-brand)"
              stroke="var(--wk-bg)"
              strokeWidth={2}
            />
            <text
              x={getX(peakIndex)}
              y={getY(data[peakIndex].rank) - 10}
              textAnchor="middle"
              fontSize={compact ? 8 : 9}
              fontWeight={700}
              fill="var(--wk-brand)"
            >
              #{peakPosition}
            </text>
          </g>
        )}

        {/* Current point */}
        <g>
          <circle
            cx={getX(currentIndex)}
            cy={getY(data[currentIndex].rank)}
            r={compact ? 4 : 5}
            fill="var(--wk-text)"
            stroke="var(--wk-bg)"
            strokeWidth={2}
          />
          <text
            x={getX(currentIndex)}
            y={getY(data[currentIndex].rank) - 10}
            textAnchor="middle"
            fontSize={compact ? 8 : 9}
            fontWeight={700}
            fill="var(--wk-text)"
          >
            #{currentRank > 0 ? currentRank : "—"}
          </text>
        </g>

        {/* Week labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={getX(i)}
            y={height - 4}
            textAnchor="middle"
            fontSize={compact ? 7 : 8}
            fill="var(--wk-text-faint)"
            fontWeight={600}
          >
            {d.weekLabel}
          </text>
        ))}
      </svg>

      {/* Latest appearance label */}
      {data[currentIndex]?.editionLabel && (
        <div className="mt-1 text-[10px] font-semibold text-[var(--wk-text-faint)] text-center">
          Latest: {data[currentIndex].editionLabel}
          {data[currentIndex].date && ` · ${data[currentIndex].date}`}
        </div>
      )}
    </div>
  );
}