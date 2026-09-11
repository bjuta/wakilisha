import type { ReactNode } from "react";
import { Radio, RadioGroup } from "react-aria-components";

interface WkRadioGroupProps {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  label?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  className?: string;
}

interface WkRadioProps {
  value: string;
  children?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function WkRadioGroup({
  value,
  onChange,
  children,
  label,
  ariaLabel,
  disabled = false,
  required = false,
  name,
  className = "",
}: WkRadioGroupProps) {
  return (
    <RadioGroup
      aria-label={ariaLabel ?? (typeof label === "string" ? label : "Choose one option")}
      value={value}
      onChange={onChange}
      isDisabled={disabled}
      isRequired={required}
      validationBehavior={required ? "native" : "aria"}
      name={name}
      className={className || "space-y-2"}
    >
      {label != null ? (
        <div className="text-[12px] font-bold text-wk-text-muted">{label}</div>
      ) : null}
      {children}
    </RadioGroup>
  );
}

export function WkRadio({
  value,
  children,
  description,
  disabled = false,
  ariaLabel,
  className = "",
}: WkRadioProps) {
  return (
    <Radio
      value={value}
      aria-label={ariaLabel}
      isDisabled={disabled}
      className={({ isDisabled, isFocusVisible }) =>
        `inline-flex items-start gap-2.5 text-[13px] text-wk-text outline-none ${
          isDisabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"
        } ${isFocusVisible ? "rounded-lg ring-2 ring-wk-brand/20" : ""} ${className}`
      }
    >
      {({ isSelected }) => (
        <>
          <span
            aria-hidden="true"
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
              isSelected
                ? "border-wk-brand bg-wk-surface"
                : "border-wk-border-strong bg-wk-surface"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full transition-colors ${
                isSelected ? "bg-wk-brand" : "bg-transparent"
              }`}
            />
          </span>
          {children != null || description != null ? (
            <span className="min-w-0 flex-1">
              {children != null ? (
                <span className="block font-semibold leading-snug">{children}</span>
              ) : null}
              {description != null ? (
                <span className="mt-0.5 block text-[11px] leading-snug text-wk-text-muted">
                  {description}
                </span>
              ) : null}
            </span>
          ) : null}
        </>
      )}
    </Radio>
  );
}
