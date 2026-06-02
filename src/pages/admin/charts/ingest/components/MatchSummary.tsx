import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestRunSummary } from "@/services/chartsIngestion/ingestStudioTypes";

interface MatchSummaryProps {
  summary: IngestRunSummary;
}

export function MatchSummary({ summary }: MatchSummaryProps) {
  const segments = [
    { label: "Canonical", value: summary.canonicalMatches, color: "bg-green-500", text: "text-green-700" },
    { label: "Shells", value: summary.shells, color: "bg-amber-500", text: "text-amber-700" },
    { label: "Gaps", value: summary.gaps, color: "bg-red-500", text: "text-red-700" },
    { label: "Duplicates", value: summary.duplicateCandidates, color: "bg-purple-500", text: "text-purple-700" },
  ];

  return (
    <WkSurface className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-bold text-foreground-950">Match Summary</h2>
        <span className="text-[12px] font-bold text-primary-600">{summary.matchRate.toFixed(1)}% overall</span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {segments.map((s) => (
          <div key={s.label} className={`${s.color} transition-all`} style={{ width: `${summary.totalRows > 0 ? (s.value / summary.totalRows) * 100 : 0}%` }} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {segments.map((s) => (
          <div key={s.label} className="rounded-lg bg-background-50 p-2 border border-background-200">
            <div className={`mb-1 h-1.5 w-6 rounded-full ${s.color}`} />
            <p className="text-[11px] text-foreground-500">{s.label}</p>
            <p className={`text-[14px] font-bold ${s.text}`}>{s.value}</p>
          </div>
        ))}
      </div>
    </WkSurface>
  );
}