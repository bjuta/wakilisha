export type WkWorkflowStepState =
  | "complete"
  | "current"
  | "available"
  | "blocked"
  | "upcoming";

export interface WkWorkflowStep {
  id: string;
  label: string;
  description?: string;
  state: WkWorkflowStepState;
}

interface WkWorkflowRailProps {
  steps: WkWorkflowStep[];
  onSelect?: (step: WkWorkflowStep) => void;
  ariaLabel?: string;
}

const markerClass: Record<WkWorkflowStepState, string> = {
  complete: "border-wk-brand bg-wk-brand text-white",
  current: "border-wk-brand bg-wk-brand-soft text-wk-brand",
  available: "border-wk-border-strong bg-wk-surface text-wk-text",
  blocked: "border-wk-border bg-wk-bg-subtle text-wk-text-faint",
  upcoming: "border-wk-border bg-wk-surface text-wk-text-faint",
};

export function WkWorkflowRail({
  steps,
  onSelect,
  ariaLabel = "Workflow progress",
}: WkWorkflowRailProps) {
  return (
    <nav aria-label={ariaLabel}>
      <ol className="grid gap-2 lg:grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
        {steps.map((step, index) => {
          const interactive =
            Boolean(onSelect) &&
            step.state !== "blocked" &&
            step.state !== "upcoming";

          const content = (
            <>
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-black ${markerClass[step.state]}`}
              >
                {step.state === "complete" ? (
                  <i aria-hidden="true" className="ri-check-line text-[14px]" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-black text-wk-text">
                  {step.label}
                </span>
                {step.description ? (
                  <span className="mt-0.5 block text-[10px] leading-snug text-wk-text-muted">
                    {step.description}
                  </span>
                ) : null}
              </span>
            </>
          );

          return (
            <li key={step.id} className="min-w-0">
              {interactive ? (
                <button
                  type="button"
                  aria-current={step.state === "current" ? "step" : undefined}
                  onClick={() => onSelect?.(step)}
                  className="flex w-full items-start gap-2.5 rounded-xl border border-wk-border bg-wk-surface px-3 py-3 text-left transition-colors hover:bg-wk-surface-raised focus:outline-none focus:ring-2 focus:ring-wk-brand/15"
                >
                  {content}
                </button>
              ) : (
                <div
                  aria-current={step.state === "current" ? "step" : undefined}
                  aria-disabled={
                    step.state === "blocked" || step.state === "upcoming"
                      ? "true"
                      : undefined
                  }
                  className="flex min-h-full items-start gap-2.5 rounded-xl border border-wk-border bg-wk-surface px-3 py-3"
                >
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
