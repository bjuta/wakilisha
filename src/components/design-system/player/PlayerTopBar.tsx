import {
  WkIcon,
} from "@/components/design-system/Icon";

export function PlayerTopBar({
  mode,
  contextLabel,
  onClose,
  onMore,
}: {
  mode: "desktop" | "mobile";
  contextLabel: string;
  onClose: () => void;
  onMore: () => void;
}) {
  const mobile = mode === "mobile";
  // The exit must remain visible while the independent canvas scrolls.
  // Each mobile control uses the same theme contrast contract as its canvas.

  return (
    <div
      className={[
        "pointer-events-none z-20 items-center justify-between",
        mobile
          ? "fixed inset-x-0 top-0 grid min-h-[64px] grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3 border-b border-[var(--wk-border)] bg-[var(--wk-bg)]/95 px-5 backdrop-blur-xl"
          : "absolute inset-x-0 top-0 flex px-6 pt-5",
      ].join(" ")}
      style={
        mobile
          ? { paddingTop: "env(safe-area-inset-top)", paddingBottom: "10px" }
          : undefined
      }
    >
      <button
        type="button"
        onClick={onClose}
        className={mobile
          ? "pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-transparent text-[var(--wk-text)] transition-colors hover:bg-[var(--wk-surface-raised)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wk-brand)]"
          : "pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/20 text-white shadow-[0_8px_28px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-colors hover:bg-black/30"}
        aria-label="Close Player"
      >
        <WkIcon name={mobile ? "ChevronDown" : "ArrowLeft"} size={20} />
      </button>

      <div className={mobile
        ? "pointer-events-none min-w-0 truncate text-center text-[11px] font-bold uppercase tracking-[0.13em] text-[var(--wk-text)]"
        : "pointer-events-none absolute left-1/2 top-1/2 max-w-[50vw] -translate-x-1/2 -translate-y-1/2 truncate text-center text-[10px] font-black uppercase tracking-[0.2em] text-white/80 drop-shadow-[0_1px_10px_rgba(0,0,0,0.4)]"}>
        {contextLabel}
      </div>

      <button
        type="button"
        onClick={onMore}
        className={mobile
          ? "pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-transparent text-[var(--wk-text)] transition-colors hover:bg-[var(--wk-surface-raised)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wk-brand)]"
          : "pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/20 text-white shadow-[0_8px_28px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-colors hover:bg-black/30"}
        aria-label="More Player actions"
      >
        <WkIcon name="Ellipsis" size={20} />
      </button>
    </div>
  );
}
