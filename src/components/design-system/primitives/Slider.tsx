import {
  Slider,
  SliderThumb,
  SliderTrack,
} from "react-aria-components";

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
  const normalizedValue = Number.isFinite(Number(value)) ? Number(value) : min;
  const span = Math.max(max - min, Number.EPSILON);
  const ratio = Math.min(1, Math.max(0, (normalizedValue - min) / span));

  return (
    <Slider
      aria-label={ariaLabel}
      value={normalizedValue}
      onChange={(next) => onChange(Number(next))}
      minValue={min}
      maxValue={max}
      step={step}
      isDisabled={disabled}
      className={`w-full ${disabled ? "opacity-50" : ""} ${className}`.trim()}
    >
      {showValueLabel ? (
        <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px] font-semibold text-wk-text-muted">
          <span>{ariaLabel}</span>
          <span aria-hidden="true" className="tabular-nums text-wk-text-soft">
            {formatValue(normalizedValue)}
          </span>
        </div>
      ) : null}
      <SliderTrack className={`relative flex h-8 w-full items-center ${trackClassName}`.trim()}>
        <div aria-hidden="true" className="absolute left-0 right-0 h-1.5 rounded-full bg-wk-surface-raised" />
        <div
          aria-hidden="true"
          className="absolute left-0 h-1.5 rounded-full bg-wk-brand"
          style={{ width: `${ratio * 100}%` }}
        />
        <SliderThumb className="h-5 w-5 rounded-full border-2 border-wk-surface bg-wk-brand shadow-sm outline-none transition-transform data-[dragging]:scale-110 data-[focus-visible]:ring-4 data-[focus-visible]:ring-wk-brand/20" />
      </SliderTrack>
    </Slider>
  );
}
