import { useState, useEffect } from "react";
import { WkIcon } from "@/components/design-system/Icon";

interface ImageMeta {
  src: string;
  alt: string;
  caption: string;
  title: string;
  assetId?: string;
}

interface Props {
  open: boolean;
  meta: ImageMeta;
  onClose: () => void;
  onSave: (meta: ImageMeta) => void;
}

export function ImageEditDialog({ open, meta, onClose, onSave }: Props) {
  const [alt, setAlt] = useState(meta.alt);
  const [caption, setCaption] = useState(meta.caption);
  const [title, setTitle] = useState(meta.title);

  // Reset fields when meta changes
  useEffect(() => {
    setAlt(meta.alt);
    setCaption(meta.caption);
    setTitle(meta.title);
  }, [meta.alt, meta.caption, meta.title, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--wk-border)] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
              <WkIcon name="Image" size={16} />
            </div>
            <h3 className="text-[15px] font-bold text-[var(--wk-text)]">Image Details</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)] transition-colors cursor-pointer"
          >
            <WkIcon name="X" size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Preview */}
          <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] overflow-hidden">
            <img
              src={meta.src}
              alt={alt}
              className="w-full max-h-[200px] object-contain"
            />
          </div>

          {/* Alt Text */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-1.5">
              Alt Text <span className="text-[var(--wk-text-faint)] font-normal normal-case">— required for accessibility</span>
            </label>
            <input
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Describe the image for screen readers..."
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-2 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
            />
          </div>

          {/* Caption */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-1.5">
              Caption <span className="text-[var(--wk-text-faint)] font-normal normal-case">— shown below the image</span>
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption that appears below the image..."
              rows={2}
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-2 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] resize-none transition-colors"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-1.5">
              Title <span className="text-[var(--wk-text-faint)] font-normal normal-case">— hover tooltip on the image</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional title attribute..."
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-2 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--wk-border)] px-5 py-3.5">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2 text-[13px] font-semibold text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)] transition-all cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave({ src: meta.src, alt, caption, title, assetId: meta.assetId });
              onClose();
            }}
            className="rounded-lg bg-[var(--wk-brand)] px-4 py-2 text-[13px] font-bold text-[var(--wk-brand-on)] hover:opacity-90 transition-all cursor-pointer whitespace-nowrap"
          >
            <WkIcon name="Check" size={14} className="inline mr-1" />
            Save Details
          </button>
        </div>
      </div>
    </div>
  );
}