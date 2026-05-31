import { Link } from "react-router-dom";
import { CHART_DATA } from "@/mocks/charts";

interface ChartJourneyProps {
  trackSlug?: string;
}

export default function ChartJourney({ trackSlug }: ChartJourneyProps) {
  const track = CHART_DATA.find((t) => t.slug === trackSlug) || CHART_DATA[0];
  
  // Generate a realistic journey based on the track's actual data
  const generateJourney = (weeks: number, peak: number, currentRank: number) => {
    const journey: number[] = [];
    // Start from entry position (usually higher number) and move toward current
    const entryRank = Math.min(40, currentRank + weeks * 2 + Math.floor(Math.random() * 10));
    
    for (let i = 0; i < weeks; i++) {
      const progress = i / (weeks - 1);
      // Non-linear path: starts high, may dip, then climbs to current position
      let rank = Math.round(entryRank - (entryRank - currentRank) * progress);
      // Add some noise for realistic chart movement
      if (i > 0 && i < weeks - 1) {
        rank += Math.floor(Math.random() * 5) - 2;
      }
      journey.push(Math.max(1, Math.min(40, rank)));
    }
    return journey;
  };

  const journey = generateJourney(track.weeksOnChart, track.peakPosition, track.rank);
  const maxRank = Math.max(...journey);
  const minRank = Math.min(...journey);
  const range = maxRank - minRank || 1;

  return (
    <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4 transition-all hover:border-[var(--wk-border-strong)]">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 rounded-lg overflow-hidden bg-[var(--wk-surface-raised)] shrink-0">
          <img src={track.artworkUrl} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0">
          <Link to={`/tracks/${track.slug}`} className="text-[13px] font-bold text-[var(--wk-text)] truncate hover:text-[var(--wk-brand)] transition-colors">
            {track.title}
          </Link>
          <div className="text-[11px] text-[var(--wk-text-muted)]">{track.artist}</div>
        </div>
        <div className="ml-auto text-right shrink-0">
          <div className="text-[16px] font-black text-[var(--wk-brand)]">#{track.rank}</div>
          <div className="text-[10px] text-[var(--wk-text-faint)]">{track.weeksOnChart} weeks</div>
        </div>
      </div>
      
      {/* Sparkline */}
      <div className="relative h-[48px] w-full">
        <svg className="h-full w-full" viewBox={`0 0 ${journey.length * 12} 48`} preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 12, 24, 36, 48].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2={journey.length * 12}
              y2={y}
              stroke="var(--wk-divider)"
              strokeWidth="0.5"
            />
          ))}
          
          {/* Area fill */}
          <path
            d={`
              M 0 ${48}
              ${journey.map((rank, i) => {
                const x = i * 12 + 6;
                const y = 4 + ((rank - minRank) / range) * 40;
                return `L ${x} ${y}`;
              }).join(" ")}
              L ${(journey.length - 1) * 12 + 6} 48
              Z
            `}
            fill="rgba(132,194,65,0.08)"
          />
          
          {/* Line */}
          <path
            d={journey.map((rank, i) => {
              const x = i * 12 + 6;
              const y = 4 + ((rank - minRank) / range) * 40;
              return `${i === 0 ? "M" : "L"} ${x} ${y}`;
            }).join(" ")}
            fill="none"
            stroke="var(--wk-brand)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Dots for each week */}
          {journey.map((rank, i) => {
            const x = i * 12 + 6;
            const y = 4 + ((rank - minRank) / range) * 40;
            const isPeak = rank === minRank;
            const isCurrent = i === journey.length - 1;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={isCurrent ? 3.5 : isPeak ? 3 : 1.5}
                fill={isCurrent ? "var(--wk-brand)" : isPeak ? "var(--wk-success)" : "var(--wk-brand)"}
                stroke={isCurrent || isPeak ? "var(--wk-bg)" : "none"}
                strokeWidth="1.5"
              />
            );
          })}
        </svg>
        
        {/* Week labels */}
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-[var(--wk-text-faint)]">Week 1</span>
          <span className="text-[9px] text-[var(--wk-text-faint)]">Week {track.weeksOnChart}</span>
        </div>
      </div>
    </div>
  );
}