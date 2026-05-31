import type { IngestJobStatus } from "@/services/chartsIngestion/types";
import { getStepStatus as getWorkflowStepStatus, getStore } from "@/services/chartsIngestion/client";

const STEPS = [
  { id: "setup", label: "Setup", icon: "ri-settings-3-line" },
  { id: "sources", label: "Sources", icon: "ri-database-2-line" },
  { id: "fetch", label: "Fetch", icon: "ri-download-cloud-line" },
  { id: "candidates", label: "Candidates", icon: "ri-file-list-line" },
  { id: "matching", label: "Matching", icon: "ri-links-line" },
  { id: "issues", label: "Review Issues", icon: "ri-flag-line" },
  { id: "ranking", label: "Ranking", icon: "ri-bar-chart-line" },
  { id: "draft", label: "Draft", icon: "ri-draft-line" },
  { id: "publish", label: "Publish", icon: "ri-check-double-line" },
];

interface StepperProps {
  jobId: string;
  jobStatus: IngestJobStatus;
  activeStep: number;
  onStepChange: (step: number) => void;
}

export function Stepper({ jobId, jobStatus, activeStep, onStepChange }: StepperProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {STEPS.map((step, index) => {
        const store = getStore();
        const state = {
          job: store.jobs.find((j) => j.id === jobId) ?? { id: jobId, status: jobStatus } as never,
          sources: store.sources.filter((s) => s.jobId === jobId),
          candidates: store.candidates.filter((c) => c.jobId === jobId),
          matches: store.matches.filter((m) => m.jobId === jobId),
          issues: store.issues.filter((i) => i.jobId === jobId),
          draftEntries: store.draftEntries.filter((d) => d.jobId === jobId),
        };
        const status = getWorkflowStepStatus(state, index);
        const isActive = index === activeStep;

        return (
          <button
            key={step.id}
            onClick={() => onStepChange(index)}
            disabled={status === "blocked"}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition-all ${
              isActive
                ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                : status === "completed"
                  ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]"
                  : status === "blocked"
                    ? "bg-[var(--wk-danger-soft)]/50 text-[var(--wk-danger)]/50 cursor-not-allowed"
                    : status === "warning"
                      ? "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]"
                      : "text-[var(--wk-text-faint)]"
            }`}
            title={status === "blocked" ? "Blocked — complete earlier steps first" : step.label}
          >
            <i className={step.icon} />
            <span className="hidden sm:inline">{step.label}</span>
            {status === "completed" && <i className="ri-check-line text-[10px]" />}
            {status === "blocked" && <i className="ri-lock-line text-[10px]" />}
            {status === "warning" && <i className="ri-error-warning-line text-[10px]" />}
          </button>
        );
      })}
    </div>
  );
}

export { STEPS };