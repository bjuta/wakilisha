import type { ReactNode } from "react";
import { Checkbox } from "react-aria-components";

interface WkCheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  children?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  indeterminate?: boolean;
  ariaLabel?: string;
  className?: string;
  name?: string;
  value?: string;
  required?: boolean;
  readOnly?: boolean;
  id?: string;
}

export function WkCheckbox({
  checked,
  defaultChecked,
  onChange,
  children,
  description,
  disabled = false,
  indeterminate = false,
  ariaLabel,
  className = "",
  name,
  value,
  required = false,
  readOnly = false,
  id,
}: WkCheckboxProps) {
  return (
    <Checkbox
      id={id}
      aria-label={ariaLabel ?? (children == null ? "Toggle option" : undefined)}
      isSelected={checked}
      defaultSelected={defaultChecked}
      onChange={onChange}
      isDisabled={disabled}
      isIndeterminate={indeterminate}
      isRequired={required}
      isReadOnly={readOnly}
      validationBehavior={required ? "native" : "aria"}
      name={name}
      value={value}
      className={({ isDisabled, isFocusVisible }) =>
        `inline-flex items-start gap-2.5 text-[13px] text-wk-text outline-none ${
          isDisabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"
        } ${isFocusVisible ? "rounded-lg ring-2 ring-wk-brand/20" : ""} ${className}`
      }
    >
      {({ isSelected, isIndeterminate }) => (
        <>
          <span
            aria-hidden="true"
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
              isSelected || isIndeterminate
                ? "border-wk-brand bg-wk-brand text-wk-brand-on"
                : "border-wk-border-strong bg-wk-surface text-transparent"
            }`}
          >
            <i
              className={`${
                isIndeterminate ? "ri-subtract-line" : "ri-check-line"
              } text-[11px] font-black`}
            />
          </span>
          {description != null ? (
            <span className="min-w-0 flex-1">
              {children != null ? (
                <span className="block font-semibold leading-snug">{children}</span>
              ) : null}
              <span className="mt-0.5 block text-[11px] leading-snug text-wk-text-muted">
                {description}
              </span>
            </span>
          ) : (
            children
          )}
        </>
      )}
    </Checkbox>
  );
}
