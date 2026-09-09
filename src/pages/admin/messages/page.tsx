import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import {
  getMessagesControlCenterStatus,
  getMessagesSystemActors,
  setMessagesSystemActorEnabled,
  type MessagesControlCenterStatus,
  type MessagesSystemActor,
} from "@/services/messages";
import { MessagesSafetyPanel } from "./MessagesSafetyPanel";
import { MessagesLegalPanel } from "./MessagesLegalPanel";

function when(value: string | null): string {
  if (!value) return "No Messages yet";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Now";
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminMessagesPage() {
  const [status, setStatus] = useState<MessagesControlCenterStatus | null>(null);
  const [actors, setActors] = useState<MessagesSystemActor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [changingActor, setChangingActor] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [nextStatus, nextActors] = await Promise.all([
      getMessagesControlCenterStatus(),
      getMessagesSystemActors(),
    ]);
    setStatus(nextStatus);
    setActors(nextActors);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getMessagesControlCenterStatus(),
      getMessagesSystemActors(),
    ])
      .then(([nextStatus, nextActors]) => {
        if (!cancelled) {
          setStatus(nextStatus);
          setActors(nextActors);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Messages Control Center could not be loaded.");
      });
    return () => { cancelled = true; };
  }, []);

  const handleActorToggle = async (actor: MessagesSystemActor) => {
    if (changingActor) return;
    setChangingActor(actor.actor_key);
    setError(null);
    try {
      await setMessagesSystemActorEnabled(actor, !actor.messaging_enabled);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "System Actor Messages control could not be updated.");
    } finally {
      setChangingActor(null);
    }
  };

  const cards = status ? [
    ["Active conversations", status.active_conversations, "MessageSquare"],
    ["Messages", status.messages, "Mail"],
    ["Pending requests", status.pending_requests, "CirclePlus"],
    ["Spam placements", status.spam_conversations, "ShieldAlert"],
    ["Human participants", status.active_human_participants, "Users"],
    ["Messaging agents", status.messages_enabled_system_actors, "MessageSquare"],
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-busy="true">
          {[0,1,2,3,4,5].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-[var(--wk-surface-raised)]" />)}
        </div>
      ) : status ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
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
                This surface intentionally exposes operational aggregates only. Conversation content remains participant-scoped unless governed Safety or Legal authority permits access.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5" aria-labelledby="messages-agents-heading">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[10px] font-black tracking-[0.14em] text-[var(--wk-text-faint)]">Agents</div>
                <h2 id="messages-agents-heading" className="mt-1 text-[18px] font-black tracking-[-0.02em] text-[var(--wk-text)]">System Actors in Messages</h2>
                <p className="mt-1 max-w-[700px] text-[11px] leading-relaxed text-[var(--wk-text-muted)]">
                  Control whether an accountable System Actor may use Messages. This control does not disable the actor's separate domain authority.
                </p>
              </div>
              <div className="text-[10px] font-black text-[var(--wk-text-faint)]">
                {status.registered_system_actors.toLocaleString()} registered
              </div>
            </div>

            <div className="mt-4 divide-y divide-[var(--wk-divider)] rounded-2xl border border-[var(--wk-border)]">
              {actors.length === 0 ? (
                <div className="px-4 py-6 text-center text-[11px] font-bold text-[var(--wk-text-muted)]">No registered System Actors.</div>
              ) : actors.map((actor) => (
                <div key={actor.actor_key} className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-black text-[var(--wk-text)]">{actor.label}</span>
                      <span className="rounded-full bg-[var(--wk-surface-raised)] px-2 py-1 text-[9px] font-black tracking-[0.1em] text-[var(--wk-text-muted)]">{actor.actor_key}</span>
                      <span className={`rounded-full px-2 py-1 text-[9px] font-black tracking-[0.1em] ${actor.messaging_enabled ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" : "bg-[var(--wk-surface-raised)] text-[var(--wk-text-faint)]"}`}>
                        {actor.messaging_enabled ? "MESSAGES ON" : "MESSAGES OFF"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold text-[var(--wk-text-faint)]">
                      <span>Purpose: {actor.permitted_purposes.join(", ") || "none"}</span>
                      <span>Recipients: {actor.recipient_scope.replaceAll("_", " ")}</span>
                      <span>Replies: {actor.allow_human_reply ? "allowed" : "blocked"}</span>
                      <span>Last Message: {when(actor.latest_message_at)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleActorToggle(actor)}
                    disabled={changingActor === actor.actor_key}
                    className={`wk-button wk-button-sm ${actor.messaging_enabled ? "wk-button-ghost" : "wk-button-primary"} disabled:opacity-50`}
                  >
                    {changingActor === actor.actor_key
                      ? "Updating..."
                      : actor.messaging_enabled
                        ? "Disable Messages"
                        : "Enable Messages"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <MessagesSafetyPanel />
      <MessagesLegalPanel />
    </div>
  );
}
