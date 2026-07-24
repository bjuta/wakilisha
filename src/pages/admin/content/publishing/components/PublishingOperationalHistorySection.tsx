import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { WkIcon } from "@/components/design-system/Icon";
import {
  listPublishingOperationalHistory,
  type PublishingOperationalHistoryEvent,
  type PublishingWorkspaceItem,
} from "@/services/publishing/publishingWorkspaceService";

interface PublishingOperationalHistorySectionProps {
  item: PublishingWorkspaceItem;
}

const PAGE_SIZE = 25;

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatChoice(value: string | null): string {
  if (!value) return "Not set";

  return value
    .split("_")
    .map((part) =>
      part.length > 0
        ? `${part[0].toUpperCase()}${part.slice(1)}`
        : part,
    )
    .join(" ");
}

function formatField(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((part) =>
      part.length > 0
        ? `${part[0].toUpperCase()}${part.slice(1)}`
        : part,
    )
    .join(" ");
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Unknown time"
    : DATE_TIME_FORMATTER.format(date);
}

function describeEvent(
  event: PublishingOperationalHistoryEvent,
): string {
  if (event.action === "details_updated") {
    if (event.changedFields.length === 0) {
      return "Details changed.";
    }

    return `Changed ${event.changedFields
      .map(formatField)
      .join(", ")}.`;
  }

  if (
    event.action === "assignee_added" ||
    event.action === "assignee_removed"
  ) {
    const verb =
      event.action === "assignee_added"
        ? "Added"
        : "Removed";

    return `${verb} ${
      event.subjectUserLabel ?? "a team member"
    } as ${formatChoice(event.assignmentRole)}.`;
  }

  if (
    event.action === "channel_added" ||
    event.action === "channel_removed"
  ) {
    const verb =
      event.action === "channel_added"
        ? "Added"
        : "Removed";

    return `${verb} ${
      event.channelLabel ?? event.channelKey ?? "a channel"
    }.`;
  }

  if (event.action === "channel_primary_changed") {
    return `Primary channel changed from ${
      event.previousPrimaryChannelLabel ??
      event.previousPrimaryChannelKey ??
      "none"
    } to ${
      event.channelLabel ??
      event.channelKey ??
      "another channel"
    }.`;
  }

  if (event.action === "resource_linked") {
    return "Linked a canonical resource.";
  }

  return formatChoice(event.action);
}

function eventTone(action: string): string {
  if (
    action === "assignee_removed" ||
    action === "channel_removed"
  ) {
    return "bg-wk-warning-soft text-wk-warning";
  }

  if (
    action === "resource_linked" ||
    action === "channel_primary_changed"
  ) {
    return "bg-wk-info-soft text-wk-info";
  }

  return "bg-wk-brand-soft text-wk-brand";
}

export function PublishingOperationalHistorySection({
  item,
}: PublishingOperationalHistorySectionProps) {
  const [
    events,
    setEvents,
  ] = useState<PublishingOperationalHistoryEvent[]>([]);
  const [
    loading,
    setLoading,
  ] = useState(true);
  const [
    loadingMore,
    setLoadingMore,
  ] = useState(false);
  const [
    error,
    setError,
  ] = useState<string | null>(null);
  const [
    hasMore,
    setHasMore,
  ] = useState(false);

  const loadHistory = useCallback(
    async (
      mode: "replace" | "append",
      cursor: PublishingOperationalHistoryEvent | null,
    ) => {
      if (mode === "append" && !cursor) {
        return;
      }

      if (mode === "append") {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const nextEvents =
          await listPublishingOperationalHistory({
            itemId: item.id,
            beforeCreatedAt:
              cursor?.createdAt ?? null,
            beforeEventId:
              cursor?.eventId ?? null,
            limit: PAGE_SIZE,
          });

        setEvents((current) =>
          mode === "append"
            ? [...current, ...nextEvents]
            : nextEvents,
        );

        setHasMore(
          nextEvents.length === PAGE_SIZE,
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "We could not load this Publishing history.",
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      item.id,
    ],
  );

  useEffect(() => {
    setEvents([]);
    setHasMore(false);
    void loadHistory("replace", null);
  }, [
    item.id,
    item.recordVersion,
    loadHistory,
  ]);

  return (
    <section className="rounded-xl border border-wk-border bg-wk-surface-raised p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <WkIcon
              name="History"
              size={14}
              className="text-wk-brand"
            />
            <h3 className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
              Operational History
            </h3>
          </div>

          <p className="mt-1 text-[11px] leading-4 text-wk-text-muted">
            Read-only record of team, channel, planning, and production changes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadHistory("replace", null)}
          disabled={loading || loadingMore}
          className="wk-button wk-button-secondary wk-button-sm shrink-0 justify-center"
        >
          <WkIcon
            name={loading ? "Loader2" : "RefreshCw"}
            size={13}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-wk-danger/25 bg-wk-danger-soft px-3 py-2 text-[11px] leading-4 text-wk-danger">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 rounded-lg border border-dashed border-wk-border px-3 py-4 text-[11px] text-wk-text-muted">
          Loading Publishing history.
        </div>
      ) : events.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-wk-border px-3 py-4 text-[11px] text-wk-text-muted">
          No operational history has been recorded yet.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {events.map((event) => (
            <article
              key={event.eventId}
              className="rounded-xl border border-wk-border bg-wk-surface px-3 py-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${eventTone(event.action)}`}
                    >
                      {formatChoice(event.action)}
                    </span>

                    {event.resultingRecordVersion ? (
                      <span className="text-[10px] text-wk-text-faint">
                        Version {event.resultingRecordVersion}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 text-[12px] font-semibold leading-5 text-wk-text">
                    {describeEvent(event)}
                  </p>

                  {event.note ? (
                    <p className="mt-1 text-[11px] leading-4 text-wk-text-muted">
                      {event.note}
                    </p>
                  ) : null}
                </div>

                <div className="shrink-0 text-left text-[10px] leading-4 text-wk-text-faint sm:text-right">
                  <div>{formatDateTime(event.createdAt)}</div>
                  <div>{event.actorLabel}</div>
                </div>
              </div>

              {event.priorProductionStage !==
                event.resultingProductionStage ||
              event.priorPlanningState !==
                event.resultingPlanningState ? (
                <div className="mt-3 grid gap-2 border-t border-wk-border pt-3 text-[10px] text-wk-text-muted sm:grid-cols-2">
                  {event.priorProductionStage !==
                  event.resultingProductionStage ? (
                    <div>
                      Production:{" "}
                      {formatChoice(event.priorProductionStage)} to{" "}
                      {formatChoice(event.resultingProductionStage)}
                    </div>
                  ) : null}

                  {event.priorPlanningState !==
                  event.resultingPlanningState ? (
                    <div>
                      Planning:{" "}
                      {formatChoice(event.priorPlanningState)} to{" "}
                      {formatChoice(event.resultingPlanningState)}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {hasMore ? (
        <button
          type="button"
          onClick={() => {
            const cursor =
              events.length > 0
                ? events[events.length - 1]
                : null;

            void loadHistory("append", cursor);
          }}
          disabled={loading || loadingMore}
          className="wk-button wk-button-secondary wk-button-sm mt-4 w-full justify-center"
        >
          <WkIcon
            name={loadingMore ? "Loader2" : "ChevronDown"}
            size={13}
            className={loadingMore ? "animate-spin" : ""}
          />
          {loadingMore ? "Loading More" : "Load More"}
        </button>
      ) : null}
    </section>
  );
}
