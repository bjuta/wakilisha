import { Link } from "react-router-dom";
import { CHART_DATA } from "@/mocks/charts";

interface ChartCulturalAnalysisProps {
  biggestMoverTitle: string;
  biggestMoverArtist: string;
  biggestMoverAmount: number;
  longestRunningTitle: string;
  longestRunningArtist: string;
  longestRunningWeeks: number;
  newEntryCount: number;
}

export default function ChartCulturalAnalysis({
  biggestMoverTitle,
  biggestMoverArtist,
  biggestMoverAmount,
  longestRunningTitle,
  longestRunningArtist,
  longestRunningWeeks,
  newEntryCount,
}: ChartCulturalAnalysisProps) {
  const biggestMover = CHART_DATA.find((e) => e.title === biggestMoverTitle) || CHART_DATA[3];
  const longestRunner = CHART_DATA.find((e) => e.title === longestRunningTitle) || CHART_DATA[7];
  const newEntry = CHART_DATA.find((e) => e.movement === "new") || CHART_DATA[8];

  const stories = [
    {
      label: "Biggest climb",
      color: "var(--wk-success)",
      icon: "ri-arrow-up-circle-line",
      track: biggestMover,
      headline: `${biggestMoverTitle} surges +${biggestMoverAmount} positions`,
      analysis: `This is the largest single-week jump in 8 weeks. The momentum came from a sync placement in a major Nollywood release and a viral TikTok challenge that started in Accra and spread to Lagos within 72 hours.`,
    },
    {
      label: "New entry",
      color: "var(--wk-brand)",
      icon: "ri-sparkling-line",
      track: newEntry,
      headline: `${newEntry?.title || "New track"} debuts at #${newEntry?.rank || 9}`,
      analysis: `First-week debuts in the top 10 are rare — only 3% of new entries achieve this. The track benefited from a coordinated release across all major platforms with playlist priority from Spotify and Apple Music editorial teams.`,
    },
    {
      label: "Endurance",
      color: "var(--wk-info)",
      icon: "ri-time-line",
      track: longestRunner,
      headline: `${longestRunningTitle} marks ${longestRunningWeeks} weeks`,
      analysis: `At ${longestRunningWeeks} weeks, this track is now in the top 5% of all tracks by chart longevity. It has survived three genre shifts and two major competitor releases. The question is no longer if it falls — it is when it becomes a record.`,
    },
  ];

  return (
    <div className="reveal">
      <div className="mb-5 flex items-center justify-between">
        <div className="wk-eyebrow">Cultural Analysis</div>
        <span className="text-[11px] text-[var(--wk-text-faint)]">What the numbers mean</span>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {stories.map((s, i) => (
          <div
            key={i}
            className="group rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden transition-all hover:border-[var(--wk-border-strong)]"
          >
            <div className="flex flex-col sm:flex-row">
              {/* Artwork */}
              <div className="sm:w-[140px] shrink-0">
                <div className="h-[140px] sm:h-full w-full overflow-hidden bg-[var(--wk-surface-raised)]">
                  <img
                    src={s.track?.artworkUrl}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              </div>
              {/* Content */}
              <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between min-w-0">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: s.color + "14", color: s.color }}
                    >
                      <i className={s.icon} />
                      {s.label}
                    </span>
                    <span className="text-[11px] text-[var(--wk-text-faint)]">
                      {s.track?.genre} · {s.track?.label}
                    </span>
                  </div>
                  <h4 className="text-[18px] font-black text-[var(--wk-text)] leading-tight mb-2">
                    {s.headline}
                  </h4>
                  <p className="text-[14px] leading-[1.65] text-[var(--wk-text-soft)] max-w-2xl">
                    {s.analysis}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <Link
                    to={`/tracks/${s.track?.slug}`}
                    className="text-[12px] font-semibold text-[var(--wk-brand)] inline-flex items-center gap-1 hover:underline"
                  >
                    Track details <i className="ri-arrow-right-line" />
                  </Link>
                  <span className="text-[11px] text-[var(--wk-text-faint)]">
                    Rank #{s.track?.rank} · {s.track?.weeksOnChart} weeks
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}