import { WkIcon } from "@/components/design-system/Icon";

/** Controls belong to the viewport edge, not a reusable dashboard card. */
export function WkViewportControls({
  onZoomIn, onZoomOut, onFit, canZoomIn = true, canZoomOut = true,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  canZoomIn?: boolean;
  canZoomOut?: boolean;
}) {
  const buttonClass = "flex h-10 min-w-10 items-center justify-center border border-wk-border bg-wk-surface text-wk-text transition-colors hover:bg-wk-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-wk-brand disabled:opacity-40";
  return (
    <div data-wk-viewport-controls aria-label="Visualization controls"
      className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5">
      <button type="button" onClick={onZoomIn} disabled={!canZoomIn} aria-label="Zoom in" className={buttonClass}>
        <WkIcon name="Plus" size={17} aria-hidden="true" />
      </button>
      <button type="button" onClick={onZoomOut} disabled={!canZoomOut} aria-label="Zoom out" className={buttonClass}>
        <WkIcon name="Minus" size={17} aria-hidden="true" />
      </button>
      <button type="button" onClick={onFit} aria-label="Fit to screen"
        className={buttonClass + " px-3 text-[12px] font-semibold"}>Fit</button>
    </div>
  );
}
