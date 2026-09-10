import {
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { Portal } from "@/components/base/Portal";
import { useScrollLock } from "@/hooks/useScrollLock";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  side?: "bottom" | "right";
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  side = "bottom",
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKey);

    return () =>
      document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  const alignmentClasses =
    side === "bottom"
      ? "items-end justify-center"
      : "items-stretch justify-end";

  const panelClasses =
    side === "bottom"
      ? "w-full max-h-[80dvh] overflow-y-auto rounded-t-2xl"
      : "h-full w-full max-w-sm overflow-y-auto rounded-none sm:rounded-l-2xl";

  return (
    <Portal>
      <div
        className={`fixed inset-0 flex ${alignmentClasses}`}
        style={{ zIndex: "var(--wk-z-modal)" }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className="absolute inset-0 bg-[var(--wk-overlay)]"
          onClick={onClose}
        />
        <div
          ref={panelRef}
          tabIndex={-1}
          data-scroll-lock="container"
          className={`wk-panel relative ${panelClasses} outline-none`}
          style={{ zIndex: 1 }}
        >
          {title ? (
            <div className="flex items-center justify-between border-b border-[var(--wk-border)] px-5 py-4">
              <h2 className="text-[15px] font-bold text-[var(--wk-text)]">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
              >
                <i className="ri-close-line" />
              </button>
            </div>
          ) : null}
          <div className="p-5">{children}</div>
        </div>
      </div>
    </Portal>
  );
}
