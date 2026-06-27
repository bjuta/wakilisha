import { useState, useRef, useEffect, useCallback } from "react";
import { WkIcon } from "@/components/design-system/Icon";

export type DateRangeValue =
  | { mode: "preset"; days: number }
  | { mode: "custom"; start: string; end: string };

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  presets?: { days: number; label: string }[];
  compact?: boolean;
}

const DEFAULT_PRESETS: { days: number; label: string }[] = [
  { days: 1, label: "Today" },
  { days: 7, label: "7d" },
  { days: 14, label: "14d" },
  { days: 30, label: "30d" },
  { days: 60, label: "60d" },
  { days: 90, label: "90d" },
  { days: 0, label: "All Time" },
];

export default function DateRangePicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  compact = false,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(() => {
    if (value.mode === "custom") return value.start;
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [draftEnd, setDraftEnd] = useState(() => {
    if (value.mode === "custom") return value.end;
    return new Date().toISOString().split("T")[0];
  });

  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Sync draft when entering custom mode
  useEffect(() => {
    if (value.mode === "custom") {
      setDraftStart(value.start);
      setDraftEnd(value.end);
    }
  }, [value]);

  const handlePreset = useCallback((days: number) => {
    onChange({ mode: "preset", days });
  }, [onChange]);

  const handleCustomToggle = useCallback(() => {
    if (value.mode === "custom") {
      // Toggle — don't always close. Fixes the bug where clicking
      // "Custom" after closing the popover did nothing at all.
      setOpen((prev) => !prev);
      return;
    }
    // Enter custom mode with default 30-day range
    const end = new Date().toISOString().split("T")[0];
    const start = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    setDraftStart(start);
    setDraftEnd(end);
    onChange({ mode: "custom", start, end });
    setOpen(true);
  }, [value, onChange]);

  const handleApply = useCallback(() => {
    if (draftStart && draftEnd) {
      onChange({ mode: "custom", start: draftStart, end: draftEnd });
      setOpen(false);
    }
  }, [draftStart, draftEnd, onChange]);

  const isActivePreset = (days: number) =>
    value.mode === "preset" && value.days === days;

  const isCustom = value.mode === "custom";

  const formatCustomLabel = () => {
    if (value.mode !== "custom") return "Custom";
    const s = new Date(value.start + "T00:00:00");
    const e = new Date(value.end + "T00:00:00");
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${fmt(s)}. ${fmt(e)}`;
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="relative flex items-center gap-0" ref={ref}>
      {/* Pill selector */}
      <div className={`flex items-center gap-1 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] ${compact ? "p-0" : "p-0.5"}`}>
        {presets.map((p) => (
          <button
            key={p.days}
            onClick={() => handlePreset(p.days)}
            className={`rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
              compact
                ? "px-2 py-1 text-[10px]"
                : "px-3 py-1.5 text-[11px]"
            } ${
              isActivePreset(p.days)
                ? "bg-[var(--wk-brand)] text-white"
                : "text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
            }`}
          >
            {p.label}
          </button>
        ))}
        {/* Custom pill */}
        <button
          onClick={handleCustomToggle}
          className={`rounded-full font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
            compact ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]"
          } ${
            isCustom
              ? "bg-[var(--wk-brand)] text-white"
              : "text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
          }`}
        >
          <WkIcon name="Calendar" size={compact ? 10 : 11} />
          {isCustom ? formatCustomLabel() : "Custom"}
          {isCustom && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange({ mode: "preset", days: 30 });
              }}
              className="ml-0.5 hover:text-white/70 cursor-pointer"
            >
              <WkIcon name="X" size={compact ? 9 : 10} />
            </span>
          )}
        </button>
      </div>

      {/* Custom date popover */}
      {isCustom && open && (
        <div className="absolute top-full right-0 mt-2 z-50 w-[320px] rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[12px] font-bold text-[var(--wk-text)]">Custom date range</span>
            <button
              onClick={() => setOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-[var(--wk-bg-subtle)] text-[var(--wk-text-muted)] cursor-pointer"
            >
              <WkIcon name="X" size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {/* Start date */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-faint)]">
                Start date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={draftStart}
                  max={draftEnd || todayStr}
                  onChange={(e) => setDraftStart(e.target.value)}
                  className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 pl-9 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)] cursor-pointer"
                />
                <WkIcon
                  name="Calendar"
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)] pointer-events-none"
                />
              </div>
            </div>
            {/* End date */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-faint)]">
                End date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={draftEnd}
                  min={draftStart}
                  max={todayStr}
                  onChange={(e) => setDraftEnd(e.target.value)}
                  className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 pl-9 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)] cursor-pointer"
                />
                <WkIcon
                  name="Calendar"
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)] pointer-events-none"
                />
              </div>
            </div>

            {/* Quick presets inside custom panel */}
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[var(--wk-border)]">
              <span className="w-full text-[10px] text-[var(--wk-text-faint)] uppercase tracking-wider mb-0.5">
                Quick range
              </span>
              {[
                { label: "Last 7 days", days: 7 },
                { label: "Last 30 days", days: 30 },
                { label: "Last 90 days", days: 90 },
                { label: "This month", days: "month" },
                { label: "Last month", days: "lastMonth" },
                { label: "This year", days: "year" },
              ].map((qr) => (
                <button
                  key={qr.label}
                  onClick={() => {
                    const end = new Date();
                    let start = new Date();
                    if (qr.days === "month") {
                      start = new Date(end.getFullYear(), end.getMonth(), 1);
                    } else if (qr.days === "lastMonth") {
                      start = new Date(end.getFullYear(), end.getMonth() - 1, 1);
                      end.setDate(0); // last day of previous month
                    } else if (qr.days === "year") {
                      start = new Date(end.getFullYear(), 0, 1);
                    } else {
                      start = new Date(Date.now() - (qr.days as number) * 86400000);
                    }
                    setDraftStart(start.toISOString().split("T")[0]);
                    setDraftEnd(end.toISOString().split("T")[0]);
                  }}
                  className="rounded-md border border-[var(--wk-border)] px-2 py-1 text-[10px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:border-[var(--wk-text-faint)] transition-colors cursor-pointer whitespace-nowrap"
                >
                  {qr.label}
                </button>
              ))}
            </div>

            {/* Apply button */}
            <button
              onClick={handleApply}
              disabled={!draftStart || !draftEnd}
              className="w-full rounded-lg bg-[var(--wk-brand)] px-4 py-2 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer whitespace-nowrap"
            >
              Apply range
            </button>
          </div>
        </div>
      )}
    </div>
  );
}