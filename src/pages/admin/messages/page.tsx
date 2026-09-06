import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import {
  getMessagesControlCenterStatus,
  type MessagesControlCenterStatus,
} from "@/services/messages";

export default function AdminMessagesPage() {
  const [status, setStatus] = useState<MessagesControlCenterStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMessagesControlCenterStatus()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Messages Control Center could not be loaded.");
      });
    return () => { cancelled = true; };
  }, []);

  const cards = status ? [
    ["Active conversations", status.active_conversations, "MessageSquare"],
    ["Messages", status.messages, "Mail"],
    ["Pending requests", status.pending_requests, "CirclePlus"],
    ["Spam placements", status.spam_conversations, "ShieldAlert"],
    ["Human participants", status.active_human_participants, "Users"],
  ] as const : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[var(--wk-divider)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black tracking-[0.18em] text-[var(--wk-brand)]">Super Admin only</div>
          <h1 className="mt-1 text-[26px] font-black tracking-[-0.03em] text-[var(--wk-text)]">Messages</h1>
          <p className="mt-1 max-w-[660px] text-[12px] leading-relaxed text-[var(--wk-text-muted)]">
            Operate Messages without turning broad administrative access into ambient private-content access.
          </p>
        </div>
        <Link to="/messages" className="wk-button wk-button-sm wk-button-primary">
          <WkIcon name="MessageSquare" size={15} /> Open your Inbox
        </Link>
      </header>

      {error && (
        <div className="rounded-xl border border-[var(--wk-danger)]/30 bg-[var(--wk-danger)]/10 px-4 py-3 text-[12px] font-bold text-[var(--wk-danger)]">{error}</div>
      )}

      {!status && !error ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-busy="true">
          {[0,1,2,3,4].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-[var(--wk-surface-raised)]" />)}
        </div>
      ) : status ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {cards.map(([label, value, icon]) => (
              <div key={label} className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black tracking-[0.12em] text-[var(--wk-text-faint)]">{label}</span>
                  <WkIcon name={icon as any} size={15} />
                </div>
                <div className="mt-3 text-[25px] font-black tracking-[-0.03em] text-[var(--wk-text)]">{value.toLocaleString()}</div>
              </div>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black tracking-[0.14em] text-[var(--wk-text-faint)]">Runtime audience</div>
                  <div className="mt-1 text-[18px] font-black capitalize text-[var(--wk-text)]">{status.audience_mode}</div>
                </div>
                <span className="rounded-full bg-[var(--wk-brand-soft)] px-3 py-1.5 text-[10px] font-black tracking-[0.12em] text-[var(--wk-brand)]">revision {status.policy_revision}</span>
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-[var(--wk-text-muted)]">
                Audience mode remains a server-side gate. User privacy settings can narrow delivery further but cannot widen the platform audience.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
              <div className="text-[12px] font-black text-[var(--wk-text)]">Private-content boundary</div>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--wk-text-muted)]">
                This surface intentionally exposes operational aggregates only. Conversation content remains participant-scoped unless a later governed Safety or Legal authority explicitly permits access.
              </p>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
