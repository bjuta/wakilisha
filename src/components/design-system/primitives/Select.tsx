import { useMemo } from "react";
import {
  Button,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
} from "react-aria-components";

export interface WkSelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface WkSelectProps {
  options: WkSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

function optionKey(value: string) {
  return `wk-select:${value}`;
}

export function WkSelect({
  options,
  value,
  onChange,
  placeholder = "Select option",
  ariaLabel,
  className = "",
  triggerClassName = "",
  disabled = false,
}: WkSelectProps) {
  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const selectedKey = selected ? optionKey(selected.value) : null;

  return (
    <Select
      aria-label={ariaLabel ?? placeholder}
      className={`relative ${className}`}
      selectedKey={selectedKey}
      onSelectionChange={(key) => {
        if (key == null) return;

        const next = options.find(
          (option) => optionKey(option.value) === String(key),
        );
        if (!next || next.disabled) return;

        onChange(next.value);
      }}
      isDisabled={disabled}
    >
      <Button
        className={({ isFocusVisible, isPressed }) =>
          `wk-input flex w-full items-center justify-between gap-3 rounded-xl border-wk-border bg-wk-surface px-3 text-[13px] text-wk-text transition-colors ${
            isFocusVisible ? "ring-2 ring-wk-brand/20" : ""
          } ${isPressed ? "bg-wk-surface-raised" : ""} ${triggerClassName}`
        }
      >
        <span
          className={`min-w-0 flex-1 truncate text-left ${
            selected ? "text-wk-text" : "text-wk-text-faint"
          }`}
        >
          {selected?.label ?? placeholder}
        </span>
        <i
          aria-hidden="true"
          className="ri-arrow-down-s-line shrink-0 text-[16px] text-wk-text-muted"
        />
      </Button>

      <Popover
        offset={6}
        className="overflow-hidden rounded-xl border border-wk-border-2 bg-wk-surface shadow-[var(--wk-shadow)]"
        style={{
          zIndex: "calc(var(--wk-z-modal) + 10)",
          width: "var(--trigger-width)",
          maxWidth: "calc(100vw - 2rem)",
        }}
      >
        <ListBox className="max-h-[280px] overflow-y-auto p-1.5 outline-none">
          {options.map((option) => (
            <ListBoxItem
              key={optionKey(option.value)}
              id={optionKey(option.value)}
              textValue={option.label}
              isDisabled={option.disabled}
              className={({ isFocused, isSelected, isDisabled }) =>
                `flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left outline-none transition-colors ${
                  isDisabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
                } ${
                  isFocused
                    ? "bg-wk-brand-soft text-wk-text ring-2 ring-inset ring-wk-brand"
                    : isSelected
                      ? "bg-wk-surface-raised text-wk-text"
                      : "text-wk-text-soft hover:bg-wk-surface-raised"
                }`
              }
            >
              {({ isSelected }) => (
                <>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[13px] ${
                        isSelected ? "font-bold" : "font-semibold"
                      }`}
                    >
                      {option.label}
                    </span>
                    {option.description ? (
                      <span className="mt-0.5 block text-[11px] leading-snug text-wk-text-faint">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  {isSelected ? (
                    <i
                      aria-hidden="true"
                      className="ri-check-line mt-0.5 shrink-0 text-[15px] text-wk-brand"
                    />
                  ) : null}
                </>
              )}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
