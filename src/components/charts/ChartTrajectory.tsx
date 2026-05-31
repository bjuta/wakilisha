import { useMemo } from "react";

interface ChartTrajectoryProps {
  history: number[];
  peakPosition: number;
  currentRank: number;
  weeksOnChart: number;
  compact?: boolean;
}

/**
 * Rank trajectory visualization.
 * Lower rank number = higher visual point.
 * Displays as connected bars with peak/current/weeks labels.
 */
export function ChartTrajectory({
  history,
  peakPosition,
  currentRank,
  weeksOnChart,
  compact = false,
}: ChartTrajectoryProps) {
  const data = useMemo(() => {
    if (!history || history.length < 2) return [];
    return history;
  }, [history]);

  if (data.length < 2) return null;

  const maxRank = Math.max(...data, 1);
  const minRank = Math.min(...data, 1);
  const range = Math.max(maxRank - minRank, 1);

  const barHeight = compact ? 48 : 80;
  const barWidth = compact ? 24 : 40;
  const gap = compact ? 2 : 6;
  const w = data.length * (barWidth + gap) + gap;
  const h = barHeight + 24;

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center gap-4">
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

      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: compact ? 64 : 104 }}>
        {data.map((rank, i) => {
          const normalized = (rank - minRank) / range;
          const height = Math.max(4, (1 - normalized) * (barHeight - 4));
          const x = gap + i * (barWidth + gap);
          const y = barHeight - height;
          const isPeak = rank === peakPosition;
          const isCurrent = i === data.length - 1;
          const fill = isPeak
            ? "var(--wk-brand)"
            : isCurrent
            ? "var(--wk-text)"
            : "var(--wk-text-muted)";
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={height}
                rx={compact ? 2 : 4}
                fill={fill}
                opacity={isPeak || isCurrent ? 1 : 0.5}
              />
              <text
                x={x + barWidth / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize={compact ? 8 : 10}
                fontWeight={700}
                fill={isPeak || isCurrent ? "var(--wk-text)" : "var(--wk-text-faint)"}
              >
                #{rank}
              </text>
              <text
                x={x + barWidth / 2}
                y={barHeight + 14}
                textAnchor="middle"
                fontSize={compact ? 7 : 9}
                fill="var(--wk-text-faint)"
              >
                W{i + 1}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}