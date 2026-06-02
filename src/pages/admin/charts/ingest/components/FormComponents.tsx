import { getProviderLabel, getProviderColorClass, getProviderIcon } from "@/services/chartsIngestion/client";
import type { ProviderName } from "@/services/chartsIngestion/ingestStudioTypes";

interface QuickTemplateButtonProps {
  label: string;
  onClick: () => void;
}

export function QuickTemplateButton({ label, onClick }: QuickTemplateButtonProps) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-background-200 bg-background-50 px-3 py-1.5 text-[12px] font-semibold text-foreground-700 transition-all hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 active:scale-[0.97]"
    >
      {label}
    </button>
  );
}

interface ProviderChipProps {
  provider: ProviderName;
}

export function ProviderChip({ provider }: ProviderChipProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold border ${getProviderColorClass(provider)}`}>
      <i className={getProviderIcon(provider)} />
      {getProviderLabel(provider)}
    </span>
  );
}

interface KindToggleProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}

export function KindToggle({ active, onClick, icon, label }: KindToggleProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-[13px] font-semibold transition-all ${
        active
          ? "border-primary-400 bg-primary-50 text-primary-700 shadow-sm"
          : "border-background-200 bg-background-50 text-foreground-600 hover:bg-background-100"
      }`}
    >
      <i className={icon} />
      {label}
    </button>
  );
}