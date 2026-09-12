import { useState } from "react";
import {
  Button,
  Input,
  TextField,
} from "react-aria-components";

const DEFAULT_PALETTE = [
  "#111827",
  "#374151",
  "#6b7280",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#d946ef",
  "#ec4899",
];

interface WkColorFieldProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  palette?: string[];
  compact?: boolean;
}

function normalizedHex(value: string) {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  if (/^[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed}`;
  return value;
}

export function WkColorField({
  value,
  onChange,
  ariaLabel = "Color",
  className = "",
  disabled = false,
  palette = DEFAULT_PALETTE,
  compact = false,
}: WkColorFieldProps) {
  const [open, setOpen] = useState(false);
  const preview = /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim()
    : "transparent";

  if (compact) {
    return (
      <div className={`relative ${className}`.trim()}>
        <Button
          type="button"
          aria-label={ariaLabel}
          aria-expanded={open}
          onPress={() => setOpen((current) => !current)}
          isDisabled={disabled}
          className="h-10 w-10 rounded-lg border border-wk-border-strong p-1 outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-wk-brand/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span
            aria-hidden="true"
            className="block h-full w-full rounded-md shadow-inner"
            style={{ backgroundColor: preview }}
          />
        </Button>
        {open ? (
          <div
            role="group"
            aria-label={`${ariaLabel} palette`}
            className="absolute left-0 top-full z-[var(--wk-z-dropdown)] mt-2 grid w-40 grid-cols-4 gap-2 rounded-xl border border-wk-border bg-wk-surface p-2 shadow-[var(--wk-shadow)]"
          >
            {palette.map((color) => (
              <Button
                key={color}
                type="button"
                aria-label={`Use ${color}`}
                onPress={() => {
                  onChange(color);
                  setOpen(false);
                }}
                className="h-8 w-8 rounded-lg border border-wk-border-strong outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-wk-brand/30"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      <TextField
        aria-label={ariaLabel}
        value={value}
        onChange={onChange}
        isDisabled={disabled}
        className="relative"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 rounded-md border border-wk-border-strong shadow-inner"
          style={{ backgroundColor: preview }}
        />
        <Input
          type="text"
          inputMode="text"
          spellCheck={false}
          className="wk-input w-full rounded-xl border-wk-border bg-wk-surface pl-11 font-mono text-[13px] text-wk-text"
          onBlur={(event) => {
            const next = normalizedHex(event.currentTarget.value);
            if (next !== value) onChange(next);
          }}
        />
      </TextField>
      <div className="flex flex-wrap gap-1.5" aria-label={`${ariaLabel} palette`}>
        {palette.map((color) => (
          <Button
            key={color}
            type="button"
            aria-label={`Use ${color}`}
            onPress={() => onChange(color)}
            isDisabled={disabled}
            className="h-7 w-7 rounded-lg border border-wk-border-strong outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-wk-brand/30 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}
