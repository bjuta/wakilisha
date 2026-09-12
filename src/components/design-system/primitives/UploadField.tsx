import { forwardRef } from "react";
import {
  Button,
  FileTrigger,
} from "react-aria-components";

interface WkUploadFieldProps {
  onSelect: (files: FileList | null) => void;
  accept?: string;
  multiple?: boolean;
  defaultCamera?: "user" | "environment";
  ariaLabel?: string;
  label?: string;
  description?: string;
  className?: string;
  disabled?: boolean;
}

interface WkUploadTriggerProps
  extends Pick<
    WkUploadFieldProps,
    "onSelect" | "accept" | "multiple" | "defaultCamera" | "ariaLabel" | "disabled"
  > {
  id?: string;
  className?: string;
}

function acceptedFileTypes(accept?: string) {
  if (!accept) return undefined;
  return accept
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export const WkUploadTrigger = forwardRef<HTMLButtonElement, WkUploadTriggerProps>(
  function WkUploadTrigger(
    {
      onSelect,
      accept,
      multiple = false,
      defaultCamera,
      ariaLabel = "Choose file",
      disabled = false,
      id,
      className = "sr-only",
    },
    ref,
  ) {
    return (
      <FileTrigger
        acceptedFileTypes={acceptedFileTypes(accept)}
        allowsMultiple={multiple}
        defaultCamera={defaultCamera}
        onSelect={onSelect}
      >
        <Button
          ref={ref}
          id={id}
          type="button"
          aria-label={ariaLabel}
          isDisabled={disabled}
          tabIndex={-1}
          className={className}
        >
          {ariaLabel}
        </Button>
      </FileTrigger>
    );
  },
);

export function WkUploadField({
  onSelect,
  accept,
  multiple = false,
  defaultCamera,
  ariaLabel = "Choose file",
  label = "Choose file",
  description,
  className = "",
  disabled = false,
}: WkUploadFieldProps) {
  return (
    <div className={className}>
      <FileTrigger
        acceptedFileTypes={acceptedFileTypes(accept)}
        allowsMultiple={multiple}
        defaultCamera={defaultCamera}
        onSelect={onSelect}
      >
        <Button
          type="button"
          aria-label={ariaLabel}
          isDisabled={disabled}
          className="flex w-full items-center gap-3 rounded-xl border border-dashed border-wk-border-strong bg-wk-surface px-4 py-3 text-left transition-colors hover:bg-wk-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-wk-brand/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wk-brand-soft text-wk-brand">
            <i aria-hidden="true" className="ri-upload-cloud-2-line text-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-bold text-wk-text">{label}</span>
            {description ? (
              <span className="mt-0.5 block text-[11px] leading-relaxed text-wk-text-muted">
                {description}
              </span>
            ) : null}
          </span>
        </Button>
      </FileTrigger>
    </div>
  );
}
