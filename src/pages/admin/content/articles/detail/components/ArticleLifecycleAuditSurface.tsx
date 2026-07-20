import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";

export interface ArticleLifecycleAuditEvent {
  id: string;
  action: string;
  versionNumber: number | null;
  createdAt: string;
  actorLabel: string | null;
  note: string | null;
  priorStatus?: string | null;
  resultingStatus?: string | null;
}

interface Props {
  events: ArticleLifecycleAuditEvent[];
  variant?: "compact" | "full";
}

function formatLifecycleAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function actionTone(action: string): string {
  if (action === "approved" || action === "published" || action === "restored") {
    return "bg-wk-success-soft text-wk-success";
  }

  if (action === "changes_requested" || action === "archived" || action === "trashed") {
    return "bg-wk-warning-soft text-wk-warning";
  }

  if (action === "submitted" || action === "scheduled") {
    return "bg-wk-info-soft text-wk-info";
  }

  return "bg-wk-surface-raised text-wk-text-muted";
}

function actionIcon(action: string): string {
  if (action === "approved" || action === "published") return "CheckCircle2";
  if (action === "changes_requested" || action === "archived" || action === "trashed") return "RotateCcw";
  if (action === "submitted" || action === "scheduled") return "GitBranch";
  return "History";
}

export function ArticleLifecycleAuditSurface({ events, variant = "full" }: Props) {
  const isFull = variant === "full";
  const reviewActions = events.filter((event) =>
    ["submitted", "changes_requested", "approved"].includes(event.action),
  ).length;
  const publishingActions = events.filter((event) =>
    ["scheduled", "published", "unpublished"].includes(event.action),
  ).length;
  const recoveryActions = events.filter((event) =>
    ["archived", "restored", "trashed"].includes(event.action),
  ).length;
  const latestEvent = events[0] ?? null;

  if (events.length === 0) {
    return (
      <WkSurface className="border-dashed border-wk-border px-5 py-6 text-center">
        <WkIcon name="History" size={22} className="mx-auto mb-2 text-wk-text-faint" />
        <div className="text-[13px] font-black text-wk-text">No lifecycle events yet</div>
        <p className="mx-auto mt-1 max-w-xl text-[12px] leading-5 text-wk-text-muted">
          Review, approval, publishing, archive, and restore decisions will appear here once the article starts moving through governance.
        </p>
      </WkSurface>
    );
  }

  return (
    <div className="space-y-4">
      {isFull ? (
        <WkSurface className="overflow-hidden">
          <div className="border-b border-wk-border px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <WkIcon name="GitBranch" size={16} className="text-wk-brand" />
                  <h3 className="text-[15px] font-black text-wk-text">Lifecycle Audit</h3>
                </div>
                <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
                  A readable trail of editorial decisions, approvals, publishing actions, archive events, and restore points.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-2">
                  <div className="text-[16px] font-black text-wk-text">{reviewActions}</div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-wk-text-faint">Review</div>
                </div>
                <div className="rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-2">
                  <div className="text-[16px] font-black text-wk-text">{publishingActions}</div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-wk-text-faint">Publish</div>
                </div>
                <div className="rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-2">
                  <div className="text-[16px] font-black text-wk-text">{recoveryActions}</div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-wk-text-faint">Recovery</div>
                </div>
              </div>
            </div>
          </div>

          {latestEvent ? (
            <div className="border-b border-wk-border bg-wk-bg-subtle px-5 py-3 text-[12px] text-wk-text-muted">
              Latest action: <span className="font-black text-wk-text">{formatLifecycleAction(latestEvent.action)}</span>
              {" "}by <span className="font-semibold text-wk-text-soft">{latestEvent.actorLabel ?? "system"}</span>
              {" "}on {new Date(latestEvent.createdAt).toLocaleString()}.
            </div>
          ) : null}
        </WkSurface>
      ) : null}

      <div className={isFull ? "space-y-3" : "space-y-2"}>
        {events.map((event) => (
          <WkSurface key={event.id} className="overflow-hidden">
            <div className="flex gap-3 px-4 py-3">
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${actionTone(event.action)}`}>
                <WkIcon name={actionIcon(event.action)} size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-black text-wk-text">{formatLifecycleAction(event.action)}</span>
                    <span className="rounded-full bg-wk-bg-subtle px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-wk-text-faint">
                      {event.versionNumber ? `Version ${event.versionNumber}` : "No Version"}
                    </span>
                  </div>
                  <span className="text-[10px] text-wk-text-faint">{new Date(event.createdAt).toLocaleString()}</span>
                </div>

                <div className="mt-1 text-[11px] text-wk-text-muted">
                  Actor: <span className="font-semibold text-wk-text-soft">{event.actorLabel ?? "system"}</span>
                  {event.priorStatus || event.resultingStatus ? (
                    <>
                      {" "}· Editorial state: {event.priorStatus ?? "none"} to {event.resultingStatus ?? "none"}
                    </>
                  ) : null}
                </div>

                {event.note ? (
                  <div className="mt-2 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[12px] leading-5 text-wk-text-soft">
                    {event.note}
                  </div>
                ) : null}
              </div>
            </div>
          </WkSurface>
        ))}
      </div>
    </div>
  );
}
