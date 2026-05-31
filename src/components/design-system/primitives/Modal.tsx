import { useEffect, useRef, type ReactNode } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

const maxWidths = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export function Modal({ open, onClose, title, children, maxWidth = "md" }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--wk-z-modal)] flex items-center justify-center p-4"
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
        className={`wk-panel relative w-full ${maxWidths[maxWidth]} outline-none`}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-[var(--wk-border)] px-5 py-4">
            <h2 className="text-[15px] font-bold text-[var(--wk-text)]">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
            >
              <i className="ri-close-line" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}