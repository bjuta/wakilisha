import { Check, X, AlertTriangle } from "lucide-react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestRun } from "@/services/chartsIngestion/ingestStudioTypes";

interface PublishChecklistProps {
  run: IngestRun;
}

export function PublishChecklist({ run }: PublishChecklistProps) {
  const checklist = buildPublishChecklist(run);
  const passCount = checklist.filter((c) => c.pass).length;
  const total = checklist.length;
  const allPass = checklist.every((c) => !c.required || c.pass);

  return (
    <WkSurface className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-bold text-wk-text">Publish Readiness</h2>
        <span className={`text-[12px] font-bold ${allPass ? "text-wk-success" : "text-wk-warning"}`}>
          {passCount}/{total} passed
        </span>
      </div>
      <div className="space-y-2">
        {checklist.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
              item.pass ? "bg-wk-success text-wk-text-on-brand" : item.required ? "bg-wk-danger text-wk-text-on-brand" : "bg-wk-border text-wk-text-faint"
            }`}>
              {item.pass ? <Check size={10} /> : <X size={10} />}
            </div>
            <span className={`text-[12px] ${item.pass ? "text-wk-text-soft" : item.required ? "text-wk-danger font-semibold" : "text-wk-text-muted"}`}>
              {item.label}
              {!item.required && <span className="ml-1 text-[10px] text-wk-text-faint">(optional)</span>}
            </span>
          </div>
        ))}
      </div>
      {!allPass && (
        <p className="mt-3 text-[11px] text-wk-warning">
          <AlertTriangle size={12} className="mr-1 inline" />
          Fix failing required checks before publishing.
        </p>
      )}
    </WkSurface>
  );
}

function buildPublishChecklist(run: IngestRun): { label: string; pass: boolean; required: boolean }[] {
  const unresolved = run.rows.filter((r) => r.matchStatus === "needs_review" || r.matchStatus === "no_match");
  const failedStages = run.stages.filter((s) => s.status === "failed");
  return [
    { label: "Dry run completed", pass: run.status === "dry_run_complete" || run.status === "ready_to_commit", required: true },
    { label: "Sources fetched successfully", pass: failedStages.length === 0, required: true },
    { label: "Edition metadata is complete", pass: !!run.chartTitle && !!run.chartSlug && !!run.editionDate, required: true },
    { label: "Canonical matching complete", pass: unresolved.length === 0, required: false },
    { label: "No failed pipeline stages", pass: failedStages.length === 0, required: true },
    { label: "Chart size target met", pass: run.rows.length >= Math.min(run.chartSize, 10), required: false },
  ];
}