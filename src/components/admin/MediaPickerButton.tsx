/**
 * MediaPickerButton — drop-in for any image field in the admin.
 *
 * Usage:
 *   <MediaPickerButton onSelect={(url) => setValue(url)} />
 *   <MediaPickerButton onSelect={(url) => setValue(url)} label="Choose logo" title="Select Logo" />
 *
 * Self-contained: manages its own open/close state.
 * Designed to sit next to URL inputs or preview boxes.
 */
import { useState } from "react";
import { MediaPickerModal } from "./MediaPickerModal";

interface Props {
  onSelect: (assetId: string | null, url: string) => void;
  /** Button label. Defaults to "Choose from library" */
  label?: string;
  /** Modal header title. Defaults to "Select Image" */
  title?: string;
  /** Extra className for the trigger button */
  className?: string;
  /** Use a compact icon-only variant */
  iconOnly?: boolean;
  /** When provided, the modal pre-selects this image and shows "Replace" */
  currentUrl?: string;
}

export function MediaPickerButton({
  onSelect,
  label = "Choose from library",
  title = "Select Image",
  className = "",
  iconOnly = false,
  currentUrl,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={iconOnly ? label : undefined}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--wk-text-muted)] transition-all hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] cursor-pointer ${className}`}
      >
        <i className="ri-image-add-line text-[13px]" />
        {!iconOnly && label}
      </button>

      <MediaPickerModal
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(assetId, url) => {
          onSelect(assetId, url);
          setOpen(false);
        }}
        title={title}
        currentUrl={currentUrl}
      />
    </>
  );
}