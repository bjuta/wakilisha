import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getMyMessageSafetyState,
  submitMessagesSafetyAppeal,
  type MyMessageSafetyState,
  type MyMessageSafetyStateEnforcement,
} from "@/services/messages";

function labelKind(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatUntil(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusCopy(enforcement: MyMessageSafetyStateEnforcement): string {
  if (enforcement.appeal?.status === "resolved") {
    const resolution = enforcement.appeal.resolution
      ? labelKind(enforcement.appeal.resolution)
      : "Resolved";
    return `Appeal ${resolution.toLowerCase()}`;
  }
  if (enforcement.appeal?.status === "under_review") return "Appeal under review";
  if (enforcement.appeal?.status === "open") return "Appeal submitted";
  if (!enforcement.is_effective) return "No longer active";
  return "Active";
}

export function MessageSafetyState() {
  const [state, setState] = useState<MyMessageSafetyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appealFor, setAppealFor] = useState<string | null>(null);
  const [appealReason, setAppealReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await getMyMessageSafetyState();
      setState(next);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Messages Safety state could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const effective = useMemo(
    () => state?.enforcements.filter((item) => item.is_effective) ?? [],
    [state],
  );

  async function submitAppeal(enforcementId: string) {
    const reason = appealReason.trim();
    if (!reason || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitMessagesSafetyAppeal(enforcementId, reason);
      setAppealFor(null);
      setAppealReason("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Appeal could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !state?.has_safety_state) return null;

  return (
    <section
      className="mb-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4"
      aria-labelledby="my-message-safety-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] font-black tracking-[0.14em] text-[var(--wk-brand)]">Account Safety</div>
          <h2 id="my-message-safety-heading" className="mt-1 text-[15px] font-black text-[var(--wk-text)]">
            Messages access
          </h2>
          <p className="mt-1 max-w-[720px] text-[11px] leading-relaxed text-[var(--wk-text-muted)]">
            Active Messages restrictions and appeal status are shown here without exposing internal Safety review notes.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[9px] font-black uppercase tracking-[0.08em]">
          <span className={`rounded-full px-2.5 py-1 ${state.can_send ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" : "bg-[var(--wk-danger)]/10 text-[var(--wk-danger)]"}`}>
            Send {state.can_send ? "available" : "restricted"}
          </span>
          <span className={`rounded-full px-2.5 py-1 ${state.can_start ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" : "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"}`}>
            New conversations {state.can_start ? "available" : "restricted"}
          </span>
        </div>
      </div>

      {state.next_send_at && !state.can_send && (
        <div className="mt-3 rounded-xl bg-[var(--wk-surface-raised)] px-3 py-2 text-[10px] font-bold text-[var(--wk-text-muted)]">
          Next send time: {formatUntil(state.next_send_at) ?? "pending"}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-xl border border-[var(--wk-danger)]/30 bg-[var(--wk-danger)]/10 px-3 py-2 text-[10px] font-bold text-[var(--wk-danger)]">
          {error}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {state.enforcements.map((enforcement) => {
          const appealable = enforcement.is_effective
            && enforcement.appeal_allowed
            && !enforcement.appeal;
          const until = formatUntil(enforcement.effective_until);
          return (
            <article key={enforcement.enforcement_id} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-[11px] font-black text-[var(--wk-text)]">{labelKind(enforcement.enforcement_kind)}</div>
                  <p className="mt-1 text-[10px] leading-relaxed text-[var(--wk-text-muted)]">{enforcement.public_reason}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-bold text-[var(--wk-text-faint)]">
                    <span>{statusCopy(enforcement)}</span>
                    {until && <span>Until {until}</span>}
                    {!state.links_allowed && enforcement.enforcement_kind === "links_restricted" && <span>Links unavailable</span>}
                    {!state.media_allowed && enforcement.enforcement_kind === "media_restricted" && <span>Media unavailable</span>}
                  </div>
                </div>
                {appealable && (
                  <button
                    type="button"
                    onClick={() => {
                      setAppealFor(enforcement.enforcement_id);
                      setAppealReason("");
                    }}
                    className="wk-button wk-button-sm wk-button-ghost shrink-0"
                  >
                    Appeal
                  </button>
                )}
              </div>

              {enforcement.appeal?.resolution_public_note && (
                <div className="mt-3 rounded-lg bg-[var(--wk-surface-raised)] px-3 py-2 text-[10px] leading-relaxed text-[var(--wk-text-muted)]">
                  {enforcement.appeal.resolution_public_note}
                </div>
              )}

              {appealFor === enforcement.enforcement_id && (
                <div className="mt-3 border-t border-[var(--wk-divider)] pt-3">
                  <label className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--wk-text-faint)]" htmlFor={`appeal-${enforcement.enforcement_id}`}>
                    Why should this restriction be reviewed?
                  </label>
                  <textarea
                    id={`appeal-${enforcement.enforcement_id}`}
                    value={appealReason}
                    onChange={(event) => setAppealReason(event.target.value)}
                    maxLength={4000}
                    rows={4}
                    className="mt-2 w-full resize-y rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2 text-[11px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAppealFor(null);
                        setAppealReason("");
                      }}
                      className="wk-button wk-button-sm wk-button-ghost"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!appealReason.trim() || submitting}
                      onClick={() => void submitAppeal(enforcement.enforcement_id)}
                      className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
                    >
                      {submitting ? "Submitting..." : "Submit Appeal"}
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {effective.length === 0 && (
        <p className="mt-3 text-[10px] font-bold text-[var(--wk-text-muted)]">
          No Messages restriction is currently effective. Appeal history remains available above where applicable.
        </p>
      )}
    </section>
  );
}
