import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { Modal } from "@/components/design-system/primitives/Modal";

interface ArchivePublishingItemDialogProps {
  open: boolean;
  itemTitle: string;
  loading: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (note: string) => Promise<void>;
}

export function ArchivePublishingItemDialog({
  open,
  itemTitle,
  loading,
  error,
  onCancel,
  onConfirm,
}: ArchivePublishingItemDialogProps) {
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setNote("");
      setNoteError(null);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanNote = note.trim();

    if (!cleanNote) {
      setNoteError("Record why this work is being archived.");
      return;
    }

    setNoteError(null);
    await onConfirm(cleanNote);
  }

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={loading}
        className="wk-button wk-button-secondary wk-button-sm justify-center"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="archive-publishing-item-form"
        disabled={loading || note.trim().length === 0}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-wk-danger px-4 py-2 text-[12px] font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <WkIcon name="Loader2" size={14} className="animate-spin" />
        ) : (
          <WkIcon name="Archive" size={14} />
        )}
        {loading ? "Archiving Item" : "Archive Item"}
      </button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Archive Publishing Item"
      maxWidth="md"
      dismissable={!loading}
      footer={footer}
    >
      <form id="archive-publishing-item-form" onSubmit={handleSubmit}>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-wk-danger-soft text-wk-danger">
            <WkIcon name="Archive" size={16} />
          </div>
          <p className="text-[12px] leading-5 text-wk-text-muted">
            Archive "{itemTitle}"? It will leave the Active workspace but remain available through the Archived planning-state filter.
          </p>
        </div>

        <label className="mt-5 block">
          <span className="text-[12px] font-bold text-wk-text">Archive Note</span>
          <textarea
            autoFocus
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setNoteError(null);
            }}
            disabled={loading}
            rows={4}
            placeholder="Record why this work is being archived"
            className="mt-2 w-full resize-y rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[13px] leading-5 text-wk-text outline-none placeholder:text-wk-text-faint focus:border-wk-brand disabled:opacity-60"
          />
        </label>

        {noteError || error ? (
          <div className="mt-3 rounded-xl border border-wk-danger/30 bg-wk-danger-soft p-3">
            <p className="text-[12px] leading-5 text-wk-danger">{noteError || error}</p>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
