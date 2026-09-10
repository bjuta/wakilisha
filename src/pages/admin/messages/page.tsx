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
import {
  MessagesOperationsShell,
  type MessagesOperationsWorkspace,
} from "./MessagesOperationsShell";

function when(value: string | null): string {
  if (!value) return "No Messages yet";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Now";
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function LoadingGrid() {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      aria-busy="true"
      aria-label="Loading Messages Operations"
    >
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div
          key={item}
          className="h-24 animate-pulse rounded-xl bg-wk-surface-raised"
        />
      ))}
    </div>
  );
}

export default function AdminMessagesPage() {
  const [status, setStatus] = useState<MessagesControlCenterStatus | null>(null);
  const [actors, setActors] = useState<MessagesSystemActor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [changingActor, setChangingActor] = useState<string | null>(null);
  const [workspace, setWorkspace] =
    useState<MessagesOperationsWorkspace>("overview");

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
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Messages Operations could not be loaded.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleActorToggle = async (actor: MessagesSystemActor) => {
    if (changingActor) return;
    setChangingActor(actor.actor_key);
    setError(null);

    try {
      await setMessagesSystemActorEnabled(actor, !actor.messaging_enabled);
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "System Actor Messages control could not be updated.",
      );
    } finally {
      setChangingActor(null);
    }
  };

  const cards = status
    ? ([
        ["Active conversations", status.active_conversations, "MessageSquare"],
        ["Messages", status.messages, "Mail"],
        ["Pending requests", status.pending_requests, "CirclePlus"],
        ["Spam placements", status.spam_conversations, "ShieldAlert"],
        ["Human participants", status.active_human_participants, "Users"],
        ["Messaging agents", status.messages_enabled_system_actors, "MessageSquare"],
      ] as const)
    : [];

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b border-wk-divider pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-wk-brand">
            Super Admin only
          </div>
          <h1 className="mt-1 text-[26px] font-black tracking-[-0.03em] text-wk-text">
            Messages Operations
          </h1>
          <p className="mt-1 max-w-[720px] text-[12px] leading-relaxed text-wk-text-muted">
            Operate Conversations, Safety, Legal, accountable actors, and runtime
            controls without turning administrative access into ambient private-content access.
          </p>
        </div>
        <Link
          to="/messages"
          className="wk-button wk-button-sm wk-button-primary"
        >
          <WkIcon name="MessageSquare" size={15} /> Open your Inbox
        </Link>
      </header>

      {error ? (
        <div className="rounded-xl border border-wk-danger/30 bg-wk-danger/10 px-4 py-3 text-[12px] font-bold text-wk-danger">
          {error}
        </div>
      ) : null}

      <MessagesOperationsShell active={workspace} onChange={setWorkspace}>
        {workspace === "overview" ? (
          status ? (
            <div className="space-y-5">
              <section
                aria-label="Messages operational health"
                className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
              >
                {cards.map(([label, value, icon]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-wk-border bg-wk-surface px-4 py-3.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-black uppercase tracking-[0.1em] text-wk-text-faint">
                        {label}
                      </span>
                      <WkIcon name={icon as any} size={15} />
                    </div>
                    <div className="mt-2 text-[24px] font-black tracking-[-0.03em] text-wk-text">
                      {value.toLocaleString()}
                    </div>
                  </div>
                ))}
              </section>

              <section className="grid gap-3 lg:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setWorkspace("safety")}
                  className="rounded-xl border border-wk-border bg-wk-bg-subtle px-4 py-4 text-left transition-colors hover:bg-wk-surface-raised focus:outline-none focus:ring-2 focus:ring-wk-brand/15"
                >
                  <span className="text-[11px] font-black text-wk-text">Safety queue</span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-wk-text-muted">
                    Review quarantine, evidence, enforcement, and recovery work.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspace("legal")}
                  className="rounded-xl border border-wk-border bg-wk-bg-subtle px-4 py-4 text-left transition-colors hover:bg-wk-surface-raised focus:outline-none focus:ring-2 focus:ring-wk-brand/15"
                >
                  <span className="text-[11px] font-black text-wk-text">Legal casework</span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-wk-text-muted">
                    Work governed preservation and exact disclosure cases.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspace("controls")}
                  className="rounded-xl border border-wk-border bg-wk-bg-subtle px-4 py-4 text-left transition-colors hover:bg-wk-surface-raised focus:outline-none focus:ring-2 focus:ring-wk-brand/15"
                >
                  <span className="text-[11px] font-black text-wk-text">Platform controls</span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-wk-text-muted">
                    Review audience and private-content authority deliberately.
                  </span>
                </button>
              </section>
            </div>
          ) : (
            <LoadingGrid />
          )
        ) : null}

        {workspace === "conversations" ? (
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border border-wk-border bg-wk-surface p-5">
              <div className="text-[12px] font-black text-wk-text">
                Conversation operations
              </div>
              <p className="mt-2 max-w-[680px] text-[11px] leading-relaxed text-wk-text-muted">
                Mailbox routing, requests, spam placement, delivery state, and
                authorized intervention belong here. Gate A establishes the
                workspace without inventing a second Conversation authority.
              </p>
              <Link
                to="/messages"
                className="wk-button wk-button-sm wk-button-primary mt-4"
              >
                <WkIcon name="MessageSquare" size={14} /> Open Inbox
              </Link>
            </div>
            <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                Authority
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-wk-text-muted">
                Canonical Conversation, Message, participant, mailbox, delivery,
                and user messaging-preference authority remains unchanged.
              </p>
            </div>
          </div>
        ) : null}

        {workspace === "safety" ? <MessagesSafetyPanel /> : null}

        {workspace === "legal" ? <MessagesLegalPanel /> : null}

        {workspace === "agents" ? (
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border border-wk-border bg-wk-surface p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                Agent Reviews &amp; Updates
              </div>
              <h3 className="mt-1 text-[17px] font-black tracking-[-0.02em] text-wk-text">
                Human review belongs in an operational queue
              </h3>
              <p className="mt-2 max-w-[680px] text-[11px] leading-relaxed text-wk-text-muted">
                This workspace is reserved for agent-originated proposals,
                escalations, failures, and actions requiring accountable human review.
                Gate A adds no parallel agent authority or fake queue data.
              </p>
            </div>
            <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-5">
              <div className="text-[11px] font-black text-wk-text">Gate boundary</div>
              <p className="mt-2 text-[11px] leading-relaxed text-wk-text-muted">
                Existing agent/job/accountability sources will be composed here
                only after their exact read authority is audited.
              </p>
            </div>
          </div>
        ) : null}

        {workspace === "system-actors" ? (
          status ? (
            <section aria-labelledby="messages-system-actors-heading">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
                    Accountable actors
                  </div>
                  <h3
                    id="messages-system-actors-heading"
                    className="mt-1 text-[17px] font-black tracking-[-0.02em] text-wk-text"
                  >
                    System Actors in Messages
                  </h3>
                  <p className="mt-1 max-w-[720px] text-[11px] leading-relaxed text-wk-text-muted">
                    Control whether an accountable System Actor may use Messages.
                    This does not grant or remove the actor&apos;s separate domain authority.
                  </p>
                </div>
                <div className="text-[10px] font-black text-wk-text-faint">
                  {status.registered_system_actors.toLocaleString()} registered
                </div>
              </div>

              <div className="mt-4 divide-y divide-wk-divider overflow-hidden rounded-xl border border-wk-border">
                {actors.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[11px] font-bold text-wk-text-muted">
                    No registered System Actors.
                  </div>
                ) : (
                  actors.map((actor) => (
                    <div
                      key={actor.actor_key}
                      className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-black text-wk-text">
                            {actor.label}
                          </span>
                          <span className="rounded-full bg-wk-surface-raised px-2 py-1 text-[9px] font-black tracking-[0.08em] text-wk-text-muted">
                            {actor.actor_key}
                          </span>
                          <span
                            className={`rounded-full px-2 py-1 text-[9px] font-black tracking-[0.08em] ${
                              actor.messaging_enabled
                                ? "bg-wk-brand-soft text-wk-brand"
                                : "bg-wk-surface-raised text-wk-text-faint"
                            }`}
                          >
                            {actor.messaging_enabled ? "MESSAGES ON" : "MESSAGES OFF"}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold text-wk-text-faint">
                          <span>
                            Purpose: {actor.permitted_purposes.join(", ") || "none"}
                          </span>
                          <span>
                            Recipients: {actor.recipient_scope.replaceAll("_", " ")}
                          </span>
                          <span>
                            Replies: {actor.allow_human_reply ? "allowed" : "blocked"}
                          </span>
                          <span>Last Message: {when(actor.latest_message_at)}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleActorToggle(actor)}
                        disabled={changingActor === actor.actor_key}
                        className={`wk-button wk-button-sm ${
                          actor.messaging_enabled
                            ? "wk-button-ghost"
                            : "wk-button-primary"
                        } disabled:opacity-50`}
                      >
                        {changingActor === actor.actor_key
                          ? "Updating..."
                          : actor.messaging_enabled
                            ? "Disable Messages"
                            : "Enable Messages"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : (
            <LoadingGrid />
          )
        ) : null}

        {workspace === "controls" ? (
          status ? (
            <div className="space-y-4">
              <section className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-wk-border bg-wk-surface p-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
                    Runtime audience
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <div className="text-[18px] font-black capitalize text-wk-text">
                      {status.audience_mode}
                    </div>
                    <span className="rounded-full bg-wk-brand-soft px-3 py-1.5 text-[9px] font-black tracking-[0.1em] text-wk-brand">
                      revision {status.policy_revision}
                    </span>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-wk-text-muted">
                    Audience mode is server-enforced. User privacy can narrow
                    delivery further but cannot widen the platform audience.
                  </p>
                </div>

                <div className="rounded-xl border border-wk-border bg-wk-surface p-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
                    Private-content boundary
                  </div>
                  <div className="mt-1 text-[16px] font-black text-wk-text">
                    Deliberate inspection only
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-wk-text-muted">
                    Conversation content remains participant-scoped unless
                    governed Safety or Legal authority permits deliberate,
                    purpose-audited inspection.
                  </p>
                </div>
              </section>

              <section className="rounded-xl border border-wk-border bg-wk-bg-subtle p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
                  Super Administration
                </div>
                <h3 className="mt-1 text-[15px] font-black text-wk-text">
                  Privileged controls stay visibly separate
                </h3>
                <p className="mt-2 max-w-[760px] text-[11px] leading-relaxed text-wk-text-muted">
                  Gate A establishes the control area but adds no new privileged
                  mutation. Platform-wide commands will enter this surface only
                  with explicit authority, confirmation, and audit treatment.
                </p>
              </section>
            </div>
          ) : (
            <LoadingGrid />
          )
        ) : null}
      </MessagesOperationsShell>
    </div>
  );
}
