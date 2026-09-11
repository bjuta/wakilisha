import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Button,
  Header,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  Popover,
  Select,
} from "react-aria-components";

export interface WkSelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  group?: string;
}

interface WkSelectProps {
  options?: WkSelectOption[];
  children?: ReactNode;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  "aria-label"?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  style?: CSSProperties;
}

function optionKey(value: string) {
  return `wk-select:${value}`;
}

function nodeText(node: ReactNode): string {
  let text = "";

  Children.forEach(node, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      text += String(child);
      return;
    }

    if (isValidElement<{ children?: ReactNode }>(child)) {
      text += nodeText(child.props.children);
    }
  });

  return text.trim();
}

function optionsFromChildren(children: ReactNode, group?: string): WkSelectOption[] {
  const parsed: WkSelectOption[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return;

    if (child.type === Fragment) {
      parsed.push(
        ...optionsFromChildren(child.props.children as ReactNode, group),
      );
      return;
    }

    if (child.type === "optgroup") {
      const nextGroup = String(child.props.label ?? "").trim() || group;
      parsed.push(
        ...optionsFromChildren(
          child.props.children as ReactNode,
          nextGroup,
        ),
      );
      return;
    }

    if (child.type !== "option") return;

    const label = nodeText(child.props.children as ReactNode);
    const rawValue = child.props.value;
    parsed.push({
      value: rawValue == null ? label : String(rawValue),
      label,
      disabled: Boolean(child.props.disabled),
      group,
    });
  });

  return parsed;
}

type OptionSegment = {
  group?: string;
  options: WkSelectOption[];
};

function optionSegments(options: WkSelectOption[]): OptionSegment[] {
  const segments: OptionSegment[] = [];

  for (const option of options) {
    const previous = segments[segments.length - 1];
    if (previous && previous.group === option.group) {
      previous.options.push(option);
      continue;
    }

    segments.push({ group: option.group, options: [option] });
  }

  return segments;
}

function WkSelectItem({ option }: { option: WkSelectOption }) {
  return (
    <ListBoxItem
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
  );
}

export function WkSelect({
  options,
  children,
  value,
  defaultValue,
  onChange,
  placeholder = "Select option",
  ariaLabel,
  "aria-label": nativeAriaLabel,
  className = "",
  triggerClassName = "",
  disabled = false,
  required = false,
  name,
  id,
  style,
}: WkSelectProps) {
  const resolvedOptions = useMemo(
    () => options ?? optionsFromChildren(children),
    [options, children],
  );
  const segments = optionSegments(resolvedOptions);
  const controlled = value !== undefined;
  const initialUncontrolledValue =
    defaultValue !== undefined
      ? String(defaultValue)
      : resolvedOptions[0]?.value;
  const [uncontrolledValue, setUncontrolledValue] = useState<string | undefined>(
    initialUncontrolledValue,
  );

  useEffect(() => {
    if (controlled) return;
    if (uncontrolledValue != null && resolvedOptions.some((option) => option.value === uncontrolledValue)) {
      return;
    }
    setUncontrolledValue(resolvedOptions[0]?.value);
  }, [controlled, resolvedOptions, uncontrolledValue]);

  const effectiveValue = controlled ? String(value) : uncontrolledValue;
  const selectedKey =
    effectiveValue == null || (required && effectiveValue === "")
      ? null
      : optionKey(effectiveValue);
  const selected =
    effectiveValue == null
      ? null
      : resolvedOptions.find((option) => option.value === effectiveValue) ?? null;

  return (
    <>
      <Select
      aria-label={ariaLabel ?? nativeAriaLabel ?? placeholder}
      className={className ? `relative ${className}` : "contents"}
      selectedKey={selectedKey}
      onSelectionChange={(key) => {
        if (key == null) return;

        const next = resolvedOptions.find(
          (option) => optionKey(option.value) === String(key),
        );
        if (!next || next.disabled) return;

        if (!controlled) setUncontrolledValue(next.value);
        onChange?.(next.value);
      }}
      isDisabled={disabled}
      isRequired={required}
      validationBehavior={required ? "native" : "aria"}
    >
      <Button
        id={id}
        type="button"
        style={style}
        className={({ isFocusVisible, isPressed }) =>
          `wk-input flex w-full items-center justify-between gap-3 rounded-xl border-wk-border bg-wk-surface px-3 text-[13px] text-wk-text transition-colors ${
            isFocusVisible ? "ring-2 ring-wk-brand/20" : ""
          } ${isPressed ? "bg-wk-surface-raised" : ""} ${triggerClassName}`
        }
      >
        <span
          className={`min-w-0 flex-1 truncate text-left ${
            selected || !controlled ? "text-wk-text" : "text-wk-text-faint"
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
          {segments.map((segment, segmentIndex) =>
            segment.group ? (
              <ListBoxSection
                key={`${segment.group}:${segmentIndex}`}
                className="border-b border-wk-border last:border-b-0"
              >
                <Header className="px-3 pb-1 pt-2 text-[9px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
                  {segment.group}
                </Header>
                {segment.options.map((option) => (
                  <WkSelectItem key={optionKey(option.value)} option={option} />
                ))}
              </ListBoxSection>
            ) : (
              segment.options.map((option) => (
                <WkSelectItem key={optionKey(option.value)} option={option} />
              ))
            ),
          )}
        </ListBox>
      </Popover>
      </Select>
      {name ? (
        <input type="hidden" name={name} value={effectiveValue ?? ""} />
      ) : null}
    </>
  );
}
