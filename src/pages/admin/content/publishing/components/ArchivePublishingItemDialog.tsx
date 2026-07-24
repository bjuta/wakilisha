import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { WkIcon } from "@/components/design-system/Icon";

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
  const [noteError, setNoteError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setNote("");
      setNoteError(null);
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [loading, onCancel, open]);

  if (!open) return null;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const cleanNote = note.trim();

    if (cleanNote.length === 0) {
      setNoteError(
        "Record why this work is being archived.",
      );
      return;
    }

    setNoteError(null);
    await onConfirm(cleanNote);
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex h-[100dvh] max-h-[100dvh] items-end justify-center overflow-hidden p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:items-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="archive-publishing-title"
    >
      <button
        type="button"
        aria-label="Close Archive Publishing Item"
        onClick={onCancel}
        disabled={loading}
        className="absolute inset-0 cursor-default bg-black/55 disabled:cursor-wait"
      />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-wk-border bg-wk-surface p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-wk-danger-soft text-wk-danger">
            <WkIcon name="Archive" size={16} />
          </div>

          <div>
            <h3
              id="archive-publishing-title"
              className="text-[16px] font-black text-wk-text"
            >
              Archive Publishing Item
            </h3>
            <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
              Archive “{itemTitle}”? It will leave the Active workspace but remain available through the Archived planning-state filter.
            </p>
          </div>
        </div>

        <label className="mt-5 block">
          <span className="text-[12px] font-bold text-wk-text">
            Archive Note
          </span>
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
            <p className="text-[12px] leading-5 text-wk-danger">
              {noteError || error}
            </p>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
            disabled={
              loading ||
              note.trim().length === 0
            }
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-wk-danger px-4 py-2 text-[12px] font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <WkIcon
                name="Loader2"
                size={14}
                className="animate-spin"
              />
            ) : (
              <WkIcon name="Archive" size={14} />
            )}
            {loading
              ? "Archiving Item"
              : "Archive Item"}
          </button>
        </div>
      </form>
    </div>
  );
}
