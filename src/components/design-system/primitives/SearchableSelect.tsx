import { useEffect, useMemo, useState } from "react";
import {
  Button,
  ComboBox,
  Group,
  Input,
  ListBox,
  ListBoxItem,
  Popover,
} from "react-aria-components";

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  ariaLabel?: string;
  className?: string;
  inputClass?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search...",
  searchPlaceholder,
  emptyLabel = "No options found",
  ariaLabel,
  className = "",
  inputClass = "",
  disabled = false,
}: SearchableSelectProps) {
  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(selected?.label ?? "");

  useEffect(() => {
    if (!open) setSearch(selected?.label ?? "");
  }, [open, selected?.label]);

  const filtered = useMemo(() => {
    if (!open) return options;

    const query = search.trim().toLowerCase();
    if (!query) return options;

    return options.filter((option) => {
      const haystack =
        `${option.label} ${option.value} ${option.description ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [open, options, search]);

  const disabledKeys = useMemo(
    () =>
      options
        .filter((option) => option.disabled)
        .map((option) => option.value),
    [options],
  );

  const baseInputClass =
    "wk-input w-full rounded-xl border-wk-border bg-wk-surface pr-10 text-[13px] text-wk-text";

  return (
    <ComboBox
      aria-label={ariaLabel ?? "Select option"}
      className={`relative ${className}`}
      selectedKey={value || null}
      onSelectionChange={(nextValue) => {
        if (nextValue == null) return;

        const next = String(nextValue);
        const option = options.find((candidate) => candidate.value === next);
        if (!option || option.disabled) return;

        setSearch(option.label);
        onChange(next);
      }}
      inputValue={search}
      onInputChange={setSearch}
      isOpen={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setSearch("");
          return;
        }

        const current = options.find((option) => option.value === value);
        setSearch(current?.label ?? "");
      }}
      selectionMode="single"
      menuTrigger="focus"
      shouldFocusWrap
      allowsEmptyCollection
      defaultFilter={() => true}
      disabledKeys={disabledKeys}
      isDisabled={disabled}
    >
      <Group className="relative">
        <Input
          placeholder={searchPlaceholder ?? placeholder}
          className={`${baseInputClass} ${inputClass}`}
        />
        <Button
          aria-label={`Show ${ariaLabel ?? "options"}`}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-wk-text-muted transition-colors hover:bg-wk-surface-raised hover:text-wk-text focus:outline-none focus-visible:ring-2 focus-visible:ring-wk-brand/20"
        >
          {({ isPressed }) => (
            <i
              aria-hidden="true"
              className={`ri-arrow-down-s-line text-[16px] transition-transform ${
                open || isPressed ? "rotate-180" : ""
              }`}
            />
          )}
        </Button>
      </Group>

      {!open && selected?.description ? (
        <div className="mt-1 truncate px-1 text-[11px] text-wk-text-faint">
          {selected.description}
        </div>
      ) : null}

      <Popover
        offset={6}
        className="overflow-hidden rounded-xl border border-wk-border-2 bg-wk-surface shadow-[var(--wk-shadow)]"
        style={{
          zIndex: "calc(var(--wk-z-modal) + 10)",
          width: "var(--trigger-width)",
          maxWidth: "calc(100vw - 2rem)",
        }}
      >
        <ListBox
          className="max-h-[280px] overflow-y-auto p-1.5 outline-none"
          renderEmptyState={() => (
            <div className="px-3 py-4 text-center text-[12px] font-semibold text-wk-text-muted">
              {emptyLabel}
            </div>
          )}
        >
          {filtered.map((option) => (
            <ListBoxItem
              key={option.value}
              id={option.value}
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
    </ComboBox>
  );
}
