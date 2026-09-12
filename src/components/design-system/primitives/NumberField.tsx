import {
  Button,
  Group,
  Input,
  NumberField,
} from "react-aria-components";

interface WkNumberFieldProps {
  value?: number | string;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  groupClassName?: string;
  inputClassName?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  name?: string;
  showSteppers?: boolean;
  formatOptions?: Intl.NumberFormatOptions;
}

export function WkNumberField({
  value,
  onChange = () => {},
  min,
  max,
  step,
  ariaLabel,
  placeholder,
  className = "",
  groupClassName = "",
  inputClassName = "",
  disabled = false,
  readOnly = false,
  required = false,
  name,
  showSteppers = true,
  formatOptions,
}: WkNumberFieldProps) {
  const normalizedValue =
    value === "" || value == null || Number.isNaN(Number(value))
      ? undefined
      : Number(value);
  const controlName = ariaLabel || placeholder || "number";
  const exposeSteppers = showSteppers && !readOnly;

  return (
    <NumberField
      aria-label={ariaLabel}
      value={normalizedValue}
      onChange={onChange}
      minValue={min}
      maxValue={max}
      step={step}
      isDisabled={disabled}
      isReadOnly={readOnly}
      isRequired={required}
      name={name}
      formatOptions={formatOptions}
      className={className}
    >
      <Group
        className={`flex min-w-0 items-stretch overflow-hidden rounded-xl border border-wk-border bg-wk-surface focus-within:border-wk-border-strong focus-within:ring-2 focus-within:ring-wk-brand/15 ${groupClassName}`.trim()}
      >
        {exposeSteppers ? (
          <Button
            slot="decrement"
            aria-label={`Decrease ${controlName}`}
            className="flex w-10 shrink-0 items-center justify-center border-r border-wk-divider text-wk-text-muted transition-colors hover:bg-wk-surface-raised hover:text-wk-text focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wk-brand/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <i aria-hidden="true" className="ri-subtract-line text-[15px]" />
          </Button>
        ) : null}
        <Input
          placeholder={placeholder}
          className={`wk-input min-w-0 flex-1 border-0 bg-transparent text-center text-[13px] text-wk-text outline-none ring-0 ${inputClassName}`.trim()}
        />
        {exposeSteppers ? (
          <Button
            slot="increment"
            aria-label={`Increase ${controlName}`}
            className="flex w-10 shrink-0 items-center justify-center border-l border-wk-divider text-wk-text-muted transition-colors hover:bg-wk-surface-raised hover:text-wk-text focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wk-brand/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <i aria-hidden="true" className="ri-add-line text-[15px]" />
          </Button>
        ) : null}
      </Group>
    </NumberField>
  );
}
