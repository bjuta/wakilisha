import type { IngestRun } from "@/services/chartsIngestion/ingestStudioTypes";

interface StepperProps {
  step: "configure" | "preview" | "commit";
  onStepChange: (s: "configure") => void;
}

export function Stepper({ step, onStepChange }: StepperProps) {
  const steps = [
    { key: "configure" as const, label: "Configure", icon: "ri-settings-3-line" },
    { key: "preview" as const, label: "Preview", icon: "ri-eye-line" },
    { key: "commit" as const, label: "Publish", icon: "ri-check-double-line" },
  ];

  const currentIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => {
        const isActive = s.key === step;
        const isDone = i < currentIndex;

        return (
          <div key={s.key} className="flex items-center">
            <button
              onClick={() => isDone && onStepChange("configure")}
              disabled={!isDone}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-semibold transition-all ${
                isActive
                  ? "bg-primary-500 text-background-50 shadow-sm"
                  : isDone
                    ? "bg-primary-100 text-primary-700 cursor-pointer"
                    : "bg-background-100 text-foreground-400 cursor-default"
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                isActive ? "bg-background-50 text-primary-600" : isDone ? "bg-primary-500 text-background-50" : "bg-background-200 text-foreground-400"
              }`}>
                {isDone ? <i className="ri-check-line" /> : i + 1}
              </span>
              {s.label}
            </button>
            {i < steps.length - 1 && (
              <div className={`mx-2 h-px w-6 ${isDone ? "bg-primary-400" : "bg-background-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}