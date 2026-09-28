import { WkIcon } from "@/components/design-system/Icon";
import { Modal } from "@/components/design-system/primitives/Modal";

interface AdminChartsConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function AdminChartsConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  variant = "primary",
  onConfirm,
  onCancel,
  loading = false,
}: AdminChartsConfirmDialogProps) {
  const confirmClasses = variant === "danger"
    ? "bg-wk-danger text-white hover:opacity-90"
    : "bg-wk-brand text-wk-brand-on hover:opacity-90";

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <button
        onClick={onCancel}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-md border border-wk-border-2 bg-wk-surface px-4 py-2 text-[13px] font-semibold text-wk-text transition-colors hover:bg-wk-surface-raised disabled:opacity-50 whitespace-nowrap"
      >
        {cancelLabel}
      </button>
      <button
        onClick={onConfirm}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50 whitespace-nowrap ${confirmClasses}`}
      >
        {loading && <WkIcon name="Loader" size={14} className="animate-spin" />}
        {confirmLabel}
      </button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      maxWidth="sm"
      dismissable={!loading}
      footer={footer}
    >
      <div className="flex items-start gap-3">
        <WkIcon
          name={variant === "danger" ? "AlertTriangle" : "HelpCircle"}
          size={18}
          className={variant === "danger" ? "mt-0.5 text-wk-danger" : "mt-0.5 text-wk-brand"}
        />
        <p className="text-[13px] leading-5 text-wk-text-muted">{description}</p>
      </div>
    </Modal>
  );
}
