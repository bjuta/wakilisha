import { useState } from "react";
import {
  Button,
  Input,
  TextField,
} from "react-aria-components";

interface SharedFieldProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
}

interface WkPasswordFieldProps extends SharedFieldProps {
  autoComplete?: string;
  revealLabel?: string;
  concealLabel?: string;
}

export function WkPasswordField({
  value,
  onChange,
  ariaLabel,
  placeholder,
  className = "",
  inputClassName = "",
  disabled = false,
  required = false,
  name,
  autoComplete = "current-password",
  revealLabel = "Show password",
  concealLabel = "Hide password",
}: WkPasswordFieldProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <TextField
      aria-label={ariaLabel}
      value={value}
      onChange={onChange}
      isDisabled={disabled}
      isRequired={required}
      name={name}
      className={`relative ${className}`.trim()}
    >
      <Input
        type={revealed ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={`wk-input w-full rounded-xl border-wk-border bg-wk-surface pr-11 text-[13px] text-wk-text ${inputClassName}`.trim()}
      />
      <Button
        type="button"
        aria-label={revealed ? concealLabel : revealLabel}
        onPress={() => setRevealed((current) => !current)}
        className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-wk-text-muted transition-colors hover:bg-wk-surface-raised hover:text-wk-text focus:outline-none focus-visible:ring-2 focus-visible:ring-wk-brand/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <i
          aria-hidden="true"
          className={`${revealed ? "ri-eye-off-line" : "ri-eye-line"} text-[16px]`}
        />
      </Button>
    </TextField>
  );
}

interface WkSearchFieldProps extends SharedFieldProps {
  clearLabel?: string;
}

export function WkSearchField({
  value,
  onChange,
  ariaLabel,
  placeholder,
  className = "",
  inputClassName = "",
  disabled = false,
  required = false,
  name,
  clearLabel = "Clear search",
}: WkSearchFieldProps) {
  return (
    <TextField
      aria-label={ariaLabel}
      value={value}
      onChange={onChange}
      isDisabled={disabled}
      isRequired={required}
      name={name}
      className={`relative ${className}`.trim()}
    >
      <i
        aria-hidden="true"
        className="ri-search-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-wk-text-faint"
      />
      <Input
        type="text"
        role="searchbox"
        enterKeyHint="search"
        placeholder={placeholder}
        className={`wk-input w-full rounded-xl border-wk-border bg-wk-surface pl-9 pr-10 text-[13px] text-wk-text ${inputClassName}`.trim()}
      />
      {value ? (
        <Button
          type="button"
          aria-label={clearLabel}
          onPress={() => onChange("")}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-wk-text-muted transition-colors hover:bg-wk-surface-raised hover:text-wk-text focus:outline-none focus-visible:ring-2 focus-visible:ring-wk-brand/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <i aria-hidden="true" className="ri-close-line text-[16px]" />
        </Button>
      ) : null}
    </TextField>
  );
}
