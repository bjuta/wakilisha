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
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

const maxWidths = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "md",
}: ModalProps) {
  if (!open) return null;

  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      isDismissable
      className="fixed inset-0 flex items-center justify-center bg-[var(--wk-overlay)] p-4"
      style={{ zIndex: "var(--wk-z-modal)" }}
    >
      <AriaModal
        data-scroll-lock="container"
        className={`wk-panel relative max-h-[calc(100dvh-2rem)] w-full ${maxWidths[maxWidth]} overflow-y-auto outline-none`}
      >
        <Dialog
          aria-label={title || "Dialog"}
          className="outline-none"
        >
          {title ? (
            <div className="flex items-center justify-between border-b border-[var(--wk-border)] px-5 py-4">
              <h2 className="text-[15px] font-bold text-[var(--wk-text)]">
                {title}
              </h2>
              <Button
                slot="close"
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-colors hover:bg-[var(--wk-surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-wk-brand/20"
              >
                <i aria-hidden="true" className="ri-close-line" />
              </Button>
            </div>
          ) : null}
          <div className="p-5">{children}</div>
        </Dialog>
      </AriaModal>
    </ModalOverlay>
  );
}
