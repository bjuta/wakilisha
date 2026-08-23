import {
  useEffect,
  type ReactNode,
} from "react";
import { Portal } from "@/components/base/Portal";
import { WkIcon } from "@/components/design-system/Icon";
import { useScrollLock } from "@/hooks/useScrollLock";

export function PlayerPanelSheet({
  open,
  onClose,
  mode,
  title,
  eyebrow,
  children,
}: {
  open: boolean;
  onClose: () => void;
  mode: "desktop" | "mobile";
  title: string;
  eyebrow?: string | null;
  children: ReactNode;
}) {
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const mobile = mode === "mobile";

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[120]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/55 backdrop-blur-sm"
          onClick={onClose}
          aria-label={`Close ${title}`}
        />

        <section
          data-scroll-lock="container"
          className={[
            "absolute overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-2xl",
            mobile
              ? "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[30px]"
              : "bottom-5 right-5 top-5 w-[min(440px,calc(100vw-40px))] rounded-[28px]",
          ].join(" ")}
          style={
            mobile
              ? {
                  paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
                }
              : undefined
          }
        >
          {mobile ? (
            <div className="flex justify-center pb-1 pt-2.5">
              <span className="h-1 w-10 rounded-full bg-[var(--wk-text-faint)]/45" />
            </div>
          ) : null}

          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 py-4">
            <div className="min-w-0">
              {eyebrow ? (
                <div className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-brand)]">
                  {eyebrow}
                </div>
              ) : null}
              <h2 className="truncate text-[18px] font-black tracking-[-0.02em] text-[var(--wk-text)]">
                {title}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={`Close ${title}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)] transition-colors hover:text-[var(--wk-text)]"
            >
              <WkIcon name="X" size={17} />
            </button>
          </div>

          <div className="max-h-[calc(88dvh-78px)] overflow-y-auto overscroll-contain p-4 md:p-5">
            {children}
          </div>
        </section>
      </div>
    </Portal>
  );
}
