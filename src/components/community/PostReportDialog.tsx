import {
  useEffect,
  useState,
} from "react";
import { Portal } from "@/components/base/Portal";
import type { ReportReason } from "@/services/community";

const REPORT_REASONS: {
  value: ReportReason;
  label: string;
  icon: string;
}[] = [
  { value: "spam", label: "Spam", icon: "ri-spam-line" },
  { value: "harassment", label: "Harassment", icon: "ri-alert-line" },
  { value: "hate_or_abuse", label: "Hate or Abuse", icon: "ri-forbid-line" },
  { value: "misinformation", label: "Misinformation", icon: "ri-error-warning-line" },
  { value: "privacy", label: "Privacy Violation", icon: "ri-shield-keyhole-line" },
  { value: "copyright", label: "Copyright Issue", icon: "ri-copyright-line" },
  { value: "off_topic", label: "Off Topic", icon: "ri-chat-off-line" },
  { value: "other", label: "Other", icon: "ri-more-line" },
];

export function PostReportDialog({
  open,
  postAuthorName,
  reporting,
  onClose,
  onReport,
}: {
  open: boolean;
  postAuthorName: string;
  reporting: boolean;
  onClose: () => void;
  onReport: (reason: ReportReason) => Promise<void> | void;
}) {
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) {
      setSubmitted(false);
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Report Post from ${postAuthorName}`}
        className="fixed inset-0 z-[165] flex items-end justify-center bg-black/45 sm:items-center sm:p-6"
        onMouseDown={onClose}
      >
        <div
          className="w-full rounded-t-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-2xl sm:max-w-[520px] sm:rounded-3xl"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-[var(--wk-divider)] px-5 py-4">
            <div>
              <h3 className="text-[15px] font-black text-[var(--wk-text)]">Report Post</h3>
              <p className="mt-0.5 text-[11px] font-semibold text-[var(--wk-text-muted)]">
                Tell us what needs review.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Report"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-bg)]"
            >
              <i className="ri-close-line text-[18px]" aria-hidden="true" />
            </button>
          </div>

          {submitted ? (
            <div className="px-5 py-10 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                <i className="ri-check-line text-[20px]" aria-hidden="true" />
              </div>
              <div className="mt-3 text-[14px] font-black text-[var(--wk-text)]">
                Report submitted
              </div>
              <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">
                Thanks for helping us review this Post.
              </p>
            </div>
          ) : (
            <div className="max-h-[70dvh] overflow-y-auto p-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:max-h-[560px] sm:p-4">
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason.value}
                  type="button"
                  disabled={reporting}
                  onClick={() => {
                    void Promise.resolve(onReport(reason.value)).then(() => {
                      setSubmitted(true);
                    });
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-[var(--wk-bg)] disabled:opacity-50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--wk-bg)] text-[var(--wk-text-muted)]">
                    <i className={`${reason.icon} text-[17px]`} aria-hidden="true" />
                  </span>
                  <span className="text-[13px] font-bold text-[var(--wk-text)]">
                    {reason.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
