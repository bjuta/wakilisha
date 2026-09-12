import {
  Button,
  Group,
  Input,
  NumberField,
} from "react-aria-components";

interface WkNumberFieldProps {
  value?: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  groupClassName?: string;
  inputClassName?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
}

export function WkNumberField({
  value,
  onChange,
  min,
  max,
  step,
  ariaLabel = "Number",
  placeholder,
  className = "",
  groupClassName = "",
  inputClassName = "",
  disabled = false,
  required = false,
  name,
}: WkNumberFieldProps) {
  return (
    <NumberField
      aria-label={ariaLabel}
      value={value}
      onChange={onChange}
      minValue={min}
      maxValue={max}
      step={step}
      isDisabled={disabled}
      isRequired={required}
      name={name}
      className={className}
    >
      <Group className={`flex min-w-0 items-stretch overflow-hidden rounded-xl border border-wk-border bg-wk-surface focus-within:border-wk-border-strong focus-within:ring-2 focus-within:ring-wk-brand/15 ${groupClassName}`.trim()}>
        <Button
          slot="decrement"
          aria-label={`Decrease ${ariaLabel}`}
          className="flex w-10 shrink-0 items-center justify-center border-r border-wk-divider text-wk-text-muted transition-colors hover:bg-wk-surface-raised hover:text-wk-text focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wk-brand/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <i aria-hidden="true" className="ri-subtract-line text-[15px]" />
        </Button>
        <Input
          placeholder={placeholder}
          className={`wk-input min-w-0 flex-1 border-0 bg-transparent text-center text-[13px] text-wk-text outline-none ring-0 ${inputClassName}`.trim()}
        />
        <Button
          slot="increment"
          aria-label={`Increase ${ariaLabel}`}
          className="flex w-10 shrink-0 items-center justify-center border-l border-wk-divider text-wk-text-muted transition-colors hover:bg-wk-surface-raised hover:text-wk-text focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wk-brand/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <i aria-hidden="true" className="ri-add-line text-[15px]" />
        </Button>
      </Group>
    </NumberField>
  );
}
