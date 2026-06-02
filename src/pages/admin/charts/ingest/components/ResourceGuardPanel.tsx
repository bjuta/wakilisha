import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestRun, ResourceGuardStatus } from "@/services/chartsIngestion/ingestStudioTypes";

interface ResourceGuardPanelProps {
  guard: ResourceGuardStatus | null;
  run: IngestRun | null;
}

export function ResourceGuardPanel({ guard, run }: ResourceGuardPanelProps) {
  return (
    <WkSurface className="p-4">
      <h2 className="mb-3 text-[14px] font-bold text-foreground-950">Resource Guard</h2>
      {guard ? (
        <div className="space-y-2">
          {[
            { label: "Sources", value: guard.sourceCount },
            { label: "Provider Budget", value: `${guard.providerBudgetRemaining}%` },
            { label: "Worker Concurrency", value: guard.workerConcurrency },
            { label: "Est. Rows", value: guard.estimatedRowCount },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-[13px] text-foreground-600">{item.label}</span>
              <span className="text-[13px] font-semibold text-foreground-950">{item.value}</span>
            </div>
          ))}
          {guard.duplicateRunWarning && (
            <div className="rounded bg-amber-50 p-2 text-[12px] text-amber-700">
              <i className="ri-alert-line mr-1" />{guard.duplicateRunWarning}
            </div>
          )}
          {guard.sameEditionDateWarning && (
            <div className="rounded bg-amber-50 p-2 text-[12px] text-amber-700">
              <i className="ri-alert-line mr-1" />{guard.sameEditionDateWarning}
            </div>
          )}
        </div>
      ) : run ? (
        <div className="space-y-2">
          {[
            { label: "Sources", value: run.sourceUrls.length },
            { label: "Chart Size", value: run.chartSize },
            { label: "Market", value: run.market },
            { label: "Detected Providers", value: run.detectedProviders.length },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-[13px] text-foreground-600">{item.label}</span>
              <span className="text-[13px] font-semibold text-foreground-950">{item.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-foreground-500">Resource guard data appears after dry run.</p>
      )}
    </WkSurface>
  );
}