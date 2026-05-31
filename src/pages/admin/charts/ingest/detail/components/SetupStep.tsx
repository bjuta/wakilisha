import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestJob } from "@/services/chartsIngestion/types";

interface SetupStepProps {
  job: IngestJob;
}

export function SetupStep({ job }: SetupStepProps) {
  return (
    <div className="space-y-4">
      <WkSurface className="p-5">
        <h2 className="mb-4 text-[14px] font-bold text-[var(--wk-text)]">Job Configuration</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Chart Family</label>
            <div className="text-[13px] font-semibold text-[var(--wk-text)]">{job.chartFamily?.label}</div>
            <div className="text-[11px] text-[var(--wk-text-faint)]">{job.chartFamily?.description}</div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Edition Date</label>
            <div className="text-[13px] font-semibold text-[var(--wk-text)]">{job.editionDate}</div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Period</label>
            <div className="text-[13px] font-semibold text-[var(--wk-text)]">{job.periodStart} → {job.periodEnd}</div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Chart Size</label>
            <div className="text-[13px] font-semibold text-[var(--wk-text)]">{job.chartSize} entries</div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Ruleset</label>
            <div className="text-[13px] font-semibold text-[var(--wk-text)]">{job.rulesetKey}</div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Scoring Model</label>
            <div className="text-[13px] font-semibold text-[var(--wk-text)]">{job.scoringModelKey}</div>
          </div>
        </div>
      </WkSurface>
    </div>
  );
}