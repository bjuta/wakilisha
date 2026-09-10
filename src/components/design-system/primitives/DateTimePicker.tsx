import { useEffect, useMemo, useRef, useState } from "react";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "./SearchableSelect";

interface WkDateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  minYear?: number;
  maxYear?: number;
  disabled?: boolean;
}

type DraftDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toLocalValue(draft: DraftDateTime) {
  return `${draft.year}-${pad(draft.month)}-${pad(draft.day)}T${pad(draft.hour)}:${pad(draft.minute)}`;
}

function parseValue(value: string): DraftDateTime {
  const parsed = value ? new Date(value) : new Date();
  const safe = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  return {
    year: safe.getFullYear(),
    month: safe.getMonth() + 1,
    day: safe.getDate(),
    hour: safe.getHours(),
    minute: safe.getMinutes(),
  };
}

function option(value: number, label = String(value)): SearchableSelectOption {
  return { value: String(value), label };
}

export function WkDateTimePicker({
  value,
  onChange,
  label = "Date and time",
  minYear = 2000,
  maxYear = new Date().getFullYear() + 2,
  disabled = false,
}: WkDateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftDateTime>(() => parseValue(value));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(parseValue(value));
  }, [open, value]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: String(index + 1),
        label: new Intl.DateTimeFormat("en", { month: "long" }).format(
          new Date(2024, index, 1),
        ),
      })),
    [],
  );

  const daysInMonth = new Date(draft.year, draft.month, 0).getDate();

  const dayOptions = useMemo(
    () => Array.from({ length: daysInMonth }, (_, index) => option(index + 1)),
    [daysInMonth],
  );

  const yearOptions = useMemo(
    () =>
      Array.from(
        { length: Math.max(1, maxYear - minYear + 1) },
        (_, index) => option(maxYear - index),
      ),
    [maxYear, minYear],
  );

  const hourOptions = useMemo(
    () =>
      Array.from({ length: 24 }, (_, hour) =>
        option(hour, `${pad(hour)}:00`),
      ),
    [],
  );

  const minuteOptions = useMemo(
    () =>
      Array.from({ length: 60 }, (_, minute) =>
        option(minute, pad(minute)),
      ),
    [],
  );

  const display = useMemo(() => {
    if (!value) return "Choose date and time";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Choose date and time";

    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsed);
  }, [value]);

  function update<K extends keyof DraftDateTime>(
    key: K,
    nextValue: DraftDateTime[K],
  ) {
    setDraft((current) => {
      const next = { ...current, [key]: nextValue };
      const maxDay = new Date(next.year, next.month, 0).getDate();
      if (next.day > maxDay) next.day = maxDay;
      return next;
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border border-wk-border bg-wk-surface px-3.5 py-2.5 text-left transition-colors focus:border-wk-border-strong focus:outline-none focus:ring-2 focus:ring-wk-brand/15 ${
          disabled
            ? "cursor-not-allowed opacity-50"
            : "hover:bg-wk-surface-raised"
        }`}
      >
        <span>
          <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
            {label}
          </span>
          <span className={`mt-0.5 block text-[13px] font-semibold ${value ? "text-wk-text" : "text-wk-text-muted"}`}>
            {display}
          </span>
        </span>
        <i aria-hidden="true" className="ri-calendar-2-line text-[17px] text-wk-text-muted" />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={label}
          className="absolute left-0 top-full z-[var(--wk-z-dropdown)] mt-2 w-full min-w-[320px] rounded-2xl border border-wk-border-2 bg-wk-surface p-4 shadow-[var(--wk-shadow)] sm:min-w-[460px]"
        >
          <div className="mb-3">
            <div className="text-[12px] font-black text-wk-text">Choose {label.toLowerCase()}</div>
            <p className="mt-1 text-[11px] leading-relaxed text-wk-text-muted">
              WAKILISHA-owned picker. No browser date or time chrome.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <SearchableSelect
              ariaLabel="Month"
              value={String(draft.month)}
              onChange={(next) => update("month", Number(next))}
              options={monthOptions}
              placeholder="Month"
              searchPlaceholder="Find month"
            />
            <SearchableSelect
              ariaLabel="Day"
              value={String(draft.day)}
              onChange={(next) => update("day", Number(next))}
              options={dayOptions}
              placeholder="Day"
              searchPlaceholder="Find day"
            />
            <SearchableSelect
              ariaLabel="Year"
              value={String(draft.year)}
              onChange={(next) => update("year", Number(next))}
              options={yearOptions}
              placeholder="Year"
              searchPlaceholder="Find year"
            />
            <SearchableSelect
              ariaLabel="Hour"
              value={String(draft.hour)}
              onChange={(next) => update("hour", Number(next))}
              options={hourOptions}
              placeholder="Hour"
              searchPlaceholder="Find hour"
            />
            <SearchableSelect
              ariaLabel="Minute"
              value={String(draft.minute)}
              onChange={(next) => update("minute", Number(next))}
              options={minuteOptions}
              placeholder="Minute"
              searchPlaceholder="Find minute"
            />
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-wk-divider pt-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="wk-button wk-button-sm wk-button-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(toLocalValue(draft));
                setOpen(false);
              }}
              className="wk-button wk-button-sm wk-button-primary"
            >
              Use date &amp; time
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
