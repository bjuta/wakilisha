import type { IngestStudioKpi } from "@/services/chartsIngestion/ingestStudioTypes";
import { KpiCard } from "./KpiCard";

type IngestKpiStripProps = {
  kpis: IngestStudioKpi | null;
};

export function IngestKpiStrip({ kpis }: IngestKpiStripProps) {
  if (!kpis) return null;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <KpiCard label="Editions This Week" value={String(kpis.editionsThisWeek)} trend="+1" positive />
      <KpiCard label="Match Rate" value={`${kpis.canonicalMatchRate.toFixed(1)}%`} trend="-1.2%" positive={kpis.canonicalMatchRate >= 85} />
      <KpiCard label="Awaiting Review" value={String(kpis.rowsAwaitingReview)} trend="-4" positive={kpis.rowsAwaitingReview < 20} />
      <KpiCard label="Avg Run Time" value={`${(kpis.averageRunTimeMs / 1000).toFixed(1)}s`} trend="-0.3s" positive />
    </div>
  );
}
