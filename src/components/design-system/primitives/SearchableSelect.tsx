import { useState, useRef, useEffect, useMemo, useCallback } from "react";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClass?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search...",
  className = "",
  inputClass = "",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const activeIndexRef = useRef(-1);

  const selectedLabel = useMemo(
    () => options.find((opt) => opt.value === value)?.label ?? value,
    [options, value],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const lower = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(lower) ||
        opt.value.toLowerCase().includes(lower),
    );
  }, [options, search]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Focus search input when opened
  useEffect(() => {
    if (open) {
      activeIndexRef.current = -1;
      const timer = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  function handleSelect(optValue: string) {
    onChange(optValue);
    setOpen(false);
    setSearch("");
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(activeIndexRef.current + 1, filtered.length - 1);
      activeIndexRef.current = next;
      scrollToActive(next);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(activeIndexRef.current - 1, 0);
      activeIndexRef.current = prev;
      scrollToActive(prev);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndexRef.current >= 0 && activeIndexRef.current < filtered.length) {
        handleSelect(filtered[activeIndexRef.current].value);
      } else if (filtered.length === 1) {
        handleSelect(filtered[0].value);
      }
    }
  }

  function scrollToActive(index: number) {
    const el = listRef.current?.children[index] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }

  const baseInputClass =
    "w-full rounded-md border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none focus:border-wk-border-strong focus:ring-1 focus:ring-wk-brand/20";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`${baseInputClass} ${inputClass} flex items-center justify-between text-left cursor-pointer hover:bg-wk-surface-raised transition-colors`}
      >
        <span className={value ? "text-wk-text" : "text-wk-text-muted"}>
          {selectedLabel || placeholder}
        </span>
        <i
          className={`ri-arrow-down-s-line text-[14px] text-wk-text-muted transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-[var(--wk-z-dropdown)] mt-1 rounded-md border border-wk-border-2 bg-wk-surface shadow-[var(--wk-shadow)]">
          {/* Search input */}
          <div className="border-b border-wk-divider px-2 py-2">
            <div className="relative">
              <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-wk-text-muted pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  activeIndexRef.current = -1;
                }}
                onKeyDown={handleInputKeyDown}
                placeholder={placeholder}
                className="w-full rounded-md border border-wk-border bg-wk-bg-subtle py-1.5 pl-8 pr-3 text-[13px] text-wk-text outline-none placeholder:text-wk-text-faint focus:border-wk-border-strong"
              />
            </div>
          </div>

          {/* Options list */}
          <ul
            ref={listRef}
            className="max-h-[260px] overflow-y-auto py-1"
            role="listbox"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-[12px] text-wk-text-muted">
                No countries found
              </li>
            ) : (
              filtered.map((opt, idx) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  onClick={() => handleSelect(opt.value)}
                  onMouseEnter={() => {
                    activeIndexRef.current = idx;
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2 text-[13px] cursor-pointer transition-colors ${
                    activeIndexRef.current === idx
                      ? "bg-wk-brand-soft text-wk-text"
                      : opt.value === value
                      ? "bg-wk-surface-raised text-wk-text font-semibold"
                      : "text-wk-text-soft hover:bg-wk-surface-raised"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {opt.value === value && (
                    <i className="ri-check-line ml-auto shrink-0 text-[14px] text-wk-brand" />
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}