import type { ReactNode } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";

export interface AdminComposerMode {
  id: string;
  label: string;
  description?: string;
}

export function AdminModeComposer({
  modes,
  activeMode,
  onModeChange,
  children,
}: {
  modes: AdminComposerMode[];
  activeMode: string;
  onModeChange: (mode: string) => void;
  children: ReactNode;
}) {
  const active = modes.find((mode) => mode.id === activeMode);

  return (
    <WkSurface className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 border-b border-wk-border pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-wk-bg p-1"
          role="tablist"
          aria-label="Creation mode"
        >
          {modes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              role="tab"
              aria-selected={mode.id === activeMode}
              onClick={() => onModeChange(mode.id)}
              className={`shrink-0 rounded-lg px-4 py-2 text-xs font-black transition-colors ${
                mode.id === activeMode
                  ? "bg-wk-brand text-white"
                  : "text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
        {active?.description ? (
          <p className="text-xs text-wk-text-muted lg:text-right">
            {active.description}
          </p>
        ) : null}
      </div>
      <div className="pt-5">{children}</div>
    </WkSurface>
  );
}
