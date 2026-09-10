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
import { MessagesAgentsWorkspace } from "./MessagesAgentsWorkspace";
import { MessagesControlsWorkspace } from "./MessagesControlsWorkspace";
import { MessagesSystemActorsWorkspace } from "./MessagesSystemActorsWorkspace";
import {
  MessagesOperationsShell,
  type MessagesOperationsWorkspace,
} from "./MessagesOperationsShell";

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
            Operate Conversations, Safety, Legal, accountable actors, and
            runtime controls without turning administrative access into ambient
            private-content access.
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
                  <span className="text-[11px] font-black text-wk-text">
                    Safety queue
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-wk-text-muted">
                    Review quarantine, evidence, enforcement, and recovery work.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setWorkspace("legal")}
                  className="rounded-xl border border-wk-border bg-wk-bg-subtle px-4 py-4 text-left transition-colors hover:bg-wk-surface-raised focus:outline-none focus:ring-2 focus:ring-wk-brand/15"
                >
                  <span className="text-[11px] font-black text-wk-text">
                    Legal casework
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-wk-text-muted">
                    Work governed preservation and exact disclosure cases.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setWorkspace("agents")}
                  className="rounded-xl border border-wk-border bg-wk-bg-subtle px-4 py-4 text-left transition-colors hover:bg-wk-surface-raised focus:outline-none focus:ring-2 focus:ring-wk-brand/15"
                >
                  <span className="text-[11px] font-black text-wk-text">
                    Agent reviews
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-wk-text-muted">
                    Keep agent-originated review work separate from actor identity.
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
                authorized intervention belong here without creating another
                Conversation authority.
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
                Canonical Conversation, Message, participant, mailbox,
                delivery, and user messaging-preference authority remains unchanged.
              </p>
            </div>
          </div>
        ) : null}

        {workspace === "safety" ? <MessagesSafetyPanel /> : null}

        {workspace === "legal" ? <MessagesLegalPanel /> : null}

        {workspace === "agents" ? <MessagesAgentsWorkspace /> : null}

        {workspace === "system-actors" ? (
          status ? (
            <MessagesSystemActorsWorkspace
              status={status}
              actors={actors}
              changingActor={changingActor}
              onToggle={handleActorToggle}
            />
          ) : (
            <LoadingGrid />
          )
        ) : null}

        {workspace === "controls" ? (
          status ? (
            <MessagesControlsWorkspace status={status} />
          ) : (
            <LoadingGrid />
          )
        ) : null}
      </MessagesOperationsShell>
    </div>
  );
}
