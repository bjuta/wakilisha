import { AlertTriangle } from "lucide-react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestRun, ResourceGuardStatus } from "@/services/chartsIngestion/ingestStudioTypes";

interface ResourceGuardPanelProps {
  guard: ResourceGuardStatus | null;
  run: IngestRun | null;
}

export function ResourceGuardPanel({ guard, run }: ResourceGuardPanelProps) {
  return (
    <WkSurface className="p-4">
      <h2 className="mb-3 text-[14px] font-bold text-wk-text">Resource Guard</h2>
      {guard ? (
        <div className="space-y-2">
          {[
            { label: "Sources", value: guard.sourceCount },
            { label: "Provider Budget", value: `${guard.providerBudgetRemaining}%` },
            { label: "Worker Concurrency", value: guard.workerConcurrency },
            { label: "Est. Rows", value: guard.estimatedRowCount },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-[13px] text-wk-text-soft">{item.label}</span>
              <span className="text-[13px] font-semibold text-wk-text">{item.value}</span>
            </div>
          ))}
          {guard.duplicateRunWarning && (
            <div className="rounded bg-wk-warning-soft p-2 text-[12px] text-wk-warning">
              <AlertTriangle size={12} className="mr-1 inline" />{guard.duplicateRunWarning}
            </div>
          )}
          {guard.sameEditionDateWarning && (
            <div className="rounded bg-wk-warning-soft p-2 text-[12px] text-wk-warning">
              <AlertTriangle size={12} className="mr-1 inline" />{guard.sameEditionDateWarning}
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
              <span className="text-[13px] text-wk-text-soft">{item.label}</span>
              <span className="text-[13px] font-semibold text-wk-text">{item.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-wk-text-muted">Resource guard data appears after dry run.</p>
      )}
    </WkSurface>
  );
}