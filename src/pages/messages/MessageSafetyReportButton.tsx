import { useState } from "react";
import { Modal } from "@/components/design-system/primitives/Modal";
import { reportMessageSafety } from "@/services/messages";

const REPORT_REASONS = [
  ["spam", "Spam"],
  ["harassment", "Harassment"],
  ["hate_or_abuse", "Hate / Abuse"],
  ["misinformation", "Misinformation"],
  ["privacy", "Privacy"],
  ["copyright", "Copyright"],
  ["off_topic", "Off Topic"],
  ["other", "Other"],
] as const;

export function MessageSafetyReportButton({
  messageId,
}: {
  messageId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("harassment");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy || reported) return;
    setBusy(true);
    setError(null);
    try {
      await reportMessageSafety(messageId, reason, note.trim() || null);
      setReported(true);
      setOpen(false);
      setNote("");
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "This Message could not be reported.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={reported}
        onClick={() => setOpen(true)}
        className="text-[9px] font-bold text-[var(--wk-text-faint)] hover:text-[var(--wk-text-muted)] disabled:cursor-default disabled:opacity-60"
      >
        {reported ? "Reported" : "Report"}
      </button>

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Report Message"
        maxWidth="md"
      >
        <p className="text-[11px] leading-relaxed text-[var(--wk-text-muted)]">
          Reports create a Safety Case for review. A report does not automatically punish the sender.
        </p>

        <div className="mt-4">
          <label className="text-[10px] font-black text-[var(--wk-text)]" htmlFor={`message-report-reason-${messageId}`}>
            Reason
          </label>
          <select
            id={`message-report-reason-${messageId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 text-[16px] font-bold text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)] sm:text-[12px]"
          >
            {REPORT_REASONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4">
          <label className="text-[10px] font-black text-[var(--wk-text)]" htmlFor={`message-report-note-${messageId}`}>
            Note
          </label>
          <textarea
            id={`message-report-note-${messageId}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Add context for the reviewer"
            className="mt-2 w-full resize-none rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3 text-[16px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)] sm:text-[12px]"
          />
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-[var(--wk-danger)]/30 bg-[var(--wk-danger)]/10 px-3 py-2 text-[10px] font-bold text-[var(--wk-danger)]">
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setOpen(false)}
            className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
          >
            {busy ? "Reporting..." : "Report Message"}
          </button>
        </div>
      </Modal>
    </>
  );
}
