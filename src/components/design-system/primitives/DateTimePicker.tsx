import { useEffect, useMemo, useRef, useState } from "react";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "./SearchableSelect";
import { WkNumberField } from "./NumberField";

type TemporalMode = "date" | "datetime" | "time";

type DraftDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

interface WkTemporalPickerProps {
  mode: TemporalMode;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  min?: string;
  max?: string;
  minYear?: number;
  maxYear?: number;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  showLabel?: boolean;
}

interface WkDateTimePickerProps
  extends Omit<WkTemporalPickerProps, "mode"> {}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function fallbackDraft(): DraftDateTime {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
  };
}

function parseValue(value: string, mode: TemporalMode): DraftDateTime {
  const fallback = fallbackDraft();

  if (mode === "time") {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return fallback;
    return {
      ...fallback,
      hour: Number(match[1]),
      minute: Number(match[2]),
    };
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(
    value,
  );
  if (!match) return fallback;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? fallback.hour),
    minute: Number(match[5] ?? fallback.minute),
  };
}

function serialize(draft: DraftDateTime, mode: TemporalMode) {
  if (mode === "time") {
    return `${pad(draft.hour)}:${pad(draft.minute)}`;
  }

  const date = `${String(draft.year).padStart(4, "0")}-${pad(draft.month)}-${pad(draft.day)}`;
  if (mode === "date") return date;

  return `${date}T${pad(draft.hour)}:${pad(draft.minute)}`;
}

function option(value: number, label = String(value)): SearchableSelectOption {
  return { value: String(value), label };
}

function boundaryYear(value?: string) {
  if (!value) return undefined;
  const match = /^(\d{4})-/.exec(value);
  return match ? Number(match[1]) : undefined;
}

function defaultLabel(mode: TemporalMode) {
  if (mode === "date") return "Date";
  if (mode === "time") return "Time";
  return "Date and time";
}

function placeholder(mode: TemporalMode) {
  if (mode === "date") return "Choose date";
  if (mode === "time") return "Choose time";
  return "Choose date and time";
}

function actionLabel(mode: TemporalMode) {
  if (mode === "date") return "Use date";
  if (mode === "time") return "Use time";
  return "Use date & time";
}

function displayValue(value: string, mode: TemporalMode) {
  if (!value) return placeholder(mode);
  const draft = parseValue(value, mode);

  if (mode === "time") {
    return new Intl.DateTimeFormat("en", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(2024, 0, 1, draft.hour, draft.minute));
  }

  const date = new Date(
    draft.year,
    draft.month - 1,
    draft.day,
    draft.hour,
    draft.minute,
  );

  if (mode === "date") {
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function WkTemporalPicker({
  mode,
  value,
  onChange,
  label = defaultLabel(mode),
  min,
  max,
  minYear,
  maxYear,
  disabled = false,
  className = "",
  triggerClassName = "",
  showLabel = true,
}: WkTemporalPickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftDateTime>(() =>
    parseValue(value, mode),
  );
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(parseValue(value, mode));
  }, [mode, open, value]);

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
  const hourOptions = useMemo(
    () =>
      Array.from({ length: 24 }, (_, hour) =>
        option(hour, `${pad(hour)}:00`),
      ),
    [],
  );
  const minuteOptions = useMemo(
    () =>
      Array.from({ length: 60 }, (_, minute) => option(minute, pad(minute))),
    [],
  );

  const inferredMinYear = minYear ?? boundaryYear(min) ?? 1;
  const inferredMaxYear = maxYear ?? boundaryYear(max) ?? 9999;
  const yearMin = Math.max(1, Math.min(inferredMinYear, inferredMaxYear));
  const yearMax = Math.min(9999, Math.max(inferredMinYear, inferredMaxYear));

  const display = useMemo(() => displayValue(value, mode), [mode, value]);
  const candidate = serialize(draft, mode);
  const validRange = (!min || candidate >= min) && (!max || candidate <= max);

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
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border border-wk-border bg-wk-surface px-3.5 py-2.5 text-left transition-colors focus:border-wk-border-strong focus:outline-none focus:ring-2 focus:ring-wk-brand/15 ${
          disabled
            ? "cursor-not-allowed opacity-50"
            : "hover:bg-wk-surface-raised"
        } ${triggerClassName}`.trim()}
      >
        <span>
          {showLabel ? (
            <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
              {label}
            </span>
          ) : null}
          <span
            className={`${showLabel ? "mt-0.5" : ""} block text-[13px] font-semibold ${
              value ? "text-wk-text" : "text-wk-text-muted"
            }`}
          >
            {display}
          </span>
        </span>
        <i
          aria-hidden="true"
          className={`${mode === "time" ? "ri-time-line" : "ri-calendar-2-line"} text-[17px] text-wk-text-muted`}
        />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={label}
          className="absolute left-0 top-full z-[var(--wk-z-dropdown)] mt-2 w-full min-w-[300px] rounded-2xl border border-wk-border-2 bg-wk-surface p-4 shadow-[var(--wk-shadow)] sm:min-w-[460px]"
        >
          <div className="mb-3">
            <div className="text-[12px] font-black text-wk-text">
              Choose {label.toLowerCase()}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-wk-text-muted">
              WAKILISHA-owned temporal controls with keyboard-accessible selection.
            </p>
          </div>

          <div
            className={`grid gap-2 ${
              mode === "time"
                ? "grid-cols-2"
                : "grid-cols-2 sm:grid-cols-3"
            }`}
          >
            {mode !== "time" ? (
              <>
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
                <WkNumberField
                  ariaLabel="Year"
                  value={draft.year}
                  onChange={(next) => {
                    if (Number.isFinite(next)) update("year", Math.trunc(next));
                  }}
                  min={yearMin}
                  max={yearMax}
                  step={1}
                  showSteppers={false}
                  formatOptions={{ useGrouping: false, maximumFractionDigits: 0 }}
                  groupClassName="h-10"
                  inputClassName="text-left"
                />
              </>
            ) : null}
            {mode !== "date" ? (
              <>
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
              </>
            ) : null}
          </div>

          {!validRange ? (
            <p role="alert" className="mt-3 text-[11px] font-semibold text-wk-danger">
              Choose a value inside the allowed range.
            </p>
          ) : null}

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
              disabled={!validRange}
              onClick={() => {
                onChange(candidate);
                setOpen(false);
              }}
              className="wk-button wk-button-sm wk-button-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              {actionLabel(mode)}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function WkDatePicker(props: WkDateTimePickerProps) {
  return <WkTemporalPicker {...props} mode="date" />;
}

export function WkTimePicker(props: WkDateTimePickerProps) {
  return <WkTemporalPicker {...props} mode="time" />;
}

export function WkDateTimePicker(props: WkDateTimePickerProps) {
  return <WkTemporalPicker {...props} mode="datetime" />;
}
