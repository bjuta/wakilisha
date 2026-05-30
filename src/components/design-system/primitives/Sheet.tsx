import { useEffect, type ReactNode } from "react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  side?: "bottom" | "right";
}

export function Sheet({ open, onClose, title, children, side = "bottom" }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const panelClasses =
    side === "bottom"
      ? "absolute bottom-0 left-0 right-0 rounded-t-2xl max-h-[80vh] overflow-y-auto"
      : "absolute right-0 top-0 bottom-0 w-full max-w-sm overflow-y-auto";

  return (
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: "var(--wk-z-modal)" }}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-[var(--wk-overlay)]" onClick={onClose} />
      <div className={`wk-panel relative ${panelClasses}`}>
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