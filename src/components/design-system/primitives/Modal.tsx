import type { ReactNode } from "react";
import {
  Button,
  Dialog,
  Modal as AriaModal,
  ModalOverlay,
} from "react-aria-components";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl";
  bodyClassName?: string;
  panelClassName?: string;
  dismissable?: boolean;
  showClose?: boolean;
}

const maxWidths = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = "md",
  bodyClassName = "",
  panelClassName = "",
  dismissable = true,
  showClose = true,
}: ModalProps) {
  if (!open) return null;

  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      isDismissable={dismissable}
      className="fixed inset-0 flex h-dvh min-h-0 items-center justify-center overflow-hidden bg-[var(--wk-overlay)] p-4"
      style={{ zIndex: "var(--wk-z-modal)" }}
    >
      <AriaModal
        data-scroll-lock="container"
        data-wk-modal-panel
        className={`wk-panel relative flex max-h-[calc(100dvh-2rem)] min-h-0 w-full ${maxWidths[maxWidth]} flex-col overflow-hidden outline-none ${panelClassName}`.trim()}
      >
        <Dialog
          aria-label={title || "Dialog"}
          className="flex min-h-0 flex-1 flex-col outline-none"
        >
          {title ? (
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--wk-border)] px-5 py-4">
              <h2 className="min-w-0 text-[15px] font-bold text-[var(--wk-text)]">
                {title}
              </h2>
              {showClose ? (
                <Button
                  slot="close"
                  aria-label="Close"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-colors hover:bg-[var(--wk-surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-wk-brand/20"
                >
                  <i aria-hidden="true" className="ri-close-line" />
                </Button>
              ) : null}
            </div>
          ) : null}
          <div
            data-wk-modal-body
            className={`min-h-0 flex-1 overflow-y-auto p-5 ${bodyClassName}`.trim()}
          >
            {children}
          </div>
          {footer ? (
            <div
              data-wk-modal-footer
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
