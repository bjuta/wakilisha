import { WkIcon } from "@/components/design-system/Icon";

export type AdminSaveStateMode = "saved" | "dirty" | "saving" | "locked";

const MODE_CLASSES: Record<AdminSaveStateMode, string> = {
  saved: "border-wk-success/30 bg-wk-success-soft text-wk-success",
  dirty: "border-wk-warning/30 bg-wk-warning-soft text-wk-warning",
  saving: "border-wk-info/30 bg-wk-info-soft text-wk-info",
  locked: "border-wk-info/30 bg-wk-info-soft text-wk-info",
};

export function resolveAdminSaveState({
  isDirty,
  isSaving,
  locked,
}: {
  isDirty: boolean;
  isSaving: boolean;
  locked?: boolean;
}): AdminSaveStateMode {
  if (locked) return "locked";
  if (isSaving) return "saving";
  if (isDirty) return "dirty";
  return "saved";
}

export function AdminSaveState({
  isDirty,
  isSaving,
  locked = false,
  lockedLabel = "Submitted Version",
  className = "",
}: {
  isDirty: boolean;
  isSaving: boolean;
  locked?: boolean;
  lockedLabel?: string;
  className?: string;
}) {
  const mode = resolveAdminSaveState({ isDirty, isSaving, locked });
  const label =
    mode === "locked"
      ? lockedLabel
      : mode === "saving"
        ? "Saving"
        : mode === "dirty"
          ? "Unsaved"
          : "All Saved";

  return (
    <span
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-bold ${MODE_CLASSES[mode]} ${className}`.trim()}
    >
      {mode === "saving" ? (
        <WkIcon name="Loader2" size={11} className="animate-spin" />
      ) : mode === "dirty" ? (
        <WkIcon name="Circle" size={7} />
      ) : mode === "locked" ? (
        <WkIcon name="Lock" size={11} />
      ) : (
        <WkIcon name="Check" size={11} />
      )}
      {label}
    </span>
  );
}
