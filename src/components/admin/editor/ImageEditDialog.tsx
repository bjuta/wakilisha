import { useState, useEffect } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { Modal } from "@/components/design-system/primitives/Modal";

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

  useEffect(() => {
    setAlt(meta.alt);
    setCaption(meta.caption);
    setTitle(meta.title);
  }, [meta.alt, meta.caption, meta.title, open]);

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <button
        onClick={onClose}
        className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2 text-[13px] font-semibold text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)] whitespace-nowrap"
      >
        Cancel
      </button>
      <button
        onClick={() => {
          onSave({ src: meta.src, alt, caption, title, assetId: meta.assetId });
          onClose();
        }}
        className="rounded-lg bg-[var(--wk-brand)] px-4 py-2 text-[13px] font-bold text-[var(--wk-brand-on)] transition-all hover:opacity-90 whitespace-nowrap"
      >
        <WkIcon name="Check" size={14} className="mr-1 inline" />
        Save Details
      </button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Image Details"
      maxWidth="lg"
      footer={footer}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] overflow-hidden">
          <img
            src={meta.src}
            alt={alt}
            className="w-full max-h-[200px] object-contain"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Alt Text <span className="font-normal normal-case text-[var(--wk-text-faint)]">(required for accessibility)</span>
          </label>
          <input
            type="text"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Describe the image for screen readers..."
            className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-2 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Caption <span className="font-normal normal-case text-[var(--wk-text-faint)]">(shown below the image)</span>
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption that appears below the image..."
            rows={2}
            className="w-full resize-none rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-2 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Title <span className="font-normal normal-case text-[var(--wk-text-faint)]">(hover tooltip on the image)</span>
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
    </Modal>
  );
}
