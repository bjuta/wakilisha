import { type LucideIcon } from "lucide-react";
import { getProviderLabel, getProviderColorClass } from "@/services/chartsIngestion/providerDetection";
import type { ProviderName } from "@/services/chartsIngestion/ingestStudioTypes";

interface QuickTemplateButtonProps {
  label: string;
  onClick: () => void;
}

export function QuickTemplateButton({ label, onClick }: QuickTemplateButtonProps) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-wk-border bg-wk-bg px-3 py-1.5 text-[12px] font-semibold text-wk-text-soft transition-all hover:border-wk-brand/50 hover:bg-wk-brand-soft hover:text-wk-brand active:scale-[0.97]"
    >
      {label}
    </button>
  );
}

interface ProviderChipProps {
  provider: ProviderName;
}

export function ProviderChip({ provider }: ProviderChipProps) {
  const providerIconClass: Record<string, string> = {
    spotify: "ri-spotify-fill",
    apple_music: "ri-apple-fill",
    youtube: "ri-youtube-fill",
    csv: "ri-file-list-line",
    manual: "ri-edit-line",
  };
  const iconClass = providerIconClass[provider] ?? "ri-database-2-line";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold border ${getProviderColorClass(provider)}`}>
      <i className={iconClass} />
      {getProviderLabel(provider)}
    </span>
  );
}

interface KindToggleProps {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}

export function KindToggle({ active, onClick, icon: Icon, label }: KindToggleProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-[13px] font-semibold transition-all ${
        active
          ? "border-wk-brand bg-wk-brand-soft text-wk-brand shadow-sm"
          : "border-wk-border bg-wk-bg text-wk-text-soft hover:bg-wk-bg-subtle"
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}