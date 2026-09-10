import {
  SearchableSelect,
  type SearchableSelectOption,
} from "./SearchableSelect";

export interface WkEntityPickerOption extends SearchableSelectOption {
  kind?: string;
  context?: string;
}

interface WkEntityPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: WkEntityPickerOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  helper?: string;
  disabled?: boolean;
  required?: boolean;
}

export function WkEntityPicker({
  label,
  value,
  onChange,
  options,
  placeholder = "Choose an entity",
  searchPlaceholder = "Search by name or identity",
  emptyLabel = "No matching entities",
  helper,
  disabled = false,
  required = false,
}: WkEntityPickerProps) {
  const normalized = options.map((item) => ({
    ...item,
    description:
      item.description ||
      [item.kind, item.context].filter(Boolean).join(" · ") ||
      undefined,
  }));

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <label className="text-[11px] font-black text-wk-text">
          {label}
        </label>
        {required ? (
          <span className="text-[9px] font-black uppercase tracking-[0.1em] text-wk-brand">
            Required
          </span>
        ) : null}
      </div>

      <SearchableSelect
        ariaLabel={label}
        options={normalized}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        emptyLabel={emptyLabel}
        disabled={disabled}
      />

      {helper ? (
        <p className="mt-1.5 text-[10px] leading-relaxed text-wk-text-faint">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
