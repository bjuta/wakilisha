import type { ReactNode } from "react";
import { Sheet } from "./Sheet";
import { WkButton } from "./Button";

interface WkCommandSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  primaryLabel: string;
  onPrimary: () => void | Promise<void>;
  primaryDisabled?: boolean;
  busy?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  footerNote?: string;
}

export function WkCommandSheet({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  busy = false,
  secondaryLabel = "Cancel",
  onSecondary,
  footerNote,
}: WkCommandSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title} side="right">
      <div className="space-y-5">
        {(eyebrow || description) ? (
          <div>
            {eyebrow ? (
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-brand">
                {eyebrow}
              </div>
            ) : null}
            {description ? (
              <p className="mt-1 text-[12px] leading-relaxed text-wk-text-muted">
                {description}
              </p>
            ) : null}
          </div>
        ) : null}

        <div>{children}</div>

        <div className="border-t border-wk-divider pt-4">
          {footerNote ? (
            <p className="mb-3 text-[10px] leading-relaxed text-wk-text-faint">
              {footerNote}
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <WkButton
              variant="ghost"
              disabled={busy}
              onClick={onSecondary ?? onClose}
              className="wk-button-sm"
            >
              {secondaryLabel}
            </WkButton>
            <WkButton
              disabled={busy || primaryDisabled}
              onClick={() => void onPrimary()}
              className="wk-button-sm"
            >
              {busy ? "Working..." : primaryLabel}
            </WkButton>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
