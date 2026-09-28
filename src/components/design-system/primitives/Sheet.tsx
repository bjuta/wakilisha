import { useId, type ReactNode } from "react";
import {
  Button,
  Dialog,
  Modal as AriaModal,
  ModalOverlay,
} from "react-aria-components";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: "bottom" | "right";
  bodyClassName?: string;
  panelClassName?: string;
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  side = "bottom",
  bodyClassName = "",
  panelClassName = "",
}: SheetProps) {
  const rawId = useId();
  const titleId = `wk-sheet-title-${rawId.replace(/:/g, "")}`;

  if (!open) return null;

  const alignmentClasses =
    side === "bottom"
      ? "items-end justify-center"
      : "items-stretch justify-end";

  const panelClasses =
    side === "bottom"
      ? "w-full max-h-[80dvh] rounded-t-2xl"
      : "h-dvh max-h-dvh w-full max-w-sm rounded-none sm:rounded-l-2xl";

  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      isDismissable
      className={`fixed inset-0 flex min-h-0 overflow-hidden bg-[var(--wk-overlay)] ${alignmentClasses}`}
      style={{ zIndex: "var(--wk-z-modal)" }}
    >
      <AriaModal
        data-scroll-lock="container"
        data-wk-sheet-panel
        className={`wk-panel relative flex min-h-0 flex-col overflow-hidden outline-none ${panelClasses} ${panelClassName}`.trim()}
      >
        <Dialog
          aria-labelledby={title ? titleId : undefined}
          aria-label={title ? undefined : "Panel"}
          className="flex min-h-0 flex-1 flex-col outline-none"
        >
          {title ? (
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--wk-border)] px-5 py-4">
              <h2
                id={titleId}
                className="min-w-0 text-[15px] font-bold text-[var(--wk-text)]"
              >
                {title}
              </h2>
              <Button
                slot="close"
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-colors hover:bg-[var(--wk-surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-wk-brand/20"
              >
                <i aria-hidden="true" className="ri-close-line" />
              </Button>
            </div>
          ) : null}
          <div
            data-wk-sheet-body
            className={`min-h-0 flex-1 overflow-y-auto p-5 ${bodyClassName}`.trim()}
          >
            {children}
          </div>
          {footer ? (
            <div
              data-wk-sheet-footer
              className="shrink-0 border-t border-[var(--wk-border)] bg-wk-surface px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4"
            >
              {footer}
            </div>
          ) : null}
        </Dialog>
      </AriaModal>
    </ModalOverlay>
  );
}
