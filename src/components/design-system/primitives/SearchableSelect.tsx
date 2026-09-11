import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const rawId = useId();
  const listboxId = `wk-searchable-select-${rawId.replace(/:/g, "")}`;

  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;

    return options.filter((option) => {
      const haystack = `${option.label} ${option.value} ${option.description ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [options, search]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setSearch("");
        setActiveIndex(-1);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        setSearch("");
        setActiveIndex(-1);
        window.setTimeout(() => triggerRef.current?.focus(), 0);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    setActiveIndex(initialActiveIndex());
    inputRef.current?.focus();
  }, [open]);

  function initialActiveIndex(): number {
    const selectedIndex = filtered.findIndex(
      (option) => option.value === value && !option.disabled,
    );
    if (selectedIndex >= 0) return selectedIndex;
    return filtered.findIndex((option) => !option.disabled);
  }

  function scrollToActive(index: number) {
    if (index < 0) return;
    const node = listRef.current?.children[index] as HTMLElement | undefined;
    node?.scrollIntoView({ block: "nearest" });
  }

  function moveActive(direction: 1 | -1) {
    if (filtered.length === 0) return;

    let next = activeIndex;
    for (let attempts = 0; attempts < filtered.length; attempts += 1) {
      next =
        direction === 1
          ? (next + 1 + filtered.length) % filtered.length
          : (next - 1 + filtered.length) % filtered.length;
      if (!filtered[next]?.disabled) {
        setActiveIndex(next);
        scrollToActive(next);
        return;
      }
    }
  }

  function select(option: SearchableSelectOption) {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    setSearch("");
    setActiveIndex(-1);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function handlePickerKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();

      if (!open) {
        setOpen(true);
        return;
      }

      moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (event.key === "Enter" && open) {
      event.preventDefault();
      const active = filtered[activeIndex];
      if (active && !active.disabled) {
        select(active);
        return;
      }

      const enabled = filtered.filter((option) => !option.disabled);
      if (enabled.length === 1) select(enabled[0]);
    }
  }

  const baseTriggerClass =
    "w-full rounded-xl border border-wk-border bg-wk-surface px-3.5 py-2.5 text-[13px] text-wk-text outline-none transition-colors focus:border-wk-border-strong focus:ring-2 focus:ring-wk-brand/15";

  return (
    <div
      ref={containerRef}
      onKeyDownCapture={handlePickerKeyDown}
      className={`relative ${className}`}
      style={open ? { zIndex: 20 } : undefined}
    >
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-activedescendant={
          open && activeIndex >= 0
            ? `${listboxId}-option-${activeIndex}`
            : undefined
        }
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
        className={`${baseTriggerClass} ${inputClass} flex items-center justify-between gap-3 text-left ${
          disabled
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer hover:bg-wk-surface-raised"
        }`}
      >
        <span className="min-w-0">
          <span
            className={`block truncate ${
              selected ? "font-semibold text-wk-text" : "text-wk-text-muted"
            }`}
          >
            {selected?.label || placeholder}
          </span>
          {selected?.description ? (
            <span className="mt-0.5 block truncate text-[11px] text-wk-text-faint">
              {selected.description}
            </span>
          ) : null}
        </span>
        <i
          aria-hidden="true"
          className={`ri-arrow-down-s-line shrink-0 text-[16px] text-wk-text-muted transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 overflow-hidden rounded-xl border border-wk-border-2 bg-wk-surface shadow-[var(--wk-shadow)]"
          style={{ zIndex: 21 }}
        >
          <div className="border-b border-wk-divider p-2">
            <div className="relative">
              <i
                aria-hidden="true"
                className="ri-search-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-wk-text-muted"
              />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setActiveIndex(-1);
                }}
                placeholder={searchPlaceholder ?? placeholder}
                aria-label={searchPlaceholder ?? `Search ${ariaLabel ?? "options"}`}
                aria-controls={listboxId}
                aria-activedescendant={
                  activeIndex >= 0
                    ? `${listboxId}-option-${activeIndex}`
                    : undefined
                }
                className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle py-2 pl-9 pr-3 text-[13px] text-wk-text outline-none placeholder:text-wk-text-faint focus:border-wk-border-strong focus:ring-2 focus:ring-wk-brand/10"
              />
            </div>
          </div>

          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            className="max-h-[280px] overflow-y-auto p-1.5"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-[12px] font-semibold text-wk-text-muted">
                {emptyLabel}
              </li>
            ) : (
              filtered.map((option, index) => {
                const selectedOption = option.value === value;
                const active = activeIndex === index;

                return (
                  <li key={option.value} role="presentation">
                    <button
                      id={`${listboxId}-option-${index}`}
                      type="button"
                      role="option"
                      tabIndex={-1}
                      aria-selected={selectedOption}
                      disabled={option.disabled}
                      onMouseEnter={() => {
                        if (!option.disabled) setActiveIndex(index);
                      }}
                      onClick={() => select(option)}
                      className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        option.disabled
                          ? "cursor-not-allowed opacity-40"
                          : "cursor-pointer"
                      } ${
                        active
                          ? "bg-wk-brand-soft text-wk-text ring-2 ring-inset ring-wk-brand"
                          : selectedOption
                            ? "bg-wk-surface-raised text-wk-text"
                            : "text-wk-text-soft hover:bg-wk-surface-raised"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[13px] ${selectedOption ? "font-bold" : "font-semibold"}`}>
                          {option.label}
                        </span>
                        {option.description ? (
                          <span className="mt-0.5 block text-[11px] leading-snug text-wk-text-faint">
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                      {selectedOption ? (
                        <i
                          aria-hidden="true"
                          className="ri-check-line mt-0.5 shrink-0 text-[15px] text-wk-brand"
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
