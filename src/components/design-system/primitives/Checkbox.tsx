import type { ReactNode } from "react";
import { Checkbox } from "react-aria-components";

interface WkCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  indeterminate?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function WkCheckbox({
  checked,
  onChange,
  children,
  description,
  disabled = false,
  indeterminate = false,
  ariaLabel,
  className = "",
}: WkCheckboxProps) {
  return (
    <Checkbox
      aria-label={ariaLabel}
      isSelected={checked}
      onChange={onChange}
      isDisabled={disabled}
      isIndeterminate={indeterminate}
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
          {children != null || description != null ? (
            <span className="min-w-0">
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
    </Checkbox>
  );
}
