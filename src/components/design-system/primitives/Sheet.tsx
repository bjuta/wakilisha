import { useId, type ReactNode } from "react";
import {
  Button,
  Dialog,
  Modal,
  ModalOverlay,
} from "react-aria-components";

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
  const rawId = useId();
  const titleId = `wk-sheet-title-${rawId.replace(/:/g, "")}`;

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
    <ModalOverlay
      isOpen={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      isDismissable
      className={`fixed inset-0 flex bg-[var(--wk-overlay)] ${alignmentClasses}`}
      style={{ zIndex: "var(--wk-z-modal)" }}
    >
      <Modal
        data-scroll-lock="container"
        className={`wk-panel relative ${panelClasses} outline-none`}
      >
        <Dialog
          aria-labelledby={title ? titleId : undefined}
          aria-label={title ? undefined : "Panel"}
          className="outline-none"
        >
          {title ? (
            <div className="flex items-center justify-between border-b border-[var(--wk-border)] px-5 py-4">
              <h2
                id={titleId}
                className="text-[15px] font-bold text-[var(--wk-text)]"
              >
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
      </Modal>
    </ModalOverlay>
  );
}
