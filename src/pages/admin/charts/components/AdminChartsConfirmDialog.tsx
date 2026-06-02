import { useEffect, useRef } from "react";

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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCancel();
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open, onCancel]);

  if (!open) return null;

  const confirmClasses = variant === "danger"
    ? "bg-wk-danger text-white hover:opacity-90"
    : "bg-wk-brand text-wk-brand-on hover:opacity-90";

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50">
      <div ref={ref} className="w-full max-w-sm rounded-xl border border-wk-border bg-wk-surface p-6 shadow-lg">
        <div className="flex items-center gap-2">
          <i className={`${variant === "danger" ? "ri-error-warning-line text-wk-danger" : "ri-question-line text-wk-brand"} text-[18px]`} />
          <h3 className="text-[15px] font-bold text-wk-text">{title}</h3>
        </div>
        <p className="mt-2 text-[13px] text-wk-text-muted">{description}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
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
            {loading && <i className="ri-loader-4-line animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}