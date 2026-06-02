import { Settings, SlidersHorizontal, Eye, CheckCircle2 } from "lucide-react";

export type IngestStudioStep = "configure" | "rules" | "preview" | "commit";

interface StepperProps {
  step: IngestStudioStep;
  onStepChange: (s: "configure" | "rules") => void;
}

export function Stepper({ step, onStepChange }: StepperProps) {
  const steps = [
    { key: "configure" as const, label: "Program", icon: Settings },
    { key: "rules" as const, label: "Rules", icon: SlidersHorizontal },
    { key: "preview" as const, label: "Preview", icon: Eye },
    { key: "commit" as const, label: "Commit", icon: CheckCircle2 },
  ];

  const currentIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex flex-wrap items-center gap-0">
      {steps.map((s, i) => {
        const isActive = s.key === step;
        const isDone = i < currentIndex;
        const Icon = s.icon;
        const canJumpBack = isDone && (s.key === "configure" || s.key === "rules");

        return (
          <div key={s.key} className="flex items-center">
            <button
              onClick={() => canJumpBack && onStepChange(s.key)}
              disabled={!canJumpBack}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-semibold transition-all ${
                isActive
                  ? "bg-wk-brand text-wk-text-on-brand shadow-sm"
                  : isDone
                    ? canJumpBack
                      ? "bg-wk-brand-soft text-wk-brand cursor-pointer"
                      : "bg-wk-brand-soft text-wk-brand"
                    : "bg-wk-bg-subtle text-wk-text-faint cursor-default"
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                isActive ? "bg-wk-text-on-brand text-wk-brand" : isDone ? "bg-wk-brand text-wk-text-on-brand" : "bg-wk-border text-wk-text-faint"
              }`}>
                {isDone ? <CheckCircle2 size={10} /> : <Icon size={11} />}
              </span>
              {s.label}
            </button>
            {i < steps.length - 1 && (
              <div className={`mx-2 h-px w-6 ${isDone ? "bg-wk-brand" : "bg-wk-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
