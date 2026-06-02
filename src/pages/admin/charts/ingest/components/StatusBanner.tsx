import { WkIcon } from "@/components/design-system/Icon";

type StatusBannerTone = "danger" | "success" | "warning" | "info";

type StatusBannerProps = {
  tone: StatusBannerTone;
  icon: "AlertCircle" | "CheckCircle2" | "AlertTriangle" | "RefreshCcw";
  message: string;
};

export function StatusBanner({ tone, icon, message }: StatusBannerProps) {
  const classes = {
    danger: "border-wk-danger/20 bg-wk-danger-soft text-wk-danger",
    success: "border-wk-success/20 bg-wk-success-soft text-wk-success",
    warning: "border-wk-warning/20 bg-wk-warning-soft text-wk-warning",
    info: "border-wk-brand/20 bg-wk-brand-soft text-wk-brand",
  }[tone];

  return (
    <div className={`rounded-lg border p-3 ${classes}`}>
      <div className="flex items-center gap-2">
        <WkIcon name={icon} size={16} />
        <span className="text-[13px] font-semibold">{message}</span>
      </div>
    </div>
  );
}
