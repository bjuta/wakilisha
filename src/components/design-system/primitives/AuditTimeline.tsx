import { useState, type ReactNode } from "react";

export interface WkAuditTimelineEvent {
  id: string;
  label: string;
  actor?: string | null;
  occurredAt?: string | null;
  description?: string | null;
  detail?: ReactNode;
}

interface WkAuditTimelineProps {
  events: WkAuditTimelineEvent[];
  emptyLabel?: string;
  ariaLabel?: string;
}

function formatWhen(value: string | null | undefined) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function WkAuditTimeline({
  events,
  emptyLabel = "No recorded activity yet.",
  ariaLabel = "Activity history",
}: WkAuditTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-wk-border px-4 py-6 text-center text-[11px] font-semibold text-wk-text-muted">
        {emptyLabel}
      </div>
    );
  }

  return (
    <ol aria-label={ariaLabel} className="space-y-2">
      {events.map((event) => {
        const expanded = expandedId === event.id;
        return (
          <li
            key={event.id}
            className="rounded-xl border border-wk-border bg-wk-surface px-3.5 py-3"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-wk-brand"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-[11px] font-black text-wk-text">
                    {event.label}
                  </span>
                  <span className="text-[9px] font-bold text-wk-text-faint">
                    {formatWhen(event.occurredAt)}
                  </span>
                </div>

                {event.actor ? (
                  <div className="mt-0.5 text-[9px] font-bold text-wk-text-muted">
                    {event.actor}
                  </div>
                ) : null}

                {event.description ? (
                  <p className="mt-1.5 text-[10px] leading-relaxed text-wk-text-muted">
                    {event.description}
                  </p>
                ) : null}

                {event.detail ? (
                  <>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() =>
                        setExpandedId((current) =>
                          current === event.id ? null : event.id,
                        )
                      }
                      className="mt-2 text-[9px] font-black text-wk-brand hover:underline focus:outline-none focus:ring-2 focus:ring-wk-brand/15"
                    >
                      {expanded ? "Hide detail" : "View detail"}
                    </button>
                    {expanded ? (
                      <div className="mt-2 rounded-lg bg-wk-bg-subtle p-3 text-[10px] text-wk-text-muted">
                        {event.detail}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
