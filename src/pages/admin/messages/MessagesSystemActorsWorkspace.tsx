import { useEffect, useMemo, useState } from "react";
import { WakilishaToggle } from "@/components/design-system/primitives/WakilishaToggle";
import { WkStateBadge } from "@/components/design-system/primitives/StateBadge";
import type {
  MessagesControlCenterStatus,
  MessagesSystemActor,
} from "@/services/messages";

interface MessagesSystemActorsWorkspaceProps {
  status: MessagesControlCenterStatus;
  actors: MessagesSystemActor[];
  changingActor: string | null;
  onToggle: (actor: MessagesSystemActor) => void | Promise<void>;
}

function when(value: string | null): string {
  if (!value) return "No Messages yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

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

export function MessagesSystemActorsWorkspace({
  status,
  actors,
  changingActor,
  onToggle,
}: MessagesSystemActorsWorkspaceProps) {
  const [selectedActorKey, setSelectedActorKey] = useState<string | null>(
    actors[0]?.actor_key ?? null,
  );

  useEffect(() => {
    if (
      selectedActorKey &&
      actors.some((actor) => actor.actor_key === selectedActorKey)
    ) {
      return;
    }
    setSelectedActorKey(actors[0]?.actor_key ?? null);
  }, [actors, selectedActorKey]);

  const selectedActor = useMemo(
    () =>
      actors.find((actor) => actor.actor_key === selectedActorKey) ??
      actors[0] ??
      null,
    [actors, selectedActorKey],
  );

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
            Accountable machine actors
          </div>
          <h3 className="mt-1 text-[17px] font-black tracking-[-0.02em] text-wk-text">
            System Actors
          </h3>
          <p className="mt-1 max-w-[760px] text-[11px] leading-relaxed text-wk-text-muted">
            Inspect actor purpose and Messages policy together. Messaging
            participation never silently changes the actor&apos;s separate domain authority.
          </p>
        </div>
        <WkStateBadge tone="info">
          {status.registered_system_actors.toLocaleString()} registered
        </WkStateBadge>
      </div>

      {actors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-wk-border px-5 py-8 text-center text-[11px] font-semibold text-wk-text-muted">
          No registered System Actors.
        </div>
      ) : (
        <div className="grid min-h-[420px] overflow-hidden rounded-xl border border-wk-border lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
          <div className="border-b border-wk-divider bg-wk-bg-subtle p-2 lg:border-b-0 lg:border-r">
            <div className="px-2 pb-2 pt-1 text-[9px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
              Actor roster
            </div>
            <div className="space-y-1">
              {actors.map((actor) => {
                const selected = actor.actor_key === selectedActor?.actor_key;
                return (
                  <button
                    key={actor.actor_key}
                    type="button"
                    onClick={() => setSelectedActorKey(actor.actor_key)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-wk-brand/15 ${
                      selected
                        ? "bg-wk-surface text-wk-text shadow-sm"
                        : "text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-black">
                        {actor.label}
                      </span>
                      <span className="mt-0.5 block truncate text-[9px] font-bold text-wk-text-faint">
                        {actor.actor_key}
                      </span>
                    </span>
                    <span
                      aria-label={
                        actor.messaging_enabled
                          ? "Messages enabled"
                          : "Messages disabled"
                      }
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        actor.messaging_enabled
                          ? "bg-wk-brand"
                          : "bg-wk-border-2"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {selectedActor ? (
            <div className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-[18px] font-black tracking-[-0.02em] text-wk-text">
                      {selectedActor.label}
                    </h4>
                    <WkStateBadge
                      tone={selectedActor.messaging_enabled ? "success" : "neutral"}
                    >
                      {selectedActor.messaging_enabled
                        ? "Messages on"
                        : "Messages off"}
                    </WkStateBadge>
                  </div>
                  <div className="mt-1 text-[10px] font-bold text-wk-text-faint">
                    {selectedActor.actor_key}
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-wk-border bg-wk-bg-subtle px-3.5 py-3">
                  <div>
                    <div className="text-[10px] font-black text-wk-text">
                      Messages participation
                    </div>
                    <div className="mt-0.5 text-[9px] text-wk-text-muted">
                      Domain authority is unchanged
                    </div>
                  </div>
                  <WakilishaToggle
                    value={selectedActor.messaging_enabled}
                    onChange={() => void onToggle(selectedActor)}
                    disabled={changingActor === selectedActor.actor_key}
                    size="sm"
                    ariaLabel={`${
                      selectedActor.messaging_enabled ? "Disable" : "Enable"
                    } Messages for ${selectedActor.label}`}
                  />
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-wk-border bg-wk-surface p-4">
                  <div className="text-[9px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                    Permitted purposes
                  </div>
                  <div className="mt-2 text-[11px] font-bold leading-relaxed text-wk-text">
                    {selectedActor.permitted_purposes.join(", ") || "None"}
                  </div>
                </div>
                <div className="rounded-xl border border-wk-border bg-wk-surface p-4">
                  <div className="text-[9px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                    Recipient scope
                  </div>
                  <div className="mt-2 text-[11px] font-bold capitalize text-wk-text">
                    {selectedActor.recipient_scope.replaceAll("_", " ")}
                  </div>
                </div>
                <div className="rounded-xl border border-wk-border bg-wk-surface p-4">
                  <div className="text-[9px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                    Human reply policy
                  </div>
                  <div className="mt-2 text-[11px] font-bold text-wk-text">
                    {selectedActor.allow_human_reply
                      ? "Human replies allowed"
                      : "Human replies blocked"}
                  </div>
                </div>
                <div className="rounded-xl border border-wk-border bg-wk-surface p-4">
                  <div className="text-[9px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                    Latest Messages activity
                  </div>
                  <div className="mt-2 text-[11px] font-bold text-wk-text">
                    {when(selectedActor.latest_message_at)}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
                <div className="text-[10px] font-black text-wk-text">
                  Authority boundary
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-wk-text-muted">
                  This control changes only the actor&apos;s existing Messages
                  participation state. It does not grant or revoke unrelated Registry,
                  Editorial, Media, Chart, or other domain capabilities.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
