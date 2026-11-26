import { WkSelect } from "@/components/design-system/primitives/Select";
import { SearchableSelect } from "@/components/design-system/primitives/SearchableSelect";
import type { RegistryFieldSchema } from "@/services/registry/admin/types";

// This value is a presentation-only sentinel. It never enters a Registry patch.
const UNSET = "__wk_registry_unset__";

export function RegistryChoiceField({ field, value, onChange }: {
  field: RegistryFieldSchema;
  value: unknown;
  onChange: (value: string) => void;
}) {
  const current = value == null ? "" : String(value);
  const selected = current || (field.allowUnset ? UNSET : "");
  const options = (field.options ?? []).map(value => ({
    value,
    label: field.optionLabels?.[value] ?? value.replace(/_/g, " ").replace(/^./, letter => letter.toUpperCase()),
    disabled: false,
  }));
  if (field.allowUnset) options.unshift({ value: UNSET, label: "Not set", disabled: false });
  // Do not silently hide or rewrite an existing out-of-catalogue value.
  if (current && !options.some(option => option.value === current)) {
    options.push({ value: current, label: `${current} (existing value, review required)`, disabled: true });
  }
  const choose = (next: string) => onChange(next === UNSET ? "" : next);
  return field.searchable ? (
    <SearchableSelect ariaLabel={field.label} options={options} value={selected}
      onChange={choose} searchPlaceholder="Search countries" />
  ) : (
    <WkSelect ariaLabel={field.label} options={options} value={selected}
      onChange={choose} placeholder="Select option" />
  );
}
