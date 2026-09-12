import {
  Button,
  ComboBox,
  Input,
  ListBox,
  ListBoxItem,
  Popover,
} from "react-aria-components";

interface WkSuggestionFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}

export function WkSuggestionField({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder,
  className = "",
  inputClassName = "",
  disabled = false,
}: WkSuggestionFieldProps) {
  const selectedKey = options.includes(value) ? value : null;

  return (
    <ComboBox
      aria-label={ariaLabel}
      inputValue={value}
      selectedKey={selectedKey}
      onInputChange={onChange}
      onSelectionChange={(key) => {
        if (typeof key === "string") onChange(key);
      }}
      allowsCustomValue
      isDisabled={disabled}
      className={`relative ${className}`.trim()}
    >
      <div className="relative">
        <Input
          placeholder={placeholder}
          className={`wk-input w-full rounded-lg border border-wk-border bg-wk-bg pr-10 text-[13px] text-wk-text ${inputClassName}`.trim()}
        />
        <Button
          type="button"
          aria-label={`Show ${ariaLabel} suggestions`}
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-wk-text-muted outline-none hover:bg-wk-surface-raised focus-visible:ring-2 focus-visible:ring-wk-brand/20"
        >
          <i aria-hidden="true" className="ri-arrow-down-s-line text-[15px]" />
        </Button>
      </div>
      <Popover className="z-[var(--wk-z-dropdown)] max-h-64 w-[var(--trigger-width)] overflow-auto rounded-xl border border-wk-border bg-wk-surface p-1 shadow-[var(--wk-shadow)]">
        <ListBox items={options.map((option) => ({ id: option, label: option }))}>
          {(item) => (
            <ListBoxItem
              id={item.id}
              textValue={item.label}
              className="cursor-pointer rounded-lg px-3 py-2 text-[12px] font-semibold text-wk-text outline-none data-[focused]:bg-wk-surface-raised data-[selected]:text-wk-brand"
            >
              {item.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  );
}
