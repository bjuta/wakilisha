import {
  useEffect,
  useId,
  useRef,
} from "react";
import { Portal } from "@/components/base/Portal";
import { useScrollLock } from "@/hooks/useScrollLock";

export function PostDeleteDialog({
  open,
  deleting,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  deleting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const keepButtonRef =
    useRef<HTMLButtonElement | null>(null);

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !deleting
      ) {
        onClose();
      }
    };

    window.addEventListener(
      "keydown",
      handleKey,
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKey,
      );
  }, [
    deleting,
    onClose,
    open,
  ]);

  useEffect(() => {
    if (open) {
      keepButtonRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="fixed inset-0 z-[155] flex items-end justify-center bg-black/45 sm:items-center sm:p-6"
        onMouseDown={() => {
          if (!deleting) {
            onClose();
          }
        }}
      >
        <div
          className="w-full rounded-t-[28px] border border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:max-w-[420px] sm:rounded-[28px] sm:p-6"
          onMouseDown={(event) =>
            event.stopPropagation()
          }
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]">
            <i
              className="ri-delete-bin-line text-[20px]"
              aria-hidden="true"
            />
          </div>

          <h2
            id={titleId}
            className="mt-5 text-[22px] font-black tracking-[-0.02em] text-[var(--wk-text)]"
          >
            Delete Post?
          </h2>

          <p
            id={descriptionId}
            className="mt-2 max-w-[34ch] text-[14px] leading-6 text-[var(--wk-text-muted)]"
          >
            This Post will be removed from WAKILISHA.
            You can't undo this.
          </p>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-[var(--wk-danger-soft)] px-3 py-2.5 text-[12px] font-bold text-[var(--wk-danger)]"
            >
              {error}
            </p>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              ref={keepButtonRef}
              type="button"
              disabled={deleting}
              onClick={onClose}
              className="min-h-11 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 text-[13px] font-black text-[var(--wk-text)] transition-colors hover:bg-[var(--wk-surface-raised)] disabled:opacity-50"
            >
              Keep Post
            </button>

            <button
              type="button"
              disabled={deleting}
              onClick={onConfirm}
              className="min-h-11 rounded-full bg-[var(--wk-danger)] px-4 text-[13px] font-black text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
            >
              {deleting
                ? "Deleting..."
                : "Delete Post"}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
