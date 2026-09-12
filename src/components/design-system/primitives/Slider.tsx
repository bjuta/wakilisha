interface WkSliderProps {
  value: number | string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel?: string;
  className?: string;
  trackClassName?: string;
  disabled?: boolean;
  showValueLabel?: boolean;
  formatValue?: (value: number) => string;
}

function decimalPlaces(value: number) {
  const text = String(value).toLowerCase();
  if (text.includes("e-")) {
    return Number(text.split("e-")[1] ?? 0);
  }
  return text.includes(".") ? (text.split(".")[1]?.length ?? 0) : 0;
}

function normalizeSliderValue(
  value: number,
  min: number,
  max: number,
  step: number,
) {
  const bounded = Math.min(max, Math.max(min, value));
  if (!Number.isFinite(step) || step <= 0) return bounded;

  const precision = Math.min(
    12,
    Math.max(decimalPlaces(min), decimalPlaces(max), decimalPlaces(step)),
  );
  const snapped = min + Math.round((bounded - min) / step) * step;
  return Number(Math.min(max, Math.max(min, snapped)).toFixed(precision));
}

export function WkSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  ariaLabel = "Value",
  className = "",
  trackClassName = "",
  disabled = false,
  showValueLabel = true,
  formatValue = (current) => String(current),
}: WkSliderProps) {
  const safeMax = Math.max(min, max);
  const numericValue = Number(value);
  const normalizedValue = normalizeSliderValue(
    Number.isFinite(numericValue) ? numericValue : min,
    min,
    safeMax,
    step,
  );
  const span = Math.max(safeMax - min, Number.EPSILON);
  const ratio = Math.min(1, Math.max(0, (normalizedValue - min) / span));

  function commit(next: number) {
    if (disabled) return;
    onChange(normalizeSliderValue(next, min, safeMax, step));
  }

  function commitFromClientX(clientX: number, element: HTMLDivElement) {
    if (disabled || safeMax <= min) return;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pointerRatio = Math.min(
      1,
      Math.max(0, (clientX - rect.left) / rect.width),
    );
    commit(min + pointerRatio * (safeMax - min));
  }

  const pageStep = Math.max(step, (safeMax - min) / 10);

  return (
    <div className={`w-full ${disabled ? "opacity-50" : ""} ${className}`.trim()}>
      {showValueLabel ? (
        <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px] font-semibold text-wk-text-muted">
          <span>{ariaLabel}</span>
          <span aria-hidden="true" className="tabular-nums text-wk-text-soft">
            {formatValue(normalizedValue)}
          </span>
        </div>
      ) : null}
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        aria-valuemin={min}
        aria-valuemax={safeMax}
        aria-valuenow={normalizedValue}
        aria-valuetext={formatValue(normalizedValue)}
        aria-disabled={disabled || undefined}
        className={`relative flex h-8 w-full touch-none items-center outline-none focus-visible:ring-2 focus-visible:ring-wk-brand/20 ${
          disabled ? "cursor-not-allowed" : "cursor-pointer"
        } ${trackClassName}`.trim()}
        onPointerDown={(event) => {
          if (disabled) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          commitFromClientX(event.clientX, event.currentTarget);
          event.currentTarget.focus();
        }}
        onPointerMove={(event) => {
          if (
            disabled
            || !event.currentTarget.hasPointerCapture(event.pointerId)
          ) {
            return;
          }
          commitFromClientX(event.clientX, event.currentTarget);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          let next: number | null = null;

          switch (event.key) {
            case "ArrowRight":
            case "ArrowUp":
              next = normalizedValue + step;
              break;
            case "ArrowLeft":
            case "ArrowDown":
              next = normalizedValue - step;
              break;
            case "Home":
              next = min;
              break;
            case "End":
              next = safeMax;
              break;
            case "PageUp":
              next = normalizedValue + pageStep;
              break;
            case "PageDown":
              next = normalizedValue - pageStep;
              break;
            default:
              return;
          }

          event.preventDefault();
          commit(next);
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-0 h-1.5 rounded-full bg-wk-surface-raised"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 h-1.5 rounded-full bg-wk-brand"
          style={{ width: `${ratio * 100}%` }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 rounded-full border-2 border-wk-surface bg-wk-brand shadow-sm"
          style={{ left: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
